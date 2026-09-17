import { Type, type FunctionDeclaration } from '@google/genai'
import prisma from '../config/db'
import { listProducts } from './product.service'
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
        categorySlug: { type: Type.STRING, description: 'Slug danh mục, lấy từ listCategories. Danh mục cha tự động gồm cả sản phẩm của danh mục con.' },
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

// listProducts khớp slug danh mục CHÍNH XÁC, không lấy nhánh con. Với cây danh
// mục kiểu "Điện thoại > android, iphone" — nơi danh mục cha không giữ sản phẩm
// nào — model tra "dien-thoai" sẽ nhận 0 kết quả rồi kết luận cửa hàng không bán
// điện thoại, dù kho đầy máy.
//
// Với người hỏi, "điện thoại" hiển nhiên bao gồm cả android lẫn iphone, nên tool
// mở rộng slug ra các nhánh con. Chỉ áp dụng cho chatbot; hành vi của trang
// listing không đổi.
async function resolveCategorySlugs(slug: string): Promise<string[]> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      slug: true,
      children: { where: { isActive: true }, select: { id: true, slug: true } },
    },
  })

  if (!category) return [slug]

  // Cây sâu hơn 2 tầng: nếu chỉ mở con trực tiếp thì khi có cháu, nhánh cháu bị
  // âm thầm loại khỏi tra cứu và lỗi "0 kết quả" quay lại. Một findMany với
  // parentId IN(...) là đủ, không cần đệ quy.
  const childIds = category.children.map((c) => c.id)
  const grandchildren = childIds.length
    ? await prisma.category.findMany({
        where: { parentId: { in: childIds }, isActive: true },
        select: { slug: true },
      })
    : []

  return [
    category.slug,
    ...category.children.map((c) => c.slug),
    ...grandchildren.map((c) => c.slug),
  ]
}

async function searchProducts(args: Record<string, unknown>): Promise<ToolResult> {
  const limit = clampLimit(args.limit)
  const categorySlug = optionalString(args.categorySlug)

  // Gọi lại listProducts ở chế độ public thay vì viết query mới: nó đã có
  // full-text search qua GIN index, lọc theo slug danh mục/thương hiệu, lọc
  // khoảng giá theo biến thể, và tự ép isActive = true. Viết query song song sẽ
  // tạo ra bản định nghĩa thứ hai về "sản phẩm nào được phép hiện ra", và sớm
  // muộn hai bản sẽ lệch nhau.
  const baseQuery = {
    search:   optionalString(args.keyword),
    brand:    optionalString(args.brandSlug),
    minPrice: optionalNumber(args.priceMin),
    maxPrice: optionalNumber(args.priceMax),
    limit:    String(limit),
  }

  const slugs = categorySlug ? await resolveCategorySlugs(categorySlug) : [undefined]

  // Dedupe theo id: một sản phẩm chỉ thuộc một danh mục nên trùng lặp hiếm, nhưng
  // Map cũng là chỗ ép đúng số lượng model xin. Các slug tra SONG SONG — chạy
  // tuần tự thì mỗi slug là một lượt network nối tiếp nằm kẹp giữa hai lần gọi
  // Gemini; trần số lượng ép ở slice cuối.
  const found = new Map<string, ProductLike>()
  await Promise.all(
    slugs.map(async (slug) => {
      const { products } = await listProducts({ ...baseQuery, category: slug })
      for (const product of products as unknown as ProductLike[]) {
        found.set(product.id, product)
      }
    }),
  )

  const list = [...found.values()].slice(0, limit)

  return {
    data: { count: list.length, products: list.map(toCompact) },
    products: list.map(toCard).filter((c): c is ChatProductCard => c !== null),
  }
}

