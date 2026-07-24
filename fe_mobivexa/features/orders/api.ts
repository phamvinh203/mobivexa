import { http } from '@/lib/api/http'
import type {
  Order,
  CreateOrderPayload,
  OrderListQuery,
  OrderListResult,
  AdminOrderListQuery,
  AdminOrderListResult,
  UpdateStatusPayload,
  UpdatePaymentPayload,
} from './types'

// Khớp src/routes/order.route.ts. Backend bọc { order } / { orders, pagination }
// (order.controller.ts) → unwrap tại đây.
export const orderApi = {
  // Customer: /orders (yêu cầu đăng nhập)
  create: (body: CreateOrderPayload) =>
    http
      .post<{ message: string; order: Order }>('/orders', body)
      .then((r) => r.order),

  listMine: (query?: OrderListQuery) =>
    http
      .get<OrderListResult>('/orders', { params: query })
      .then((r) => r.orders ?? []),

  // Bản giữ pagination — dùng cho trang /orders có phân trang
  listMinePaged: (query?: OrderListQuery) =>
    http.get<OrderListResult>('/orders', { params: query }),

  getMine: (id: string) =>
    http.get<{ order: Order }>(`/orders/${id}`).then((r) => r.order),

  // Backend đọc body.reason (tuỳ chọn) — không truyền thì mặc định
  // "Khách hàng hủy đơn". Route khách hàng không có validator cho reason.
  cancel: (id: string, reason?: string) =>
    http
      .patch<{ message: string; order: Order }>(
        `/orders/${id}/cancel`,
        reason ? { reason } : undefined,
      )
      .then((r) => r.order),
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
