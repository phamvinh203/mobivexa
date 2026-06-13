import { http } from '@/lib/api/http'
import type { PaymentInfo } from './types'

// Khớp src/routes/payment.route.ts
// (webhook /webhooks/sepay là server-to-server, FE không gọi)
export const paymentApi = {
  // Customer: lấy QR + thông tin ngân hàng cho đơn BANK_TRANSFER
  getInfo: (orderId: string) =>
    http.get<PaymentInfo>(`/orders/${orderId}/payment`),
}
