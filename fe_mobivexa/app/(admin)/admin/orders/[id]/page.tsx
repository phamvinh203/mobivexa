'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Truck, PackageCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/http'
import { formatVND, formatDateTime } from '@/lib/utils/format'
import { adminOrderApi } from '@/features/orders/api'
import type { Order } from '@/features/orders/types'
import {
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  PAYMENT_METHOD_META,
  VALID_NEXT_STATUS,
} from '@/features/orders/types'
import { OrderStatus, PaymentStatus } from '@/types/api'
import { CancelOrderModal } from '../cancel-order-modal'

// Icon cho từng action chuyển trạng thái.
const STATUS_ACTION_META: Partial<Record<OrderStatus, { icon: typeof Check; variant: 'default' | 'destructive' | 'outline' }>> = {
  CONFIRMED: { icon: Check, variant: 'default' },
  SHIPPING: { icon: Truck, variant: 'default' },
  DELIVERED: { icon: PackageCheck, variant: 'default' },
  CANCELLED: { icon: X, variant: 'destructive' },
}

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!id) return
    adminOrderApi
      .get(id)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được đơn hàng'))
      .finally(() => setLoading(false))
  }, [id])

  async function runAction(op: () => Promise<Order>, errMsg: string) {
    setBusy(true)
    setError('')
    try {
      const updated = await op()
      setOrder(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errMsg)
    } finally {
      setBusy(false)
    }
  }

  function handleStatusChange(next: OrderStatus) {
    if (!order) return
    // CANCELLED cần lý do (validate) → mở modal thay vì prompt()
    if (next === OrderStatus.CANCELLED) {
      setCancelling(true)
      return
    }
    return runAction(
      () => adminOrderApi.updateStatus(order.id, { status: next }),
      'Cập nhật trạng thái thất bại',
    )
  }

  function handleCancelSaved(updated: Order) {
    setCancelling(false)
    setOrder(updated)
  }

  function handlePaymentChange(paymentStatus: PaymentStatus) {
    if (!order) return
    return runAction(
      () => adminOrderApi.updatePayment(order.id, { paymentStatus }),
      'Cập nhật thanh toán thất bại',
    )
  }

  if (loading) {
    return <div className="rounded-xl bg-white px-4 py-10 text-center text-sm text-gray-400 ring-1 ring-border">Đang tải...</div>
  }
  if (error && !order) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
        <Button variant="outline" size="sm" onClick={() => router.push('/admin/orders')}>← Quay lại</Button>
      </div>
    )
  }
  if (!order) return null

  const nextStatuses = VALID_NEXT_STATUS[order.status]
  const fullAddress = [order.shippingDetail, order.shippingWard, order.shippingDistrict, order.shippingProvince].filter(Boolean).join(', ')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-[var(--color-primary)]">← Quay lại danh sách</Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">{order.orderCode}</h1>
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_META[order.status].badgeClass}`}>
              {ORDER_STATUS_META[order.status].label}
            </span>
          </div>
          <p className="text-xs text-gray-400">Đặt ngày {formatDateTime(order.createdAt)}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Cột trái (2/3): sản phẩm + tổng tiền */}
        <div className="space-y-5 lg:col-span-2">
          {/* Sản phẩm */}
          <section className="rounded-xl bg-white p-5 ring-1 ring-border">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Sản phẩm ({order.items.length})</h2>
            <div className="divide-y divide-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800">{item.productName}</div>
                    <div className="text-xs text-gray-400">
                      <code className="font-mono">{item.sku}</code>
                      {[item.color, item.storage, item.ram].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm text-gray-600">{formatVND(item.unitPrice)} × {item.quantity}</div>
                    <div className="font-medium text-gray-800">{formatVND(item.subtotal)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tổng tiền */}
          <section className="rounded-xl bg-white p-5 ring-1 ring-border">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Thanh toán</h2>
            <dl className="space-y-1.5 text-sm">
              <Row label="Tạm tính" value={formatVND(order.subtotal)} />
              <Row label="Phí ship" value={formatVND(order.shippingFee)} />
              {Number(order.discount) > 0 && <Row label="Giảm giá" value={`- ${formatVND(order.discount)}`} />}
              <div className="border-t border-border pt-2">
                    <Row label={<span className="font-semibold text-gray-800">Tổng cộng</span>} value={<span className="text-lg font-bold text-gray-900">{formatVND(order.total)}</span>} />
              </div>
            </dl>
          </section>
        </div>

        {/* Cột phải (1/3): khách + vận chuyển + hành động */}
        <div className="space-y-5">
          {/* Khách hàng & vận chuyển */}
          <section className="rounded-xl bg-white p-5 ring-1 ring-border">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Khách & vận chuyển</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-gray-400">Người nhận</dt>
                <dd className="font-medium text-gray-800">{order.shippingName}</dd>
                <dd className="text-gray-600">{order.shippingPhone}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Địa chỉ</dt>
                <dd className="text-gray-700">{fullAddress}</dd>
              </div>
              {order.note && (
                <div>
                  <dt className="text-xs text-gray-400">Ghi chú</dt>
                  <dd className="text-gray-700">{order.note}</dd>
                </div>
              )}
              {order.cancelReason && (
                <div>
                  <dt className="text-xs text-red-400">Lý do huỷ</dt>
                  <dd className="text-red-600">{order.cancelReason}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Hành động: trạng thái */}
          <section className="rounded-xl bg-white p-5 ring-1 ring-border">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Cập nhật trạng thái</h2>
            {nextStatuses.length === 0 ? (
              <p className="text-sm text-gray-400">Đơn hàng ở trạng thái cuối (không thể chuyển tiếp).</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((s) => {
                  const meta = STATUS_ACTION_META[s]
                  const Icon = meta?.icon
                  return (
                    <Button
                      key={s}
                      variant={meta?.variant ?? 'outline'}
                      size="sm"
                      disabled={busy}
                      onClick={() => handleStatusChange(s)}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      {ORDER_STATUS_META[s].label}
                    </Button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Hành động: thanh toán */}
          <section className="rounded-xl bg-white p-5 ring-1 ring-border">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-gray-500">Thanh toán</h2>
            <p className="mb-3 text-xs text-gray-400">
              {PAYMENT_METHOD_META[order.paymentMethod].label} · hiện tại:{' '}
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${PAYMENT_STATUS_META[order.paymentStatus].badgeClass}`}>
                {PAYMENT_STATUS_META[order.paymentStatus].label}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.values(PaymentStatus).map((p) => (
                <Button
                  key={p}
                  variant={order.paymentStatus === p ? 'default' : 'outline'}
                  size="sm"
                  disabled={busy || order.paymentStatus === p}
                  onClick={() => handlePaymentChange(p)}
                >
                  {PAYMENT_STATUS_META[p].label}
                </Button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {cancelling && order && (
        <CancelOrderModal
          order={order}
          onClose={() => setCancelling(false)}
          onSaved={handleCancelSaved}
        />
      )}
    </div>
  )
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-700">{value}</dd>
    </div>
  )
}
