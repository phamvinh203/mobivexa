import type { Money } from '@/lib/utils/format'
import type { ListQuery, PaginationMeta } from '@/types/api'
import type { Category } from '../categories/types'
import type { Brand } from '../brands/types'
import type { Tag } from '../tags/types'

export interface ProductImage {
  id: string
  productId: string
  url: string
  isCover: boolean
  sortOrder: number
}

export interface ProductVariant {
  id: string
  productId: string
  sku: string
  color: string | null
  storage: string | null
  ram: string | null
  originalPrice: Money
  salePrice: Money
  stock: number
  isActive: boolean
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  categoryId: string
  brandId: string
  isActive: boolean
  isFeatured: boolean
  createdAt: string
  updatedAt: string
  category?: Category
  brand?: Brand
  images?: ProductImage[]
  variants?: ProductVariant[]
  tags?: Tag[]
}

/** Query lọc danh sách sản phẩm public */
export interface ProductListQuery extends ListQuery {
  category?: string // slug
  brand?: string // slug
  tag?: string
  minPrice?: number
  maxPrice?: number
  featured?: boolean
}

/** Query lọc danh sách sản phẩm admin — thấy cả sản phẩm ẩn, filter trạng thái/featured */
export interface AdminProductListQuery extends ListQuery {
  category?: string // slug
  brand?: string // slug
  isActive?: boolean
  isFeatured?: boolean
}

/** Kết quả GET /admin/products — paginated */
export interface AdminProductListResult {
  products: Product[]
  pagination: PaginationMeta
}

export interface VariantPayload {
  sku: string
  color?: string
  storage?: string
  ram?: string
  originalPrice: number
  salePrice: number
  stock: number
}

export interface ProductPayload {
  name: string
  slug?: string
  description?: string
  categoryId: string
  brandId: string
  tagIds?: string[]
  variants?: VariantPayload[]
  isActive?: boolean
  isFeatured?: boolean
}

export interface UpdateStockPayload {
  stock: number
}
