// Prisma serialize kiểu Decimal thành chuỗi trong JSON → giá tiền nhận về là string.
export type Money = string | number

/** Định dạng tiền VND: 23990000 → "23.990.000₫" */
export function formatVND(value: Money): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(num)) return '0₫'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(num)
}

/** Định dạng ngày: "15/01/2024" */
export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** Định dạng ngày giờ: "15/01/2024 14:32" */
export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** % giảm giá giữa giá gốc và giá bán */
export function discountPercent(original: Money, sale: Money): number {
  const o = Number(original)
  const s = Number(sale)
  if (!o || o <= s) return 0
  return Math.round(((o - s) / o) * 100)
}
