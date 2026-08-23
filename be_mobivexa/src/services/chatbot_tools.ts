import { Type, type FunctionDeclaration } from '@google/genai'
import { listProducts, getProductBySlug } from './product.service'
import { getCategories } from './category.service'
import { getBrands } from './brand.service'
import type { ChatProductCard } from '../types/chat.type'

// Trần cứng ở phía server. Model có thể xin limit bao nhiêu tuỳ nó, con số thật
// vẫn do đây quyết định — tham số từ model là gợi ý, không phải lệnh.
const MAX_PRODUCTS = 8
const MAX_DESCRIPTION_CHARS = 500
const MAX_VARIANTS_SHOWN = 5

export interface ToolResult {
  // Dữ liệu gửi lại cho model đọc
  data: unknown
  // Card gửi thẳng về frontend, không qua model
  products: ChatProductCard[]
}

// ─── Khai báo cho model ───────────────────────────────────────────────────────

export const CHAT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'searchProducts',
    description:
      'Tìm sản phẩm đang bán trong cửa hàng theo từ khoá, danh mục, thương hiệu hoặc khoảng giá. ' +
      'Dùng khi khách hỏi gợi ý sản phẩm hoặc hỏi cửa hàng có bán gì. Giá tính bằng VND.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword:      { type: Type.STRING, description: 'Từ khoá trong tên sản phẩm, ví dụ "iphone 15"' },
        categorySlug: { type: Type.STRING, description: 'Slug danh mục, lấy từ listCategories' },
        brandSlug:    { type: Type.STRING, description: 'Slug thương hiệu, lấy từ listBrands' },
        priceMin:     { type: Type.NUMBER, description: 'Giá thấp nhất tính bằng VND' },
        priceMax:     { type: Type.NUMBER, description: 'Giá cao nhất tính bằng VND' },
        limit:        { type: Type.NUMBER, description: `Số sản phẩm muốn lấy, tối đa ${MAX_PRODUCTS}` },
      },
    },
  },
  {
    name: 'getProductDetail',
    description:
      'Lấy chi tiết một sản phẩm: mô tả, thông số kỹ thuật, và từng biến thể kèm giá với tồn kho. ' +
      'Dùng khi khách hỏi sâu về một máy cụ thể hoặc muốn so sánh hai máy.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        slug: { type: Type.STRING, description: 'Slug sản phẩm, lấy từ kết quả searchProducts' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'listCategories',
    description: 'Liệt kê các danh mục sản phẩm cửa hàng đang bán. Dùng khi cần biết cửa hàng có những loại hàng nào.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'listBrands',
    description: 'Liệt kê các thương hiệu cửa hàng đang bán.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
]

// ─── Rút gọn dữ liệu ──────────────────────────────────────────────────────────

// Kết quả Prisma KHÔNG được đưa nguyên vẹn cho model: description chứa HTML của
// RichTextEditor với ảnh dán vào dạng base64, một sản phẩm có thể nặng vài MB.
// Đưa thẳng vào prompt là vừa đốt token vừa chạm trần context.

type VariantLike = {
  isActive: boolean
  color: string | null
  storage: string | null
  ram: string | null
  salePrice: unknown
  originalPrice: unknown
  stock: number
}

type ProductLike = {
  id: string
  name: string
  slug: string
  category?: { name: string } | null
  brand?: { name: string } | null
  variants: VariantLike[]
  images: { url: string }[]
}

const activeVariants = (variants: VariantLike[]) => variants.filter((v) => v.isActive)

// Biến thể rẻ nhất quyết định con số hiển thị trên card, khớp với cách trang
// listing đang làm (variants đã được sắp theo salePrice tăng dần).
function toCard(product: ProductLike): ChatProductCard | null {
  const cheapest = activeVariants(product.variants)[0]
  if (!cheapest) return null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    salePrice: String(cheapest.salePrice),
    originalPrice: String(cheapest.originalPrice),
    imageUrl: product.images[0]?.url ?? null,
  }
}

