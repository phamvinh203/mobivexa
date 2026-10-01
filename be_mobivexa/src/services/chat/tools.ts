import { Type, type FunctionDeclaration } from '@google/genai'
import prisma from '../../config/db'
import { AppError } from '../../helpers/app_error'
import { JwtPayload } from '../../types/auth.type'
import { ChatProductCard } from '../../types/chat.type'
import * as productService from '../product.service'
import * as blogService from '../blog.service'
import * as reviewService from '../review.service'
import * as couponService from '../coupon.service'
import { Prisma, OrderStatus } from '../../generated/prisma/client'
import { htmlToText } from '../../utils/blog_html'
import { BRAND_SLUGS, normalizeSearchQuery, stripIntentWords } from './normalizer'

// ─── Giới hạn cắt chuỗi đầu vào / kết quả tool ────────────────────────────────
//
// Prompt yêu cầu LLM truyền giá trị NGẮN; các hằng dưới là rào chắn cuối trước
// khi dữ liệu lạ phình context. MAX_TOOL_RESULT_LENGTH chặn cả payload trả về.

const MAX_SEARCH_INPUT = 120
const MAX_BRAND_INPUT = 60
const MAX_ORDER_ID_INPUT = 60
const MAX_COUPON_CODE_INPUT = 40
const MAX_DEFAULT_INPUT = 100 // mặc định của asString
const MAX_DESCRIPTION_SNIPPET = 500
const MAX_EXCERPT_SNIPPET = 200
const MAX_SPECS_IN_RESULT = 10
const SEARCH_RESULT_LIMIT = '5' // số sản phẩm trả cho LLM mỗi lượt search
const BLOG_RESULT_LIMIT = '3'
const RECENT_ORDERS = 3 // số đơn gần nhất khi khách không nhớ mã đơn
const MAX_TOOL_RESULT_LENGTH = 4000 // chặn tool result phình context

// Kết quả 1 tool: payload JSON trả cho Gemini qua functionResponse + card render FE
export interface ToolExecution {
  payload: Record<string, unknown>
  cards?: ChatProductCard[]
}

// Tool công khai: ai cũng chạy được. Tool user-only: chỉ chạy cho user đã đăng
// nhập — userId LUÔN do server inject lúc thực thi (requireUserId), không bao giờ
// nhận từ tham số LLM.
export interface ToolDefinition {
  declaration: FunctionDeclaration
  run: (args: Record<string, unknown>, user: JwtPayload | undefined) => Promise<ToolExecution>
  userOnly?: boolean
}

// Dùng trong run của tool user-only. executeTool đã chặn guest trước khi gọi run,
// nên nhánh throw này chỉ là bảo đảm kiểu — không phải luồng nghiệp vụ.
function requireUserId(user: JwtPayload | undefined): string {
  if (!user) throw new AppError(500, 'Chức năng này yêu cầu đăng nhập')
  return user.userId
}

// ─── TOOL REGISTRY — nguồn duy nhất khai báo 1 tool ───────────────────────────
//
// declaration (dạy model), run (thực thi) và quyền (userOnly) nằm cùng chỗ; danh sách
// declaration gửi Gemini (lọc theo quyền) và nhánh thực thi trong executeTool đều
// derive từ registry này — thêm/sửa tool chỉ đụng 1 entry.

