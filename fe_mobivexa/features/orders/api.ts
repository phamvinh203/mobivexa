import { http } from '@/lib/api/http'
import type {
  Order,
  CreateOrderPayload,
  OrderListQuery,
  UpdateStatusPayload,
  UpdatePaymentPayload,
} from './types'

// Khớp src/routes/order.route.ts
export const orderApi = {
  // Customer: /orders (yêu cầu đăng nhập)
  create: (body: CreateOrderPayload) => http.post<Order>('/orders', body),
  listMine: (query?: OrderListQuery) =>
    http.get<Order[]>('/orders', { params: query }),
  getMine: (id: string) => http.get<Order>(`/orders/${id}`),
  cancel: (id: string) => http.patch<Order>(`/orders/${id}/cancel`),
}

// Admin: /admin/orders (STAFF + ADMIN)
export const adminOrderApi = {
  list: (query?: OrderListQuery) =>
    http.get<Order[]>('/admin/orders', { params: query }),
  get: (id: string) => http.get<Order>(`/admin/orders/${id}`),
  updateStatus: (id: string, body: UpdateStatusPayload) =>
    http.patch<Order>(`/admin/orders/${id}/status`, body),
  updatePayment: (id: string, body: UpdatePaymentPayload) =>
    http.patch<Order>(`/admin/orders/${id}/payment`, body),
}
