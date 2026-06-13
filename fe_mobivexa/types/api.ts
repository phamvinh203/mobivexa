// ─────────────────────────────────────────────────────────────────────────────
// Kiểu dùng chung cho toàn bộ tầng API — khớp với backend be_mobivexa
// ─────────────────────────────────────────────────────────────────────────────

/** Enum đồng bộ với prisma/schema.prisma bên backend */
export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  SHIPPING: 'SHIPPING',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

export const PaymentMethod = {
  COD: 'COD',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const ReviewStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus]

/** Backend trả lỗi dạng { message } — xem helpers/response.ts */
export interface ApiErrorBody {
  message: string
}

/** Một số list endpoint trả về kèm phân trang (tuỳ controller) */
export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

/** Query phân trang/lọc/sắp xếp chung */
export interface ListQuery {
  page?: number
  limit?: number
  search?: string
  sort?: string
  [key: string]: string | number | boolean | undefined
}
