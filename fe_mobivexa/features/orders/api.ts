import { http } from '@/lib/api/http'
import type {
  Order,
  CreateOrderPayload,
  OrderListQuery,
  AdminOrderListQuery,
  AdminOrderListResult,
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

// Admin: /admin/orders (STAFF + ADMIN). Backend bọc { orders, pagination } /
// { order } → unwrap tại đây.
export const adminOrderApi = {
  list: (query?: AdminOrderListQuery) =>
    http.get<AdminOrderListResult>('/admin/orders', { params: query }),

  get: (id: string) =>
    http.get<{ order: Order }>(`/admin/orders/${id}`).then((r) => r.order),

  updateStatus: (id: string, body: UpdateStatusPayload) =>
    http.patch<{ order: Order }>(`/admin/orders/${id}/status`, body).then((r) => r.order),

  updatePayment: (id: string, body: UpdatePaymentPayload) =>
    http.patch<{ order: Order }>(`/admin/orders/${id}/payment`, body).then((r) => r.order),
}