const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  search_products: {
    declaration: {
      name: 'search_products',
      description:
        'Tìm điện thoại đang bán tại cửa hàng theo từ khoá, thương hiệu hoặc khoảng giá. LUÔN gọi tool này khi khách hỏi máy, giá, tồn kho. KHÔNG bao giờ tự nêu model/giá không có trong kết quả tool.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          search: {
            type: Type.STRING,
            description:
              'Từ khoá NGẮN (chỉ tên máy/số model, không truyền cả câu khách nói). Tự bỏ dấu và viết đủ tên thương hiệu trước khi truyền, vd "ip 15" → "iphone 15".',
          },
          brand: {
            type: Type.STRING,
            description: `Slug thương hiệu ĐÚNG DANH SÁCH cửa hàng đang có: ${BRAND_SLUGS.join(', ')} (KHÔNG dùng "apple"). Không chắc thì BỎ brand, chỉ dùng search.`,
          },
          minPrice: { type: Type.NUMBER, description: 'Ngân sách tối thiểu (VNĐ)' },
          maxPrice: { type: Type.NUMBER, description: 'Ngân sách tối đa (VNĐ), vd "dưới 8 triệu" → 8000000' },
        },
      },
    },
    run: (args) => runSearchProducts(args),
  },
  get_product_detail: {
    declaration: {
      name: 'get_product_detail',
      description:
        'Xem chi tiết 1 sản phẩm đã có slug từ search_products: các phiên bản RAM/bộ nhớ/màu, giá từng phiên bản, tồn kho, thông số. Cần thiết trước khi báo giá.',
      parameters: {
        type: Type.OBJECT,
        properties: { slug: { type: Type.STRING, description: 'slug sản phẩm từ kết quả search_products' } },
        required: ['slug'],
      },
    },
    run: (args) => runGetProductDetail(args),
  },
  search_blog: {
    declaration: {
      name: 'search_blog',
      description: 'Tìm bài viết tư vấn/kinh nghiệm chọn mua điện thoại trên blog của cửa hàng.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description:
              'Từ khoá ngắn, tiếng Việt CÓ DẤU đúng chính tả (khách gõ thiếu dấu thì tự thêm dấu), vd "chọn máy chơi game". Blog viết có dấu nên từ khoá bỏ dấu sẽ không tìm thấy gì.',
          },
        },
        required: ['query'],
      },
    },
    run: (args) => runSearchBlog(args),
  },
  get_reviews: {
    declaration: {
      name: 'get_reviews',
      description: 'Xem tóm tắt đánh giá của khách về 1 sản phẩm (điểm trung bình, phân bố sao).',
      parameters: {
        type: Type.OBJECT,
        properties: { slug: { type: Type.STRING, description: 'slug sản phẩm từ kết quả search_products' } },
        required: ['slug'],
      },
    },
    run: (args) => runGetReviews(args),
  },
  get_order_status: {
    userOnly: true,
    declaration: {
      name: 'get_order_status',
      description:
        'Tra đơn hàng VÀ trạng thái thanh toán SePay của người dùng đang đăng nhập (không tra được đơn của người khác). Không truyền orderId → trả các đơn gần nhất.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          orderId: { type: Type.STRING, description: 'ID hoặc mã đơn (ORD-...). Bỏ trống = các đơn gần nhất' },
        },
      },
    },
    run: (args, user) => runGetOrderStatus(requireUserId(user), args),
  },
  check_coupon: {
    userOnly: true,
    declaration: {
      name: 'check_coupon',
      description: 'Kiểm tra 1 mã giảm giá có dùng được cho giỏ hàng hiện tại của người dùng đang đăng nhập hay không.',
      parameters: {
        type: Type.OBJECT,
        properties: { code: { type: Type.STRING, description: 'Mã giảm giá khách cung cấp' } },
        required: ['code'],
      },
    },
    run: (args, user) => runCheckCoupon(requireUserId(user), args),
  },
}

// Declaration gửi cho Gemini theo quyền (plan mục 2.2), thứ tự = thứ tự khai báo trong
// registry. Guest không được thấy tool userOnly: đỡ tốn token khai báo và khỏi tốn một
// vòng gọi tool chỉ để nhận ghi chú "hãy đăng nhập". Chốt chặn thật vẫn là userOnly
// trong executeTool — model vẫn có thể gọi tên tool không được khai báo.
export function toolDeclarationsFor(user?: JwtPayload): FunctionDeclaration[] {
  return Object.values(TOOL_REGISTRY)
    .filter((tool) => user || !tool.userOnly)
    .map((tool) => tool.declaration)
}

