'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Banknote, Loader2, QrCode, ShoppingCart, TriangleAlert } from 'lucide-react'
import { orderApi } from '@/features/orders/api'
import { userApi } from '@/features/users/api'
import { ApiError } from '@/lib/api/http'
import { useCart } from '@/lib/cart/cart-context'
import { formatVND } from '@/lib/utils/format'
import type { Address } from '@/features/users/types'
import type { Order } from '@/features/orders/types'
import type { PaymentMethod } from '@/types/api'
import { AddressPicker } from './address-picker'
import { OrderSuccess } from './order-success'

const PAYMENT_OPTIONS: {
  value: PaymentMethod
  label: string
  hint: string
  icon: typeof Banknote
}[] = [
  {
    value: 'COD',
    label: 'Thanh toán khi nhận hàng',
    hint: 'Trả tiền mặt cho shipper khi nhận được hàng',
    icon: Banknote,
  },
  {
    value: 'BANK_TRANSFER',
    label: 'Chuyển khoản ngân hàng',
    hint: 'Quét mã VietQR, đơn được xử lý sau khi nhận thanh toán',
    icon: QrCode,
  },
]

export function CheckoutView() {
  const { cart, loading: cartLoading, refresh } = useCart()

  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD')
  const [note, setNote] = useState('')

  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null)

  useEffect(() => {
    let cancelled = false
    // setState nằm trong callback của promise (không đồng bộ trong thân effect)
    // → tránh cascading render mà react-hooks/set-state-in-effect cảnh báo.
    userApi
      .listAddresses()
      .then((list) => {
        if (cancelled) return
        setAddresses(list)
        // Backend sort isDefault trước → phần tử đầu là địa chỉ mặc định
        setSelectedAddressId((current) => current ?? list[0]?.id ?? null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setAddresses([])
        setAddressError(
          err instanceof ApiError
            ? err.message
            : 'Không tải được danh sách địa chỉ',
        )
      })

    return () => {
      cancelled = true
    }
  }, [])

  const items = cart?.items ?? []

  // Đặt hàng xong thì giỏ đã bị xoá — phải kiểm tra state này TRƯỚC khi
  // rơi vào nhánh "giỏ trống", nếu không màn hình thành công sẽ biến mất.
  if (placedOrder) return <OrderSuccess order={placedOrder} />

  if (cartLoading || addresses === null) {
    return (
      <div className="grid min-h-[40vh] place-items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">Đang tải...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-white py-16 text-center">
        <ShoppingCart className="h-10 w-10 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-semibold text-gray-800">Giỏ hàng đang trống</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thêm sản phẩm vào giỏ trước khi thanh toán.
          </p>
        </div>
        <Link
          href="/products"
          className="mt-1 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-accent)] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Mua sắm ngay
        </Link>
      </div>
    )
  }

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.variant.salePrice) * item.quantity,
    0,
  )
  // Backend hardcode shippingFee = 0 và discount = 0 trong createOrder —
  // hiển thị đúng như vậy để tổng tiền khớp với đơn được tạo.
  const shippingFee = 0
  const total = subtotal + shippingFee

  const blocking = items.filter(
    (item) =>
      !item.variant.isActive ||
      item.variant.stock <= 0 ||
      item.quantity > item.variant.stock,
  )
  const canPlace =
    !!selectedAddressId && blocking.length === 0 && !placing && items.length > 0

  async function placeOrder() {
    if (!selectedAddressId) return
    setPlacing(true)
    setPlaceError(null)
    try {
      // KHÔNG truyền items → backend tự lấy từ giỏ, tính giá server-side và
      // xoá giỏ sau khi tạo đơn (xem createOrder trong order.service.ts).
      const order = await orderApi.create({
        addressId: selectedAddressId,
        paymentMethod,
        note: note.trim() || undefined,
      })
      setPlacedOrder(order)
      await refresh() // giỏ đã bị xoá server-side → đồng bộ lại badge
    } catch (err) {
      setPlaceError(
        err instanceof ApiError ? err.message : 'Đặt hàng không thành công',
      )
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="flex flex-col gap-4">
        {addressError && (
          <p
            role="alert"
            className="rounded-xl border border-[var(--color-danger)]/30 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            {addressError}
          </p>
        )}

        <AddressPicker
          addresses={addresses}
          selectedId={selectedAddressId}
          onSelect={setSelectedAddressId}
          onCreated={(address) => {
            setAddresses((prev) => [address, ...(prev ?? [])])
            setSelectedAddressId(address.id)
            setAddressError(null)
          }}
        />

        {/* ── Phương thức thanh toán ─────────────────────────────────────── */}
        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="mb-4 font-bold text-gray-900">Phương thức thanh toán</h2>
          <div className="flex flex-col gap-2">
            {PAYMENT_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
              const selected = paymentMethod === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  aria-pressed={selected}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                      : 'border-border hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                      selected
                        ? 'text-[var(--color-primary)]'
                        : 'text-muted-foreground'
                    }`}
                    aria-hidden
                  />
                  <span>
                    <span className="block font-semibold text-gray-900">{label}</span>
                    <span className="block text-sm text-muted-foreground">{hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Ghi chú ────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border bg-white p-5">
          <label htmlFor="order-note" className="mb-2 block font-bold text-gray-900">
            Ghi chú đơn hàng
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              (không bắt buộc)
            </span>
          </label>
          <textarea
            id="order-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ví dụ: giao giờ hành chính, gọi trước khi tới..."
            className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
          />
        </section>
      </div>

      {/* ── Tóm tắt + đặt hàng ───────────────────────────────────────────── */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-6">
        <div className="rounded-2xl border border-border bg-white p-5">
          <h2 className="mb-4 font-bold text-gray-900">
            Đơn hàng
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({items.length} sản phẩm)
            </span>
          </h2>

          <ul className="mb-4 flex max-h-72 flex-col gap-3 overflow-y-auto">
            {items.map((item) => {
              const cover = item.variant.product.images?.[0]?.url
              return (
                <li key={item.id} className="flex gap-3">
                  <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                    {cover && (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-contain p-1"
                      />
                    )}
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gray-700 px-1 text-[10px] font-bold text-white">
                      {item.quantity}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium text-gray-800">
                      {item.variant.product.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {[item.variant.storage, item.variant.color]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-sm font-semibold">
                    {formatVND(Number(item.variant.salePrice) * item.quantity)}
                  </span>
                </li>
              )
            })}
          </ul>

          <dl className="flex flex-col gap-2.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tạm tính</dt>
              <dd className="font-medium">{formatVND(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phí vận chuyển</dt>
              <dd className="font-medium text-[var(--color-success)]">Miễn phí</dd>
            </div>
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
            <span className="font-semibold text-gray-900">Tổng cộng</span>
            <span className="text-xl font-black text-[var(--color-sale-strong)]">
              {formatVND(total)}
            </span>
          </div>

          {blocking.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--color-danger)]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
              Có {blocking.length} sản phẩm hết hàng hoặc vượt tồn kho.{' '}
              <Link href="/cart" className="underline underline-offset-2">
                Sửa giỏ hàng
              </Link>
            </p>
          )}

          {!selectedAddressId && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--color-warning)]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
              Vui lòng chọn hoặc thêm địa chỉ giao hàng.
            </p>
          )}

          {placeError && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-1.5 text-sm text-[var(--color-danger)]"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              {placeError}
            </p>
          )}

          <button
            type="button"
            onClick={() => void placeOrder()}
            disabled={!canPlace}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-accent)] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300"
          >
            {placing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Đặt hàng
          </button>

          <Link
            href="/cart"
            className="mt-2 block w-full rounded-xl border border-border py-2.5 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Quay lại giỏ hàng
          </Link>
        </div>
      </aside>
    </div>
  )
}
