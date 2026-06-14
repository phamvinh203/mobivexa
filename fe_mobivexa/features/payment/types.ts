/** Thông tin thanh toán VietQR/SePay cho 1 đơn — khớp getOrderPaymentInfo */
export interface PaymentInfo {
  bankId: string
  accountNo: string
  accountName: string
  amount: number
  content: string // = orderCode, dùng làm nội dung chuyển khoản
  qrUrl: string // ảnh QR VietQR
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
}