const GUEST_BLOCKED_NOTE =
  'Chức năng này chỉ dành cho thành viên đã đăng nhập. Hãy mời anh/chị đăng nhập tài khoản Mobivexa (không ép buộc) rồi em mới tra cứu đơn hàng/mã giảm giá được.'

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  user: JwtPayload | undefined,
): Promise<ToolExecution> {
  const tool = TOOL_REGISTRY[name]
  if (!tool) return { payload: { result: 'unknown_tool', note: 'Tool không tồn tại.' } }

  // Tool cấm với guest: KHÔNG crash, KHÔNG thực thi — trả ghi chú để LLM mời đăng nhập
  if (tool.userOnly && !user) {
    return { payload: { result: 'blocked', note: GUEST_BLOCKED_NOTE } }
  }

  console.log('[Chat] tool call:', name, 'userId:', user?.userId ?? 'guest', 'args:', JSON.stringify(args))

  try {
    return await tool.run(args, user)
  } catch (err) {
    // Lỗi nghiệp vụ (404/400 từ service) thành ghi chú để LLM trả lời, không đứt stream
    if (err instanceof AppError) return { payload: { result: 'error', note: err.message } }
    throw err
  }
}

// ─── Các hàm parse đầu vào từ LLM ─────────────────────────────────────────────

function asString(value: unknown, maxLen = MAX_DEFAULT_INPUT): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed.slice(0, maxLen)
}

// Nhận cả 0 (ngân sách tối thiểu 0đ hợp lệ), chỉ chặn số âm / không phải số. Chuỗi
// rỗng/trắng là "không có" chứ không phải 0 — Number('') === 0 sẽ biến maxPrice: ''
// thành "tối đa 0đ" và lọt guard empty_query.
function asNonNegativeNumber(value: unknown): number | undefined {
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof num !== 'number' || !Number.isFinite(num) || num < 0) return undefined
  return num
}

export function truncateToolResult(payload: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(payload)
  if (json.length <= MAX_TOOL_RESULT_LENGTH) return payload
  return { result: 'too_large', note: 'Kết quả quá dài — hãy thu hẹp khoảng giá hoặc từ khoá rồi tra lại.' }
}

// ─── Thực thi từng tool ───────────────────────────────────────────────────────

// Chỉ lấy đúng các cột compactOrder dùng — không kéo cả hàng Order (địa chỉ giao hàng…) vào RAM.
const CHAT_ORDER_SELECT = {
  orderCode: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  total: true,
  createdAt: true,
  items: { select: { productName: true, quantity: true, color: true, storage: true, ram: true } },
  sepayTxs: { orderBy: { transactionDate: 'desc' }, take: 1, select: { status: true, transferAmount: true } },
} satisfies Prisma.OrderSelect

// Đơn vị của 1 dòng đơn trong tool result (findFirst/findMany cùng select)
type ChatOrderRow = Prisma.OrderGetPayload<{ select: typeof CHAT_ORDER_SELECT }>

// Nhãn trạng thái kiểu dân cho LLM — không có map dùng chung ở backend, chatbot
// cần chữ tiếng Việt để giải thích cho khách thay vì enum.
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Chờ xác nhận',
  [OrderStatus.CONFIRMED]: 'Đã xác nhận',
  [OrderStatus.SHIPPING]: 'Đang giao',
  [OrderStatus.DELIVERED]: 'Đã giao',
  [OrderStatus.CANCELLED]: 'Đã huỷ',
}

function compactOrder(order: ChatOrderRow) {
  return {
    orderCode: order.orderCode,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    total: Number(order.total),
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      color: i.color,
      storage: i.storage,
      ram: i.ram,
    })),
    sepayTx: order.sepayTxs[0]
      ? { status: order.sepayTxs[0].status, amount: Number(order.sepayTxs[0].transferAmount) }
      : null,
  }
}

// Variant đại diện của 1 product (rẻ nhất — product.service đã sort salePrice asc).
// Lọc giá 0 phòng thủ: dữ liệu crawler import có thể lọt salePrice=0 dù đã
// backfill — card báo "0đ" là lỗi hiển thị nặng nên ưu tiên variant có giá thật.
function firstPricedVariant(variants: Array<{ salePrice: unknown; originalPrice: unknown; imageUrl: string | null }>) {
  const priced = variants.filter((v) => Number(v.salePrice) > 0)
  return priced[0] ?? variants[0]
}

