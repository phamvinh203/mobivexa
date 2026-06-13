/** Thông tin thanh toán VietQR/SePay cho 1 đơn — khớp getOrderPaymentInfo */
export interface PaymentInfo {
  bankId: string
  accountNo: string
  accountName: string
  amount: number
  content: string // = orderCode, dùng làm nội dung chuyển khoản
  qrUrl: string // ảnh QR VietQR
}
