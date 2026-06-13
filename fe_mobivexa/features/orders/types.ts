import type { Money } from '@/lib/utils/format'
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ListQuery,
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

export interface UpdateStatusPayload {
  status: OrderStatus
  cancelReason?: string
}

export interface UpdatePaymentPayload {
  paymentStatus: PaymentStatus
}
