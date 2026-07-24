'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  Loader2,
  Package,
  QrCode,
  Star,
  TriangleAlert,
  X,
} from 'lucide-react'
import { orderApi } from '@/features/orders/api'
import {
  ORDER_STATUS_META,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
  type Order,
} from '@/features/orders/types'
import { OrderStatus } from '@/types/api'
import { ApiError } from '@/lib/api/http'
import { formatDateTime, formatVND } from '@/lib/utils/format'
import { CANCEL_REASONS, canCancelOrder } from '../_lib/cancel'

interface OrderCardProps {
  order: Order
  /** Cha thay đơn đã cập nhật vào danh sách sau khi huỷ thành công */
  onUpdated: (order: Order) => void
}

export function OrderCard({ order, onUpdated }: OrderCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = ORDER_STATUS_META[order.status]
  const payStatus = PAYMENT_STATUS_META[order.paymentStatus]
  const payMethod = PAYMENT_METHOD_META[order.paymentMethod]

  const canCancel = canCancelOrder(order)
  const canPay =
    order.paymentMethod === 'BANK_TRANSFER' &&
    order.paymentStatus === 'UNPAID' &&
    order.status !== OrderStatus.CANCELLED
  const canReview = order.status === OrderStatus.DELIVERED

  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0)

  async function cancel() {
    setCancelling(true)
    setError(null)
    try {
      const updated = await orderApi.cancel(order.id, reason.trim() || undefined)
      onUpdated(updated)
      setConfirming(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không huỷ được đơn hàng')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-gray-50/60 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/orders/${order.id}`}
            className="font-mono text-sm font-bold text-gray-900 hover:text-[var(--color-primary)]"
          >
            {order.orderCode}
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(order.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {payStatus && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${payStatus.badgeClass}`}
            >
              {payStatus.label}
            </span>
          )}
          {status && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.badgeClass}`}
            >
              {status.label}
            </span>
          )}
        </div>
      </header>

      {/* ── Danh sách sản phẩm ─────────────────────────────────────────────── */}
      <ul className="divide-y divide-border px-5">
        {order.items.map((item) => {
          const variant = [item.storage, item.ram && `${item.ram} RAM`, item.color]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={item.id} className="flex items-start gap-3 py-3">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg border border-border bg-gray-50 text-muted-foreground">
                <Package className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-gray-900">
                  {item.productName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {variant && `${variant} · `}SL: {item.quantity}
                </p>
              </div>
              <span className="flex-shrink-0 text-sm font-semibold">
                {formatVND(item.subtotal)}
              </span>
            </li>
          )
        })}
      </ul>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {payMethod?.label} · {order.items.length} sản phẩm ({totalUnits} món)
          </span>
          <span className="flex items-baseline gap-1.5 text-sm">
            <span className="text-muted-foreground">Tổng tiền:</span>
            <span className="text-lg font-black text-[var(--color-sale-strong)]">
              {formatVND(order.total)}
            </span>
          </span>
        </div>

        {order.status === OrderStatus.CANCELLED && order.cancelReason && (
          <p className="mt-2 text-xs text-muted-foreground">
            Lý do huỷ: {order.cancelReason}
          </p>
        )}

        {!confirming ? (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Link
              href={`/orders/${order.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Chi tiết
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>

            {canReview && (
              <Link
                href="/account/reviews/pending"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
              >
                <Star className="h-3.5 w-3.5" aria-hidden />
                Đánh giá
              </Link>
            )}

            {canPay && (
              <Link
                href={`/orders/${order.id}/payment`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-accent)] px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <QrCode className="h-3.5 w-3.5" aria-hidden />
                Thanh toán
              </Link>
            )}

            {canCancel && (
              <button
                type="button"
                onClick={() => {
                  setConfirming(true)
                  setError(null)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Huỷ đơn
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-border bg-gray-50/60 p-4">
            <p className="mb-2 text-sm font-semibold text-gray-800">
              Bạn chắc chắn muốn huỷ đơn này?
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Sản phẩm sẽ được hoàn lại kho. Chọn lý do (không bắt buộc):
            </p>

            <div className="mb-2 flex flex-wrap gap-1.5">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    reason === r
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-white text-gray-600 ring-1 ring-border hover:bg-gray-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Lý do khác..."
              className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
            />

            {error && (
              <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-[var(--color-danger)]">
                <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={cancelling}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Xác nhận huỷ
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={cancelling}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Quay lại
              </button>
            </div>
          </div>
        )}
      </footer>
    </article>
  )
}