async function getProductDetail(args: Record<string, unknown>): Promise<ToolResult> {
  const slug = optionalString(args.slug)
  if (!slug) return { data: { error: 'Thiếu slug sản phẩm' }, products: [] }

  // Lấy thẳng bằng select hẹp thay vì getProductBySlug: PRODUCT_DETAIL_INCLUDE
  // kéo cả description HTML (có thể vài MB), toàn bộ ảnh và tags — trong khi tool
  // chỉ dùng ~500 ký tự chữ, ảnh cover và specs. Description cắt ở DB bằng
  // substring để không phải chuyển MB dữ liệu qua driver chỉ để vứt đi.
  const [product, descRows] = await Promise.all([
    prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        variants: {
          where: { isActive: true },
          orderBy: { salePrice: 'asc' as const },
          select: { isActive: true, color: true, storage: true, ram: true, salePrice: true, originalPrice: true, stock: true },
        },
        images: { orderBy: { sortOrder: 'asc' as const }, take: 1, select: { url: true } },
        specs: { orderBy: { sortOrder: 'asc' as const }, select: { label: true, value: true } },
      },
    }),
    prisma.$queryRaw<{ text: string | null }[]>`
      SELECT substring(description from 1 for 2000) AS text
      FROM products WHERE slug = ${slug}
    `,
  ])

  if (!product || !product.isActive) {
    return { data: { error: 'Không tìm thấy sản phẩm' }, products: [] }
  }

  const card = toCard(product)
  const description = descRows[0]?.text ?? null

  return {
    data: {
      ...toCompact(product),
      description: stripHtml(description),
      specs: product.specs,
    },
    products: card ? [card] : [],
  }
}

// Kết quả listCategories/listBrands chỉ đổi khi admin sửa danh mục/thương hiệu,
// mà hội thoại kiểu "cửa hàng có bán gì" gọi chúng mỗi lượt — cache 5 phút trong
// process (theo lối inventorySummaryCache của product.service) tiết kiệm cả query
// lẫn một vòng Gemini cho mỗi lượt hỏi sau đó.
const TOOL_CACHE_TTL_MS = 5 * 60_000
// Cache tắt hẳn trong test — các case trong cùng file mock DB khác nhau, cache
// sống qua các case sẽ khiến case sau đọc kết quả của case trước.
const TOOL_CACHE_SKIP_IN_TEST = process.env.NODE_ENV === 'test'
let listCategoriesCache: { data: unknown; expiresAt: number } | null = null
let listBrandsCache: { data: unknown; expiresAt: number } | null = null

async function listCategoriesTool(): Promise<ToolResult> {
  if (!TOOL_CACHE_SKIP_IN_TEST && listCategoriesCache && Date.now() < listCategoriesCache.expiresAt) {
    return { data: listCategoriesCache.data, products: [] }
  }

  // Danh mục cha ở shop này KHÔNG giữ sản phẩm trực tiếp: máy nằm trong danh mục
  // con (android, iphone), còn "Điện thoại" chỉ là nhánh gốc rỗng. Model chọn
  // slug mà không biết điều đó sẽ tra vào nhánh rỗng rồi kết luận cửa hàng không
  // bán điện thoại — đúng lỗi gặp ở lần chạy thử đầu tiên.
  //
  // Cách chữa là đưa model thông tin đúng chứ không phải nhắc nó trong prompt:
  // parentSlug cho nó thấy cây danh mục, productCount cho nó biết nhánh nào có
  // hàng thật. Chỉ select 4 trường cần — getCategories() kéo cả description/ảnh.
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, parentId: true },
    }),
    prisma.product.groupBy({
      by: ['categoryId'],
      where: { isActive: true },
      _count: { _all: true },
    }),
  ])

  const countByCategory = new Map(counts.map((c) => [c.categoryId, c._count._all]))
  const slugById = new Map(categories.map((c) => [c.id, c.slug]))

  const data = {
    categories: categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      parentSlug: c.parentId ? (slugById.get(c.parentId) ?? null) : null,
      productCount: countByCategory.get(c.id) ?? 0,
    })),
  }

  listCategoriesCache = { data, expiresAt: Date.now() + TOOL_CACHE_TTL_MS }
  return { data, products: [] }
}

async function listBrandsTool(): Promise<ToolResult> {
  if (!TOOL_CACHE_SKIP_IN_TEST && listBrandsCache && Date.now() < listBrandsCache.expiresAt) {
    return { data: listBrandsCache.data, products: [] }
  }

  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { name: true, slug: true },
  })

  const data = { brands: brands.map((b) => ({ name: b.name, slug: b.slug })) }
  listBrandsCache = { data, expiresAt: Date.now() + TOOL_CACHE_TTL_MS }
  return { data, products: [] }
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
