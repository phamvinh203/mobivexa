import { randomBytes } from 'crypto'

// Định dạng mã đơn hàng: ORD-YYYYMMDD-XXXXXX (6 hex viết hoa).
// Giữ nơi phát sinh và các regex ở một chỗ để chúng không lệch nhau.
export function generateOrderCode(): string {
  const ymd  = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = randomBytes(3).toString('hex').toUpperCase()
  return `ORD-${ymd}-${rand}`
}

export const ORDER_CODE_RE = /ORD-\d{8}-[0-9A-F]{6}/i        // tìm mã trong nội dung chuyển khoản
export const ORDER_CODE_EXACT_RE = /^ORD-\d{8}-[0-9A-F]{6}$/i // khớp toàn chuỗi khi validate input
