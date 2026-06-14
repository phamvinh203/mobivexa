import type { Money } from '@/lib/utils/format'
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  type ListQuery,
  type PaginationMeta,
} from '@/types/api'

export interface OrderItem {
  id: string
  orderId: string
  variantId: string | null
  productName: string
  sku: string
  color: string | null
  storage: string | null
  ram: string | null
  unitPrice: Money
  quantity: number
  subtotal: Money
}

export interface Order {
  id: string
  orderCode: string
  userId: string
  shippingName: string
  shippingPhone: string
  shippingProvince: string
  shippingDistrict: string
  shippingWard: string
  shippingDetail: string
  subtotal: Money
  shippingFee: Money
  discount: Money
  total: Money
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  note: string | null
  cancelReason: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
}

/** Order ở góc nhìn admin — include thêm user (id/fullName/email).
 *  List endpoint chỉ trả _count.items (không trả items chi tiết để tránh over-fetch),
 *  còn detail trả đầy đủ items. Nên items là optional + có _count. */
export interface AdminOrder extends Omit<Order, 'items'> {
  items?: OrderItem[]
  user?: { id: string; fullName: string; email: string }
  _count?: { items: number }
}

export interface CreateOrderPayload {
  addressId: string
  paymentMethod: PaymentMethod
  note?: string
  // KHÔNG nhận shippingFee/discount từ client — backend tự tính theo cart +
  // chương trình khuyến mãi để tránh thao túng giá (mass-assignment).
}

export interface OrderListQuery extends ListQuery {
  status?: OrderStatus
  paymentStatus?: PaymentStatus
}

/** Query admin — filter thêm paymentMethod/userId/khoảng ngày (from/to ISO). */
export interface AdminOrderListQuery extends ListQuery {
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  paymentMethod?: PaymentMethod
  userId?: string
  from?: string
  to?: string
}

/** Kết quả GET /admin/orders — paginated */
export interface AdminOrderListResult {
  orders: AdminOrder[]
  pagination: PaginationMeta
}

export interface UpdateStatusPayload {
  status: OrderStatus
  cancelReason?: string
}

export interface UpdatePaymentPayload {
  paymentStatus: PaymentStatus
}

// ── Metadata hiển thị ─────────────────────────────────────────────────────────

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; badgeClass: string }> = {
  PENDING: { label: 'Chờ xác nhận', badgeClass: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'Đã xác nhận', badgeClass: 'bg-sky-100 text-sky-700' },
  SHIPPING: { label: 'Đang giao', badgeClass: 'bg-indigo-100 text-indigo-700' },
  DELIVERED: { label: 'Đã giao', badgeClass: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Đã huỷ', badgeClass: 'bg-red-100 text-red-700' },
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; badgeClass: string }> = {
  UNPAID: { label: 'Chưa thanh toán', badgeClass: 'bg-gray-100 text-gray-600' },
  PAID: { label: 'Đã thanh toán', badgeClass: 'bg-emerald-100 text-emerald-700' },
  REFUNDED: { label: 'Đã hoàn tiền', badgeClass: 'bg-amber-100 text-amber-700' },
}

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string }> = {
  COD: { label: 'COD (nhận hàng)' },
  BANK_TRANSFER: { label: 'Chuyển khoản' },
}

// Luồng chuyển trạng thái hợp lệ — mirror VALID_TRANSITIONS ở backend
// (order.service.ts). Nguồn sự thật vẫn là backend; đây chỉ để ẩn/hiện nút.
export const VALID_NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

