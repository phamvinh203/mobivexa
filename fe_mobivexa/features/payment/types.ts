import type { ListQuery, PaginationMeta, OrderStatus, PaymentStatus } from '@/types/api'

/** Thông tin thanh toán VietQR/SePay cho 1 đơn — khớp getOrderPaymentInfo */
export interface PaymentInfo {
  bankId: string
  accountNo: string
  accountName: string
  amount: number
  content: string // = orderCode, dùng làm nội dung chuyển khoản
  qrUrl: string // ảnh QR VietQR
}

/** Trạng thái thanh toán của 1 đơn — khớp getOrderPaymentStatus.
 *  Endpoint nhẹ (không kèm items) để FE polling khi đang hiển thị QR. */
export interface OrderPaymentStatus {
  orderId: string
  orderCode: string
  paymentStatus: PaymentStatus
  orderStatus: OrderStatus
  paidAt: string | null
  isPaid: boolean
}

/** Số đơn + tổng tiền theo một trạng thái thanh toán */
export interface PaymentStatGroup {
  count: number
  amount: number
}

/** Thống kê thanh toán cho dashboard admin — khớp getPaymentStats (payment.service.ts) */
export interface PaymentStats {
  revenue: number // tổng tiền đã thu (PAID)
  pending: PaymentStatGroup // chưa thanh toán (mọi phương thức)
  refunded: PaymentStatGroup // đã hoàn tiền
  awaitingBankTransfer: PaymentStatGroup // chờ đối soát CK (UNPAID + BANK_TRANSFER)
  unmatchedTransactions: PaymentStatGroup // tiền đã về nhưng chưa gán được đơn
}

// ─── Sổ cái giao dịch SePay ───────────────────────────────────────────────────

/** Đồng bộ enum SePayTxStatus bên backend (prisma/schema.prisma) */
export const SePayTxStatus = {
  MATCHED: 'MATCHED', // đã khớp đơn và cập nhật thanh toán
  UNMATCHED: 'UNMATCHED', // tiền đã về nhưng chưa gán được đơn — admin xử lý tay
  IGNORED: 'IGNORED', // giao dịch không liên quan (tiền ra...)
} as const
export type SePayTxStatus = (typeof SePayTxStatus)[keyof typeof SePayTxStatus]

/** Một dòng trong sổ cái giao dịch — khớp serializeTx (đã bỏ rawPayload,
 *  transferAmount đã convert Decimal → number). */
export interface SePayTransaction {
  id: string
  sepayId: number
  gateway: string
  accountNumber: string | null
  transferType: 'in' | 'out'
  transferAmount: number
  content: string
  referenceCode: string | null
  transactionDate: string
  status: SePayTxStatus
  orderId: string | null
  orderCode: string | null
  note: string | null // lý do chưa khớp, hoặc ghi chú khi gán tay
  matchedBy: string | null // userId của admin gán tay
  matchedAt: string | null
  source: 'WEBHOOK' | 'SYNC'
  createdAt: string
  updatedAt: string
}

export interface TransactionListQuery extends ListQuery {
  status?: SePayTxStatus
  orderCode?: string
  from?: string // ISO date
  to?: string
}

export interface TransactionListResult {
  transactions: SePayTransaction[]
  pagination: PaginationMeta
}

export interface MatchTransactionPayload {
  orderCode: string
  /** Cho phép gán khi số tiền lệch — backend chặn nếu không có cờ này */
  force?: boolean
}

/** Kết quả POST /admin/payment/sync */
export interface SyncSummary {
  message: string
  fetched: number
  matched: number
  unmatched: number
  ignored: number
  duplicate: number
}

// ── Metadata hiển thị ─────────────────────────────────────────────────────────

export const SEPAY_TX_STATUS_META: Record<
  SePayTxStatus,
  { label: string; badgeClass: string }
> = {
  MATCHED: { label: 'Đã khớp đơn', badgeClass: 'bg-emerald-100 text-emerald-700' },
  UNMATCHED: { label: 'Chưa khớp', badgeClass: 'bg-amber-100 text-amber-700' },
  IGNORED: { label: 'Bỏ qua', badgeClass: 'bg-gray-100 text-gray-600' },
}

export const TX_SOURCE_META: Record<SePayTransaction['source'], { label: string }> = {
  WEBHOOK: { label: 'Webhook' },
  SYNC: { label: 'Đồng bộ tay' },
}