function toCompact(product: ProductLike) {
  const variants = activeVariants(product.variants)

  return {
    name: product.name,
    slug: product.slug,
    category: product.category?.name ?? null,
    brand: product.brand?.name ?? null,
    priceFrom: variants[0] ? String(variants[0].salePrice) : null,
    variants: variants.slice(0, MAX_VARIANTS_SHOWN).map((v) => ({
      color: v.color,
      storage: v.storage,
      ram: v.ram,
      salePrice: String(v.salePrice),
      stock: v.stock,
    })),
  }
}

// Mô tả là HTML người soạn dán vào — model không cần thẻ, chỉ cần chữ.
function stripHtml(html: string | null): string | null {
  if (!html) return null

  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > MAX_DESCRIPTION_CHARS ? `${text.slice(0, MAX_DESCRIPTION_CHARS)}...` : text
}

// ─── Thực thi ─────────────────────────────────────────────────────────────────

function clampLimit(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return MAX_PRODUCTS
  return Math.min(Math.floor(n), MAX_PRODUCTS)
}

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

const optionalNumber = (value: unknown): string | undefined =>
  Number.isFinite(Number(value)) && value !== null && value !== '' ? String(Number(value)) : undefined

async function searchProducts(args: Record<string, unknown>): Promise<ToolResult> {
  // Gọi lại listProducts ở chế độ public thay vì viết query mới: nó đã có
  // full-text search qua GIN index, lọc theo slug danh mục/thương hiệu, lọc
  // khoảng giá theo biến thể, và tự ép isActive = true. Viết query song song sẽ
  // tạo ra bản định nghĩa thứ hai về "sản phẩm nào được phép hiện ra", và sớm
  // muộn hai bản sẽ lệch nhau.
  const { products } = await listProducts({
    search:   optionalString(args.keyword),
    category: optionalString(args.categorySlug),
    brand:    optionalString(args.brandSlug),
    minPrice: optionalNumber(args.priceMin),
    maxPrice: optionalNumber(args.priceMax),
    limit:    String(clampLimit(args.limit)),
  })

  const list = products as unknown as ProductLike[]

  return {
    data: { count: list.length, products: list.map(toCompact) },
    products: list.map(toCard).filter((c): c is ChatProductCard => c !== null),
  }
}

async function getProductDetail(args: Record<string, unknown>): Promise<ToolResult> {
  const slug = optionalString(args.slug)
  if (!slug) return { data: { error: 'Thiếu slug sản phẩm' }, products: [] }

  const product = await getProductBySlug(slug)
  const typed = product as unknown as ProductLike & {
    description: string | null
    specs: { label: string; value: string }[]
  }

  const card = toCard(typed)

  return {
    data: {
      ...toCompact(typed),
      description: stripHtml(typed.description),
      specs: typed.specs.map((s) => ({ label: s.label, value: s.value })),
    },
    products: card ? [card] : [],
  }
}

async function listCategoriesTool(): Promise<ToolResult> {
  const categories = (await getCategories()) as { name: string; slug: string }[]

  return {
    data: { categories: categories.map((c) => ({ name: c.name, slug: c.slug })) },
    products: [],
  }
}

async function listBrandsTool(): Promise<ToolResult> {
  const brands = (await getBrands()) as { name: string; slug: string }[]

  return {
    data: { brands: brands.map((b) => ({ name: b.name, slug: b.slug })) },
    products: [],
  }
}

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>> = {
  searchProducts,
  getProductDetail,
  listCategories: listCategoriesTool,
  listBrands: listBrandsTool,
}

// Mọi lỗi đều biến thành { error } gửi lại cho model, không ném ra ngoài.
//
// Model tra một slug không tồn tại là chuyện bình thường — nó đoán từ ngữ cảnh.
// Để lỗi đó nổi lên tận HTTP thì cả câu hỏi hỏng, trong khi model hoàn toàn có
// thể đọc { error } rồi tự nói "bên mình chưa có mẫu đó" và hỏi lại khách.
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const handler = HANDLERS[name]
  if (!handler) return { data: { error: `Không có công cụ tên ${name}` }, products: [] }

  try {
    return await handler(args)
  } catch (err) {
    console.error(`[Chatbot] Tool ${name} lỗi:`, err)
    const message = err instanceof Error ? err.message : 'Không tra cứu được'
    return { data: { error: message }, products: [] }
  }
}
