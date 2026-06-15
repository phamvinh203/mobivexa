import type { ListQuery, PaginationMeta } from '@/types/api'

export interface InventoryVariant {
  id: string
  sku: string
  color: string | null
  storage: string | null
  ram: string | null
  imageUrl: string | null
  stock: number
  isActive: boolean
  salePrice: number
  product: {
    id: string
    name: string
    slug: string
    category: { name: string } | null
    brand: { name: string } | null
    images: { url: string }[]
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

// Tình trạng tồn kho — khớp switch(query.stockStatus) trong product.service.ts.
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface InventoryQuery extends ListQuery {
  stockStatus?: StockStatus
  lowThreshold?: number
  brandSlug?: string
}
