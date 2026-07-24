'use client'

import Link from 'next/link'
import { ArrowRight, CircleCheck, QrCode, Truck } from 'lucide-react'
import { formatVND } from '@/lib/utils/format'
import type { Order } from '@/features/orders/types'

/** Màn hình sau khi đặt hàng thành công. Giỏ hàng lúc này đã bị backend xoá
 *  (createOrder tự clear cart khi không truyền items), nên không quay lại
 *  form checkout được nữa — điều hướng tiếp bằng các link dưới đây. */
export function OrderSuccess({ order }: { order: Order }) {
  const isBankTransfer = order.paymentMethod === 'BANK_TRANSFER'

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-border bg-white p-8 text-center">
        <CircleCheck
          className="mx-auto h-14 w-14 text-[var(--color-success)]"
          aria-hidden
        />
        <h2 className="mt-4 text-xl font-bold text-gray-900">Đặt hàng thành công</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cảm ơn bạn đã mua sắm tại Mobivexa.
        </p>

        <dl className="mt-6 divide-y divide-border rounded-xl border border-border text-sm">
          <div className="flex justify-between px-4 py-3">
            <dt className="text-muted-foreground">Mã đơn hàng</dt>
            <dd className="font-mono font-bold text-gray-900">{order.orderCode}</dd>
          </div>
          <div className="flex justify-between px-4 py-3">
            <dt className="text-muted-foreground">Tổng tiền</dt>
            <dd className="font-bold text-[var(--color-sale-strong)]">
              {formatVND(order.total)}
            </dd>
          </div>
          <div className="flex justify-between px-4 py-3">
            <dt className="text-muted-foreground">Thanh toán</dt>
            <dd className="font-medium">
              {isBankTransfer ? 'Chuyển khoản ngân hàng' : 'COD (khi nhận hàng)'}
            </dd>
          </div>
        </dl>

        {isBankTransfer ? (
          <>
            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Đơn chỉ được xử lý sau khi nhận được thanh toán. Vui lòng chuyển
              khoản với nội dung là mã đơn <strong>{order.orderCode}</strong>.
            </p>
            <Link
              href={`/orders/${order.id}/payment`}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-accent)] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <QrCode className="h-4 w-4" aria-hidden />
              Xem mã QR thanh toán
            </Link>
          </>
        ) : (
          <p className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary-light)] px-4 py-3 text-sm text-[var(--color-primary)]">
            <Truck className="h-4 w-4 flex-shrink-0" aria-hidden />
            Chúng tôi sẽ liên hệ xác nhận trước khi giao hàng.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/orders/${order.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Xem chi tiết đơn
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/products"
            className="flex flex-1 items-center justify-center rounded-xl border border-border py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Tiếp tục mua sắm
          </Link>
        </div>
      </div>
    </div>
  )
}
