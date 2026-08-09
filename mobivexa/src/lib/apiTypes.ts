// ─────────────────────────────────────────────────────────────────────────────
// Kiểu dùng chung cho tầng API — khớp prisma/schema.prisma bên be_mobivexa.
// Dùng object as const thay vì TS enum vì tsconfig bật erasableSyntaxOnly.
// ─────────────────────────────────────────────────────────────────────────────

export const OrderStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  SHIPPING: "SHIPPING",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentMethod = {
  COD: "COD",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  UNPAID: "UNPAID",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const ReviewStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

/** Meta phân trang — khớp paginationMeta() trong be_mobivexa/src/utils/pagination.ts. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Query phân trang/lọc chung. */
export interface ListQuery {
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}
