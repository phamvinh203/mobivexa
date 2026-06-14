import { http } from '@/lib/api/http'
import type { PaymentInfo, PaymentStats } from './types'

// Khớp src/routes/payment.route.ts
// (webhook /webhooks/sepay là server-to-server, FE không gọi)
export const paymentApi = {
  // Customer: lấy QR + thông tin ngân hàng cho đơn BANK_TRANSFER
  getInfo: (orderId: string) =>
    http.get<PaymentInfo>(`/orders/${orderId}/payment`),

  // Admin: thống kê thanh toán cho dashboard đối soát (STAFF + ADMIN)
  getStats: () => http.get<PaymentStats>('/admin/payment/stats'),
}
