export interface VariantInput {
  sku: string
  color?: string
  storage?: string
  ram?: string
  originalPrice: number
  salePrice: number
  stock?: number
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

export interface UpdateStockBody {
  stock: number
}

export interface InventoryQuery {
  page?: string
  limit?: string
  search?: string
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  lowThreshold?: string // ngưỡng cảnh báo tồn kho thấp, mặc định 5
}

// Query params cho listing (dùng chung public + admin).
// isActive/isFeatured chỉ được dùng khi opts.admin=true ở listProducts.
export interface ProductListQuery {
  page?: string
  limit?: string
  category?: string // slug danh mục
  brand?: string // slug thương hiệu
  tag?: string // slug tag
  search?: string // tìm theo tên
  minPrice?: string
  maxPrice?: string
  isActive?: string // 'true' | 'false' (admin only)
  isFeatured?: string // 'true' | 'false' (admin only)
  sort?: string // 'newest' | 'oldest' | 'name_asc' | 'name_desc'
}
