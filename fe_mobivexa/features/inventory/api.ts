import { http } from '@/lib/api/http'
import type { ListQuery } from '@/types/api'
import type { ProductVariant, Product } from '../products/types'

/** Mỗi dòng tồn kho = variant kèm thông tin product cha */
export interface InventoryRow extends ProductVariant {
  product?: Pick<Product, 'id' | 'name' | 'slug'>
}

// Khớp src/routes/inventory.route.ts — /admin/inventory (STAFF + ADMIN, read-only)
export const inventoryApi = {
  list: (query?: ListQuery) =>
    http.get<InventoryRow[]>('/admin/inventory', { params: query }),
}
