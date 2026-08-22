export interface VariantInput {
  sku: string
  color?: string
  storage?: string
  ram?: string
  imageUrl?: string
  originalPrice: number
  salePrice: number
  stock?: number
  isActive?: boolean
}

// Một dòng thông số kỹ thuật. Thứ tự hiển thị lấy theo thứ tự trong mảng gửi
// lên, nên client không phải tự đánh sortOrder.
export interface SpecInput {
  label: string
  value: string
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
  specs?: SpecInput[]
}

// Cập nhật product: không đụng tới variants và specs ở đây (mỗi thứ có endpoint riêng)
export type UpdateProductBody = Partial<Omit<CreateProductBody, 'variants' | 'specs'>>

export interface ReplaceSpecsBody {
  specs: SpecInput[]
}

export type UpdateVariantBody = Partial<VariantInput>

export interface UpdateStockBody {
  stock: number
}

export interface InventoryQuery {
  page?: string
  limit?: string
  search?: string
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  lowThreshold?: string
  brandSlug?: string
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
