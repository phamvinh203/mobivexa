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
  shippingFee?: number
  discount?: number
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
