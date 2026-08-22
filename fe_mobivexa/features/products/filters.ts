// ─────────────────────────────────────────────────────────────────────────────
// State của trang duyệt sản phẩm nằm hết trên URL (searchParams) — link chia sẻ
// được, back/forward hoạt động đúng, và Server Component render sẵn kết quả.
// Module này là nguồn chân lý duy nhất cho việc đọc/ghi query string, dùng chung
// cho /products, /categories/[slug] và /brands/[slug] (server lẫn client).
// ─────────────────────────────────────────────────────────────────────────────

/** Đường dẫn gốc của trang đang duyệt — quyết định link filter trỏ về đâu. */
export const PRODUCTS_BASE = '/products'

/** Facet bị khoá bởi chính route (vd /categories/iphone khoá category).
 *  Trang đó ẩn facet này khỏi sidebar và không cho gỡ nó ra khỏi filter. */
export type LockedFacet = 'category' | 'brand'

/** Sort backend thực sự hỗ trợ — khớp resolveSort() trong product.service.ts.
 *  KHÔNG có sắp xếp theo giá: giá nằm ở bảng variant nên Prisma orderBy hiện
 *  không làm được, cần đổi backend mới thêm được. */
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'name_asc', label: 'Tên A → Z' },
  { value: 'name_desc', label: 'Tên Z → A' },
] as const

export type SortValue = (typeof SORT_OPTIONS)[number]['value']

const SORT_VALUES = SORT_OPTIONS.map((o) => o.value) as readonly string[]

/** Khoảng giá dựng sẵn — nhanh hơn gõ số, nhất là trên mobile. */
export const PRICE_RANGES = [
  { id: 'duoi-5', label: 'Dưới 5 triệu', min: undefined, max: 5_000_000 },
  { id: '5-10', label: '5 – 10 triệu', min: 5_000_000, max: 10_000_000 },
  { id: '10-20', label: '10 – 20 triệu', min: 10_000_000, max: 20_000_000 },
  { id: '20-30', label: '20 – 30 triệu', min: 20_000_000, max: 30_000_000 },
  { id: 'tren-30', label: 'Trên 30 triệu', min: 30_000_000, max: undefined },
] as const

export interface ProductFilters {
  search?: string
  category?: string
  brand?: string
  tag?: string
  minPrice?: number
  maxPrice?: number
  sort: SortValue
  page: number
  /** Backend public KHÔNG lọc được isFeatured → page dùng endpoint
   *  /products/featured riêng khi cờ này bật. */
  featured: boolean
}

/** searchParams của Next có thể là string | string[] — lấy giá trị đầu. */
function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return v && v.trim() !== '' ? v.trim() : undefined
}

function positiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}

export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ProductFilters {
  const sort = first(searchParams.sort)
  const min = positiveInt(first(searchParams.minPrice))
  const max = positiveInt(first(searchParams.maxPrice))

  return {
    search: first(searchParams.search),
    category: first(searchParams.category),
    brand: first(searchParams.brand),
    tag: first(searchParams.tag),
    // Người dùng gõ ngược (min > max) thì đảo lại thay vì trả 0 kết quả
    minPrice: min !== undefined && max !== undefined ? Math.min(min, max) : min,
    maxPrice: min !== undefined && max !== undefined ? Math.max(min, max) : max,
    sort: sort && SORT_VALUES.includes(sort) ? (sort as SortValue) : 'newest',
    page: positiveInt(first(searchParams.page)) ?? 1,
    featured: first(searchParams.featured) === 'true',
  }
}

/**
 * Dựng href mới từ filter hiện tại + phần thay đổi.
 * Mọi thay đổi filter đều reset về trang 1 (trừ khi patch chỉ định page) —
 * đang ở trang 5 mà đổi hãng thì nhảy về trang 5 của kết quả mới là vô nghĩa.
 *
 * `basePath` cho phép trang danh mục/thương hiệu giữ người dùng ở lại route của
 * mình thay vì văng về /products. `locked` là facet do route quyết định — nó nằm
 * trong path rồi nên không lặp lại trong query string.
 */
export function buildHref(
  filters: ProductFilters,
  patch: Partial<ProductFilters> = {},
  basePath: string = PRODUCTS_BASE,
  locked?: LockedFacet,
): string {
  const next: ProductFilters = { ...filters, ...patch }
  const params = new URLSearchParams()

  if (next.search) params.set('search', next.search)
  if (locked !== 'category' && next.category) params.set('category', next.category)
  if (locked !== 'brand' && next.brand) params.set('brand', next.brand)
  if (next.tag) params.set('tag', next.tag)
  if (next.minPrice !== undefined) params.set('minPrice', String(next.minPrice))
  if (next.maxPrice !== undefined) params.set('maxPrice', String(next.maxPrice))
  if (next.sort !== 'newest') params.set('sort', next.sort)
  if (next.featured) params.set('featured', 'true')

  const page = patch.page ?? 1
  if (page > 1) params.set('page', String(page))

  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/** Có filter nào đang bật không (không tính sort/page, và bỏ qua facet bị khoá). */
export function hasActiveFilters(
  filters: ProductFilters,
  locked?: LockedFacet,
): boolean {
  return Boolean(
    filters.search ||
      (locked !== 'category' && filters.category) ||
      (locked !== 'brand' && filters.brand) ||
      filters.tag ||
      filters.minPrice !== undefined ||
      filters.maxPrice !== undefined ||
      filters.featured,
  )
}

/** Khoảng giá dựng sẵn đang được chọn (so khớp cả min lẫn max). */
export function matchedPriceRange(filters: ProductFilters): string | null {
  return (
    PRICE_RANGES.find(
      (r) => r.min === filters.minPrice && r.max === filters.maxPrice,
    )?.id ?? null
  )
}
