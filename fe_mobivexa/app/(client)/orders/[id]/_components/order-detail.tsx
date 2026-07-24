'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Banknote,
  Loader2,
  MapPin,
  Package,
  PackageX,
  QrCode,
  Star,
  StickyNote,
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
import { CANCEL_REASONS, canCancelOrder } from '../../_lib/cancel'
import { OrderStatusTracker } from './order-status-tracker'

interface LoadState {
  key: number
  order: Order | null
  error: string | null
  notFound: boolean
}

export function OrderDetail({ id }: { id: string }) {
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<LoadState>({
    key: -1,
    order: null,
    error: null,
    notFound: false,
  })

  // Trạng thái huỷ đơn
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const loading = state.key !== nonce

  useEffect(() => {
    let cancelled = false
    orderApi
      .getMine(id)
      .then((order) => {
        if (!cancelled) setState({ key: nonce, order, error: null, notFound: false })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // 404 = đơn không tồn tại hoặc không thuộc về mình → màn hình riêng
        const notFound = err instanceof ApiError && err.status === 404
        setState({
          key: nonce,
          order: null,
          notFound,
          error: notFound
            ? null
            : err instanceof ApiError
              ? err.message
              : 'Không tải được đơn hàng',
        })
      })
    return () => {
      cancelled = true
    }
  }, [id, nonce])

  async function cancel() {
    setCancelling(true)
    setCancelError(null)
    try {
      const updated = await orderApi.cancel(id, reason.trim() || undefined)
      setState((prev) => ({ ...prev, order: updated }))
      setConfirming(false)
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : 'Không huỷ được đơn hàng')
    } finally {
      setCancelling(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">Đang tải đơn hàng...</p>
      </div>
    )
  }

  // ── Không tìm thấy ───────────────────────────────────────────────────────────
  if (state.notFound) {
    return (
      <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-white py-16 text-center">
        <PackageX className="h-10 w-10 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-semibold text-gray-800">Không tìm thấy đơn hàng</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Đơn hàng không tồn tại hoặc không thuộc về tài khoản của bạn.
          </p>
        </div>
        <Link
          href="/orders"
          className="mt-1 rounded-xl border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
        >
          Về danh sách đơn hàng
        </Link>
      </div>
    )
  }

  // ── Lỗi khác ─────────────────────────────────────────────────────────────────
  if (state.error || !state.order) {
    return (
      <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-white py-16 text-center">
        <TriangleAlert className="h-9 w-9 text-[var(--color-danger)]" aria-hidden />
        <p className="font-semibold text-gray-800">
          {state.error ?? 'Không tải được đơn hàng'}
        </p>
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          className="rounded-xl border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
        >
          Thử lại
        </button>
      </div>
    )
  }

  const order = state.order
  const status = ORDER_STATUS_META[order.status]
  const payStatus = PAYMENT_STATUS_META[order.paymentStatus]
  const payMethod = PAYMENT_METHOD_META[order.paymentMethod]

  const canCancel = canCancelOrder(order)
  const canPay =
    order.paymentMethod === 'BANK_TRANSFER' &&
    order.paymentStatus === 'UNPAID' &&
    order.status !== OrderStatus.CANCELLED
  const canReview = order.status === OrderStatus.DELIVERED

  const discount = Number(order.discount)
  const shippingFee = Number(order.shippingFee)
  const address = [
    order.shippingDetail,
    order.shippingWard,
    order.shippingDistrict,
    order.shippingProvince,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-bold text-gray-900">
            <span className="font-mono">{order.orderCode}</span>
            {status && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.badgeClass}`}
              >
                {status.label}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Đặt lúc {formatDateTime(order.createdAt)}
          </p>
        </div>
      </div>

      {/* ── Tracker ────────────────────────────────────────────────────────── */}
      <OrderStatusTracker order={order} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* ── Cột trái: sản phẩm + ghi chú ─────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <section className="overflow-hidden rounded-2xl border border-border bg-white">
            <h2 className="border-b border-border px-5 py-3.5 font-bold text-gray-900">
              Sản phẩm ({order.items.length})
            </h2>
            <ul className="divide-y divide-border px-5">
              {order.items.map((item) => {
                const variant = [
                  item.storage,
                  item.ram && `${item.ram} RAM`,
                  item.color,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <li key={item.id} className="flex items-start gap-3 py-4">
                    <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg border border-border bg-gray-50 text-muted-foreground">
                      <Package className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {item.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {variant && `${variant} · `}
                        <span className="font-mono">{item.sku}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatVND(item.unitPrice)} × {item.quantity}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-sm font-semibold">
                      {formatVND(item.subtotal)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          {order.note && (
            <section className="rounded-2xl border border-border bg-white p-5">
              <h2 className="mb-2 flex items-center gap-2 font-bold text-gray-900">
                <StickyNote className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
                Ghi chú
              </h2>
              <p className="whitespace-pre-line text-sm text-gray-600">{order.note}</p>
            </section>
          )}
        </div>

        {/* ── Cột phải: địa chỉ + thanh toán + tổng tiền + hành động ────────── */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
          {/* Địa chỉ giao hàng */}
          <section className="rounded-2xl border border-border bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
              <MapPin className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
              Địa chỉ nhận hàng
            </h2>
            <p className="text-sm font-semibold text-gray-900">
              {order.shippingName}
              <span className="ml-2 font-normal text-muted-foreground">
                {order.shippingPhone}
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-600">{address}</p>
          </section>

          {/* Thanh toán */}
          <section className="rounded-2xl border border-border bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
              <Banknote className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
              Thanh toán
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Phương thức</dt>
                <dd className="font-medium">{payMethod?.label}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Trạng thái</dt>
                <dd>
                  {payStatus && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${payStatus.badgeClass}`}
                    >
                      {payStatus.label}
                    </span>
                  )}
                </dd>
              </div>
              {order.paidAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Thời điểm</dt>
                  <dd className="font-medium">{formatDateTime(order.paidAt)}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Tổng tiền */}
          <section className="rounded-2xl border border-border bg-white p-5">
            <h2 className="mb-3 font-bold text-gray-900">Tổng tiền</h2>
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tạm tính</dt>
                <dd className="font-medium">{formatVND(order.subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Giảm giá</dt>
                  <dd className="font-medium text-[var(--color-sale)]">
                    −{formatVND(discount)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Phí vận chuyển</dt>
                <dd className="font-medium">
                  {shippingFee > 0 ? (
                    formatVND(shippingFee)
                  ) : (
                    <span className="text-[var(--color-success)]">Miễn phí</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="font-semibold text-gray-900">Thành tiền</span>
              <span className="text-xl font-black text-[var(--color-sale-strong)]">
                {formatVND(order.total)}
              </span>
            </div>
          </section>

          {/* Hành động */}
          {(canPay || canReview || canCancel) && (
            <div className="flex flex-col gap-2">
              {canPay && (
                <Link
                  href={`/orders/${order.id}/payment`}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-accent)] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                  <QrCode className="h-4 w-4" aria-hidden />
                  Thanh toán ngay
                </Link>
              )}

              {canReview && (
                <Link
                  href="/account/reviews/pending"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-primary)] py-2.5 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
                >
                  <Star className="h-4 w-4" aria-hidden />
                  Đánh giá sản phẩm
                </Link>
              )}

              {canCancel && !confirming && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(true)
                    setCancelError(null)
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Huỷ đơn hàng
                </button>
              )}
            </div>
          )}

          {/* Panel xác nhận huỷ */}
          {canCancel && confirming && (
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="mb-1 text-sm font-semibold text-gray-800">
                Xác nhận huỷ đơn?
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

              {cancelError && (
                <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-[var(--color-danger)]">
                  <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                  {cancelError}
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
        </aside>
      </div>
    </div>
  )
}
