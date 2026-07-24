import { CircleCheck, Clock, PackageCheck, Truck, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ORDER_STATUS_META, type Order } from '@/features/orders/types'
import { OrderStatus } from '@/types/api'
import { formatDateTime } from '@/lib/utils/format'

/** Luồng trạng thái bình thường, đúng thứ tự vòng đời. CANCELLED là nhánh rẽ
 *  cuối (terminal) nên xử lý riêng, không nằm trong thanh tiến trình. */
const FLOW: { status: OrderStatus; Icon: LucideIcon }[] = [
  { status: OrderStatus.PENDING, Icon: Clock },
  { status: OrderStatus.CONFIRMED, Icon: CircleCheck },
  { status: OrderStatus.SHIPPING, Icon: Truck },
  { status: OrderStatus.DELIVERED, Icon: PackageCheck },
]

export function OrderStatusTracker({ order }: { order: Order }) {
  // ── Đơn đã huỷ: banner riêng, không hiện thanh tiến trình ────────────────
  if (order.status === OrderStatus.CANCELLED) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-danger)]/30 bg-red-50 p-5">
        <XCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-[var(--color-danger)]" aria-hidden />
        <div>
          <p className="font-bold text-[var(--color-danger)]">Đơn hàng đã huỷ</p>
          <p className="mt-0.5 text-sm text-gray-600">
            {order.cancelReason || 'Đơn hàng đã được huỷ.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cập nhật lúc {formatDateTime(order.updatedAt)}
          </p>
        </div>
      </div>
    )
  }

  const currentIndex = FLOW.findIndex((s) => s.status === order.status)

  return (
    <div className="rounded-2xl border border-border bg-white p-5 sm:p-6">
      <ol className="flex items-center">
        {FLOW.map((step, i) => {
          const meta = ORDER_STATUS_META[step.status]
          const done = i < currentIndex
          const active = i === currentIndex
          const reached = done || active

          return (
            <li
              key={step.status}
              className={`flex items-center ${i < FLOW.length - 1 ? 'flex-1' : ''}`}
            >
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full border-2 transition-colors ${
                    reached
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                      : 'border-border bg-white text-gray-300'
                  } ${active ? 'ring-4 ring-[var(--color-primary)]/15' : ''}`}
                >
                  <step.Icon className="h-5 w-5" aria-hidden />
                </span>
                <span
                  className={`text-[11px] font-semibold leading-tight sm:text-xs ${
                    reached ? 'text-gray-800' : 'text-muted-foreground'
                  }`}
                >
                  {meta.label}
                </span>
              </div>

              {/* Đường nối tới bước sau — tô màu khi bước hiện tại đã đi qua */}
              {i < FLOW.length - 1 && (
                <span
                  className={`mx-1 h-0.5 flex-1 rounded-full sm:mx-2 ${
                    i < currentIndex
                      ? 'bg-[var(--color-primary)]'
                      : 'bg-border'
                  }`}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Đặt lúc {formatDateTime(order.createdAt)}
        {order.status === OrderStatus.DELIVERED &&
          ` · Giao thành công ${formatDateTime(order.updatedAt)}`}
      </p>
    </div>
  )
}
