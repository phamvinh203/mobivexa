export interface OrderPaymentInfo {
  bankId: string
  accountNo: string
  accountName: string
  amount: number
  content: string   // nội dung chuyển khoản = orderCode
  qrUrl: string     // VietQR image URL
}
