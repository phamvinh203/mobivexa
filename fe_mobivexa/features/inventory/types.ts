import type { ListQuery, PaginationMeta } from '@/types/api'

export interface InventoryVariant {
  id: string
  sku: string
  color: string | null
  storage: string | null
  ram: string | null
  stock: number
  isActive: boolean
  salePrice: number
  product: {
    id: string
    name: string
    slug: string
  }
}

export interface InventorySummary {
  totalVariants: number
  totalStock: number
  outOfStock: number
  lowStock: number
  inStock: number
}

export interface InventoryListResult {
  variants: InventoryVariant[]
  summary: InventorySummary
  pagination: PaginationMeta
}

export type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'

// Extend ListQuery để có index signature [key: string] — cần cho http.get params
export interface InventoryQuery extends ListQuery {
  stockStatus?: StockStatus
  lowThreshold?: number  // ngưỡng cảnh báo tồn kho thấp, mặc định 5
}
