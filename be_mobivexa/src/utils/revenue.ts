import type { Prisma } from '../generated/prisma/client'
import { OrderStatus, PaymentStatus } from '../generated/prisma/client'

// Đơn tính vào DOANH THU: đã thanh toán và chưa bị hủy. Đơn PAID rồi hủy nghĩa là
// đã hoàn tiền / hoàn kho — nếu vẫn tính tiền thì doanh thu bị khai khống.
// (Chốt cứng: paymentStatus = PAID và status != CANCELLED.) Dashboard và thống kê
// thanh toán cùng dùng định nghĩa này để hai màn ra cùng một con số.
export const REVENUE_ORDER_WHERE: Prisma.OrderWhereInput = {
  paymentStatus: PaymentStatus.PAID,
  status: { not: OrderStatus.CANCELLED },
}

// Cùng luật, dùng khi lọc trong JS sau khi fetch thô / groupBy
export function isRevenueOrder(o: { paymentStatus: PaymentStatus; status: OrderStatus }): boolean {
  return o.paymentStatus === PaymentStatus.PAID && o.status !== OrderStatus.CANCELLED
}
