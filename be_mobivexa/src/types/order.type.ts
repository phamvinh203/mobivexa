import { OrderStatus, PaymentMethod, PaymentStatus } from '../generated/prisma/client'

export interface OrderItemInput {
  variantId: string
  quantity: number
}

export interface CreateOrderBody {
  addressId: string
  paymentMethod?: PaymentMethod
  note?: string
  // Nếu không truyền items → tự động lấy từ giỏ hàng
  items?: OrderItemInput[]
}

export interface UpdateOrderStatusBody {
  status: OrderStatus
  cancelReason?: string
}

export interface UpdatePaymentStatusBody {
  paymentStatus: PaymentStatus
}

export interface OrderListQuery {
  page?: string
  limit?: string
  status?: OrderStatus
}

export interface AdminOrderListQuery extends OrderListQuery {
  /** Tìm theo mã đơn — khớp một phần, không phân biệt hoa thường */
  search?: string
  userId?: string
  paymentMethod?: PaymentMethod
  paymentStatus?: PaymentStatus
  from?: string // yyyy-mm-dd (nới ra đầu ngày) hoặc ISO datetime
  to?: string   // yyyy-mm-dd (nới tới cuối ngày) hoặc ISO datetime
}
