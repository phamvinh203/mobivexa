export interface VariantInput {
  sku: string
  color?: string
  storage?: string
  ram?: string
  originalPrice: number
  salePrice: number
  isActive?: boolean
}

export interface CreateProductBody {
  name: string
  slug?: string
  description?: string
  categoryId: string
  brandId: string
  isActive?: boolean
  isFeatured?: boolean
  tagIds?: string[]
  variants: VariantInput[]
}

// Cập nhật product: không đụng tới variants ở đây (quản lý qua endpoint /variants riêng)
export type UpdateProductBody = Partial<Omit<CreateProductBody, 'variants'>>

export type UpdateVariantBody = Partial<VariantInput>

// Query params cho listing công khai
export interface ProductListQuery {
  page?: string
  limit?: string
  category?: string // slug danh mục
  brand?: string // slug thương hiệu
  tag?: string // slug tag
  search?: string // tìm theo tên
  minPrice?: string
  maxPrice?: string
  sort?: string // 'newest' | 'oldest' | 'name_asc' | 'name_desc'
}
