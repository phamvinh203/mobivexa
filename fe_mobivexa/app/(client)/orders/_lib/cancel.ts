import { OrderStatus } from '@/types/api'
import type { Order } from '@/features/orders/types'

/** Trạng thái còn huỷ được — khớp VALID_TRANSITIONS bên backend
 *  (be_mobivexa/src/services/order.service.ts): PENDING / CONFIRMED / SHIPPING
 *  đều cho phép chuyển sang CANCELLED, DELIVERED/CANCELLED thì không. */
const CANCELLABLE: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPING,
]

export function canCancelOrder(order: Pick<Order, 'status'>): boolean {
  return CANCELLABLE.includes(order.status)
}

/** Lý do huỷ dựng sẵn — bấm nhanh thay vì gõ tay. */
export const CANCEL_REASONS = [
  'Đổi ý không mua nữa',
  'Đặt nhầm sản phẩm / số lượng',
  'Tìm được nơi bán giá tốt hơn',
  'Thời gian giao hàng quá lâu',
]
