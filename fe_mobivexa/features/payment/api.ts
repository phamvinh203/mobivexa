import { http } from '@/lib/api/http'
import type {
  PaymentInfo,
  OrderPaymentStatus,
  PaymentStats,
  TransactionListQuery,
  TransactionListResult,
  MatchTransactionPayload,
  SePayTransaction,
  SyncSummary,
} from './types'

// Khớp src/routes/payment.route.ts
// (webhook /webhooks/sepay là server-to-server, FE không gọi)
export const paymentApi = {
  // Customer: lấy QR + thông tin ngân hàng cho đơn BANK_TRANSFER
  getInfo: (orderId: string) =>
    http.get<PaymentInfo>(`/orders/${orderId}/payment`),

  // Customer: endpoint nhẹ để polling khi đang hiển thị QR
  getStatus: (orderId: string) =>
    http.get<OrderPaymentStatus>(`/orders/${orderId}/payment/status`),
}

// Admin: /admin/payment (STAFF + ADMIN)
export const adminPaymentApi = {
  // Thống kê tổng hợp cho dashboard đối soát
  getStats: () => http.get<PaymentStats>('/admin/payment/stats'),

  // Sổ cái giao dịch SePay — tra cứu, đối soát
  listTransactions: (query?: TransactionListQuery) =>
    http.get<TransactionListResult>('/admin/payment/transactions', { params: query }),

  // Hàng chờ xử lý: tiền đã về nhưng chưa gán được đơn.
  // Backend ép status=UNMATCHED nên không nhận tham số status.
  listUnmatched: (query?: Omit<TransactionListQuery, 'status'>) =>
    http.get<TransactionListResult>('/admin/payment/transactions/unmatched', {
      params: query,
    }),

  // Gán tay giao dịch vào đơn — backend bọc { message, transaction } → unwrap
  match: (txId: string, body: MatchTransactionPayload) =>
    http
      .post<{ message: string; transaction: SePayTransaction }>(
        `/admin/payment/transactions/${txId}/match`,
        body,
      )
      .then((r) => r.transaction),

  // Kéo lại giao dịch từ SePay UserAPI khi nghi ngờ webhook bị rớt
  sync: (query?: { limit?: number; from?: string; to?: string }) =>
    http.post<SyncSummary>('/admin/payment/sync', undefined, { params: query }),
}
