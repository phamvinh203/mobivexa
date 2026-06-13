import { http } from '@/lib/api/http'
import type { InventoryListResult, InventoryQuery } from './types'

// Khớp src/routes/inventory.route.ts — GET /api/admin/inventory (STAFF + ADMIN)
// Response: { variants[], summary{ totalVariants, totalStock, outOfStock, lowStock, inStock }, pagination }
export const adminInventoryApi = {
  list: (query?: InventoryQuery) =>
    http.get<InventoryListResult>('/admin/inventory', { params: query }),
}
