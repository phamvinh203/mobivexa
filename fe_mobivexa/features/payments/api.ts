import { http } from '@/lib/api/http'
import type { OrderPaymentInfo } from './types'

// Khớp src/routes/payment.route.ts — GET /api/orders/:id/payment
// Chỉ áp dụng cho đơn BANK_TRANSFER chưa thanh toán.
// Trả về VietQR URL + thông tin tài khoản để hiển thị trang thanh toán.
export const paymentApi = {
  getOrderPaymentInfo: (orderId: string) =>
    http.get<OrderPaymentInfo>(`/orders/${orderId}/payment`),
}