// Rút card FE từ 1 product (đã include variants + images cover)
function toCard(product: {
  id: string
  name: string
  slug: string
  brand: { name: string } | null
  variants: Array<{ salePrice: unknown; originalPrice: unknown; imageUrl: string | null }>
  images: Array<{ url: string }>
}): ChatProductCard {
  const variant = firstPricedVariant(product.variants)
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand?.name ?? '',
    salePrice: Number(variant?.salePrice ?? 0),
    originalPrice: Number(variant?.originalPrice ?? 0),
    imageUrl: variant?.imageUrl ?? product.images[0]?.url ?? null,
  }
}

async function runSearchProducts(args: Record<string, unknown>): Promise<ToolExecution> {
  const rawSearch = asString(args.search, MAX_SEARCH_INPUT)
  const brand = asString(args.brand, MAX_BRAND_INPUT)
  const minPrice = asNonNegativeNumber(args.minPrice)
  const maxPrice = asNonNegativeNumber(args.maxPrice)

  // Chống câu mơ hồ rỗng: không có tín hiệu nào thì trả lý do, không nổ listing
  if (!rawSearch && !brand && minPrice === undefined && maxPrice === undefined) {
    return {
      payload: {
        result: 'empty_query',
        note: 'Thiếu từ khoá và khoảng giá. Hãy hỏi lại ngân sách/nhu cầu của khách trước khi tìm.',
      },
    }
  }

  // Log trước/sau chuẩn hoá (plan mục 2.5) — QA assert bước bỏ dấu qua log này
  const normalized = rawSearch ? normalizeSearchQuery(rawSearch) : undefined
  const search = normalized ? stripIntentWords(normalized) || undefined : undefined
  console.log('[Chat] search_products query:', JSON.stringify({ before: rawSearch, after: search }))

  // Tham số chung cho cả 2 lượt gọi — lượt 2 (bỏ brand) chỉ là spread không có brand
  const baseParams = {
    search,
    minPrice: minPrice !== undefined ? String(minPrice) : undefined,
    maxPrice: maxPrice !== undefined ? String(maxPrice) : undefined,
    page: '1',
    limit: SEARCH_RESULT_LIMIT,
  }

  let { products, pagination } = await productService.listProducts({ ...baseParams, brand })

  // Nới lỏng brand khi 0 kết quả — model có thể đoán slug sai (vd "apple" thay
  // vì "iphone"): thử lại chỉ với search/khoảng giá thì vẫn còn máy để tư vấn.
  let brandDropped = false
  if (pagination.total === 0 && brand) {
    ;({ products, pagination } = await productService.listProducts(baseParams))
    brandDropped = products.length > 0
  }

  const cards = products.map(toCard)
  return {
    payload: {
      result: 'success',
      total: pagination.total,
      products: cards.map((c) => ({
        name: c.name,
        slug: c.slug,
        brand: c.brand,
        priceFrom: c.salePrice,
      })),
      ...(brandDropped
        ? {
            note: 'Brand không có trong cửa hàng nên đã bỏ lọc brand — kết quả theo search/khoảng giá, không phải đúng brand khách hỏi. Nói rõ điều này khi tư vấn.',
          }
        : {}),
      ...(cards.length === 0
        ? { note: 'Không có sản phẩm thỏa. Nói thật với khách, đề xuất tăng ngân sách hoặc từ khoá khác.' }
        : {}),
    },
    cards,
  }
}

async function runGetProductDetail(args: Record<string, unknown>): Promise<ToolExecution> {
  const slug = asString(args.slug)
  if (!slug) return { payload: { result: 'invalid_params', note: 'Thiếu slug sản phẩm.' } }

  const product = await productService.getProductBySlug(slug)
  const card = toCard(product)
  return {
    payload: {
      result: 'success',
      name: product.name,
      brand: product.brand?.name ?? null,
      description: htmlToText(product.description ?? '').slice(0, MAX_DESCRIPTION_SNIPPET),
      variants: product.variants.map((v) => ({
        color: v.color,
        storage: v.storage,
        ram: v.ram,
        salePrice: Number(v.salePrice),
        originalPrice: Number(v.originalPrice),
        stock: v.stock,
      })),
      specs: product.specs.slice(0, MAX_SPECS_IN_RESULT).map((s) => `${s.label}: ${s.value}`),
    },
    cards: [card],
  }
}

