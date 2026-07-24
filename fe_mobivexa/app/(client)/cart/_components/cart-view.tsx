'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Loader2,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import { ApiError } from '@/lib/api/http'
import { useCart } from '@/lib/cart/cart-context'
import { formatVND } from '@/lib/utils/format'
import { CartItemRow } from './cart-item-row'

export function CartView() {
  const { cart, loading, error, clear, refresh } = useCart()
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">Đang tải giỏ hàng...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-white py-16 text-center">
        <TriangleAlert className="h-9 w-9 text-[var(--color-danger)]" aria-hidden />
        <p className="font-semibold text-gray-800">{error}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
        >
          Thử lại
        </button>
      </div>
    )
  }

  const items = cart?.items ?? []

  if (items.length === 0) {
    return (
      <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-white py-16 text-center">
        <ShoppingCart className="h-10 w-10 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-semibold text-gray-800">Giỏ hàng đang trống</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Khám phá hàng trăm mẫu điện thoại chính hãng đang giảm giá.
          </p>
        </div>
        <Link
          href="/products"
          className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-accent)] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Mua sắm ngay
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    )
  }

  // Backend không trả tổng tiền — tính từ salePrice của variant (giá sống,
  // cart item không snapshot giá).
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.variant.salePrice) * item.quantity,
    0,
  )
  const savings = items.reduce(
    (sum, item) =>
      sum +
      Math.max(
        0,
        Number(item.variant.originalPrice) - Number(item.variant.salePrice),
      ) *
        item.quantity,
    0,
  )
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)

  // Chặn đi tiếp nếu có dòng chắc chắn sẽ bị backend từ chối khi đặt hàng.
  const blocking = items.filter(
    (item) =>
      !item.variant.isActive ||
      item.variant.stock <= 0 ||
      item.quantity > item.variant.stock,
  )

  async function handleClear() {
    setClearing(true)
    setClearError(null)
    try {
      await clear()
    } catch (err) {
      setClearError(
        err instanceof ApiError ? err.message : 'Không xoá được giỏ hàng',
      )
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      {/* ── Danh sách sản phẩm ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-white px-5">
        <header className="flex items-center justify-between border-b border-border py-4">
          <h2 className="font-bold text-gray-900">
            {items.length} sản phẩm
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({totalUnits} món)
            </span>
          </h2>
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={clearing}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-[var(--color-danger)] disabled:opacity-50"
          >
            {clearing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
            Xoá tất cả
          </button>
        </header>

        {clearError && (
          <p role="alert" className="pt-3 text-sm text-[var(--color-danger)]">
            {clearError}
          </p>
        )}

        <ul className="divide-y divide-border">
          {items.map((item) => (
            <CartItemRow key={item.id} item={item} />
          ))}
        </ul>
      </section>

      {/* ── Tóm tắt đơn ──────────────────────────────────────────────────── */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-6">
        <div className="rounded-2xl border border-border bg-white p-5">
          <h2 className="mb-4 font-bold text-gray-900">Tóm tắt đơn hàng</h2>

          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tạm tính</dt>
              <dd className="font-medium">{formatVND(subtotal)}</dd>
            </div>
            {savings > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tiết kiệm</dt>
                <dd className="font-medium text-[var(--color-sale)]">
                  −{formatVND(savings)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phí vận chuyển</dt>
              <dd className="font-medium text-[var(--color-success)]">Miễn phí</dd>
            </div>
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
            <span className="font-semibold text-gray-900">Tổng cộng</span>
            <span className="text-xl font-black text-[var(--color-sale-strong)]">
              {formatVND(subtotal)}
            </span>
          </div>

          {blocking.length > 0 && (
            <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-[var(--color-danger)]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
              Có {blocking.length} sản phẩm hết hàng hoặc vượt tồn kho. Hãy xoá
              hoặc giảm số lượng trước khi thanh toán.
            </p>
          )}

          {blocking.length > 0 ? (
            <button
              type="button"
              disabled
              className="mt-4 w-full cursor-not-allowed rounded-xl bg-gray-200 py-3 text-sm font-bold text-gray-500"
            >
              Tiến hành thanh toán
            </button>
          ) : (
            <Link
              href="/checkout"
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-accent)] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Tiến hành thanh toán
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}

          <Link
            href="/products"
            className="mt-2 block w-full rounded-xl border border-border py-2.5 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Tiếp tục mua sắm
          </Link>
        </div>

        <ul className="flex flex-col gap-2.5 rounded-2xl border border-border bg-white p-4 text-xs text-gray-600">
          {[
            { icon: ShieldCheck, text: 'Bảo hành chính hãng 12 tháng' },
            { icon: Truck, text: 'Miễn phí giao hàng toàn quốc' },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2">
              <Icon
                className="h-4 w-4 flex-shrink-0 text-[var(--color-primary)]"
                aria-hidden
              />
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