async function runSearchBlog(args: Record<string, unknown>): Promise<ToolExecution> {
  const query = asString(args.query)
  if (!query) return { payload: { result: 'invalid_params', note: 'Thiếu từ khoá tìm bài viết.' } }

  // KHÔNG chuẩn hoá bỏ dấu như search_products: FTS 'simple' của blog khớp từng token đúng
  // dấu và bài viết là tiếng Việt có dấu ("chon" không khớp "chọn"). Tên sản phẩm thì
  // Latin nên bỏ dấu mới khớp — hai nguồn dữ liệu khác nhau, hai cách chuẩn hoá khác nhau.
  const { posts } = await blogService.searchPosts({
    q: query,
    page: '1',
    limit: BLOG_RESULT_LIMIT,
  })
  return {
    payload: {
      result: 'success',
      posts: posts.map((p) => ({
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt ? p.excerpt.slice(0, MAX_EXCERPT_SNIPPET) : null,
      })),
      ...(posts.length === 0 ? { note: 'Không có bài viết liên quan.' } : {}),
    },
  }
}

async function runGetReviews(args: Record<string, unknown>): Promise<ToolExecution> {
  const slug = asString(args.slug)
  if (!slug) return { payload: { result: 'invalid_params', note: 'Thiếu slug sản phẩm.' } }

  const summary = await reviewService.getReviewSummary(slug)
  return {
    payload: {
      result: 'success',
      averageRating: summary.averageRating,
      totalCount: summary.totalCount,
      breakdown: summary.breakdown,
      ...(summary.totalCount === 0 ? { note: 'Sản phẩm chưa có đánh giá nào.' } : {}),
    },
  }
}

// Truy vấn thẳng prisma thay vì qua order.service: cần khớp cả id LẪN orderCode
// ("đơn ORD-... của tôi sao rồi") trong MỘT câu truy vấn, và luôn bám chặt userId
// của server — đây là rào ownership, không bao giờ nhận userId từ LLM.
async function fetchOwnOrder(userId: string, orderIdOrCode: string) {
  return prisma.order.findFirst({
    where: { userId, OR: [{ id: orderIdOrCode }, { orderCode: orderIdOrCode.toUpperCase() }] },
    select: CHAT_ORDER_SELECT,
  })
}

async function runGetOrderStatus(userId: string, args: Record<string, unknown>): Promise<ToolExecution> {
  const orderId = asString(args.orderId, MAX_ORDER_ID_INPUT)

  if (!orderId) {
    // Không nhớ mã đơn → trả vài đơn gần nhất, vẫn scope theo userId
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ORDERS,
      select: CHAT_ORDER_SELECT,
    })
    return {
      payload: {
        result: 'success',
        orders: orders.map(compactOrder),
        ...(orders.length === 0 ? { note: 'Người dùng chưa có đơn hàng nào.' } : {}),
      },
    }
  }

  const order = await fetchOwnOrder(userId, orderId)
  if (!order) {
    return {
      payload: {
        result: 'not_found',
        note: `Không tìm thấy đơn "${orderId}" trong các đơn của người dùng này. Nêu thật với khách, không bịa thông tin đơn.`,
      },
    }
  }
  return { payload: { result: 'success', order: compactOrder(order) } }
}

async function runCheckCoupon(userId: string, args: Record<string, unknown>): Promise<ToolExecution> {
  const code = asString(args.code, MAX_COUPON_CODE_INPUT)
  if (!code) return { payload: { result: 'invalid_params', note: 'Thiếu mã giảm giá.' } }

  const preview = await couponService.previewCoupon(userId, code)
  return {
    payload: {
      result: 'success',
      valid: preview.valid,
      discount: preview.discount,
      subtotal: preview.subtotal,
      ...(preview.reason ? { reason: preview.reason } : {}),
      ...(preview.valid
        ? {}
        : { note: 'Mã không dùng được. Nói thật lý do với khách, không đoán thêm điều kiện nào khác.' }),
    },
  }
}
