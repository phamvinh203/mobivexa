'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Truck,
  RefreshCcw,
  TriangleAlert,
} from 'lucide-react'
import { useCart } from '@/lib/cart/cart-context'
import { ApiError } from '@/lib/api/http'
import { resolveColor } from '@/lib/utils/color'
import { formatVND, discountPercent } from '@/lib/utils/format'
import type { ProductVariant } from '@/features/products/types'
import {
  isValueAvailable,
  isValueInStock,
  type DimensionGroup,
  type VariantDimension,
  type VariantSelection,
} from './variant-matrix'

/** Khớp giới hạn của validateAddItem bên backend (be_mobivexa/src/validators/cart.validator.ts) */
const MAX_QUANTITY_PER_ITEM = 100

interface ProductPurchaseProps {
  variants: ProductVariant[]
  dimensions: DimensionGroup[]
  selection: VariantSelection
  selectedVariant: ProductVariant | null
  onSelect: (dimension: VariantDimension, value: string) => void
}

type Status =
  | { kind: 'idle' }
  | { kind: 'adding' }
  | { kind: 'added' }
  | { kind: 'error'; message: string }

export function ProductPurchase({
  variants,
  dimensions,
  selection,
  selectedVariant,
  onSelect,
}: ProductPurchaseProps) {
  const router = useRouter()
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const stock = selectedVariant?.stock ?? 0
  const soldOut = !selectedVariant || stock <= 0
  // Backend chặn quantity > 100 (validateAddItem) → clamp sẵn để không dính 400.
  const maxQuantity = Math.max(1, Math.min(stock, MAX_QUANTITY_PER_ITEM))
  const discount = selectedVariant
    ? discountPercent(selectedVariant.originalPrice, selectedVariant.salePrice)
    : 0
  const saved = selectedVariant
    ? Number(selectedVariant.originalPrice) - Number(selectedVariant.salePrice)
    : 0

  function changeQuantity(delta: number) {
    setQuantity((q) => Math.min(maxQuantity, Math.max(1, q + delta)))
    setStatus({ kind: 'idle' })
  }

  function pick(dimension: VariantDimension, value: string) {
    onSelect(dimension, value)
    setQuantity(1)
    setStatus({ kind: 'idle' })
  }

  /** Thêm vào giỏ. Trả về true nếu thành công — "Mua ngay" dựa vào đó để điều hướng. */
  async function addToCart(): Promise<boolean> {
    if (!selectedVariant) return false
    setStatus({ kind: 'adding' })
    try {
      // Qua CartProvider để badge trên navbar cập nhật ngay, không chỉ gọi API.
      await addItem(selectedVariant.id, Math.min(quantity, maxQuantity))
      setStatus({ kind: 'added' })
      return true
    } catch (err) {
      // Giỏ hàng yêu cầu đăng nhập — 401 nghĩa là chưa có phiên hợp lệ.
      // Kiểm tra qua lỗi API thay vì auth state để không phụ thuộc thời điểm
      // AuthProvider load xong.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.push('/login')
        return false
      }
      setStatus({
        kind: 'error',
        message:
          err instanceof ApiError ? err.message : 'Không thêm được vào giỏ hàng',
      })
      return false
    }
  }

  async function buyNow() {
    if (await addToCart()) router.push('/checkout')
  }

  const busy = status.kind === 'adding'

  return (
    <div className="flex flex-col gap-5">
      {/* ── Giá ────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-[#fff6f2] to-white p-5">
        {selectedVariant ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-black tracking-tight text-[var(--color-sale-strong)]">
                {formatVND(selectedVariant.salePrice)}
              </span>
              {discount > 0 && (
                <>
                  <span className="text-base text-muted-foreground line-through">
                    {formatVND(selectedVariant.originalPrice)}
                  </span>
                  <span className="rounded-full bg-[var(--color-sale-strong)]/10 px-2 py-0.5 text-xs font-bold text-[var(--color-sale-strong)]">
                    -{discount}%
                  </span>
                </>
              )}
            </div>
            {saved > 0 && (
              <p className="mt-1.5 text-sm text-[var(--color-sale)]">
                Tiết kiệm {formatVND(saved)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Chọn phiên bản để xem giá
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 text-sm">
          {soldOut ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
              <TriangleAlert className="h-4 w-4" aria-hidden />
              Tạm hết hàng
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-success)]">
              <Check className="h-4 w-4" aria-hidden />
              Còn hàng
              {stock <= 5 && (
                <span className="font-normal text-[var(--color-warning)]">
                  · chỉ còn {stock} sản phẩm
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* ── Chọn phiên bản ─────────────────────────────────────────────────── */}
      {dimensions.map((group) => (
        <fieldset key={group.dimension}>
          <legend className="mb-2 text-sm font-semibold text-gray-800">
            {group.label}
            {selection[group.dimension] && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                {selection[group.dimension]}
              </span>
            )}
          </legend>

          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const selected = selection[group.dimension] === value
              const available = isValueAvailable(
                variants,
                dimensions,
                selection,
                group.dimension,
                value,
              )
              const inStock = isValueInStock(
                variants,
                dimensions,
                selection,
                group.dimension,
                value,
              )

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => pick(group.dimension, value)}
                  disabled={!available}
                  aria-pressed={selected}
                  title={
                    !available
                      ? 'Không có phiên bản này'
                      : !inStock
                        ? 'Hết hàng'
                        : undefined
                  }
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/15'
                      : 'border-border bg-white text-gray-700 hover:border-[var(--color-primary)]/60'
                  } ${!available ? 'cursor-not-allowed opacity-40' : ''} ${
                    available && !inStock ? 'line-through decoration-1' : ''
                  }`}
                >
                  {group.dimension === 'color' && (
                    <span
                      aria-hidden
                      className="h-4 w-4 flex-shrink-0 rounded-full border border-black/10 shadow-inner"
                      style={{ backgroundColor: resolveColor(value) }}
                    />
                  )}
                  {value}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}

      {/* ── Số lượng ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-gray-800">Số lượng</span>
        <div className="inline-flex items-center rounded-xl border border-border bg-white">
          <button
            type="button"
            onClick={() => changeQuantity(-1)}
            disabled={quantity <= 1 || soldOut}
            aria-label="Giảm số lượng"
            className="grid h-10 w-10 place-items-center rounded-l-xl text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <span
            aria-live="polite"
            className="w-12 text-center text-sm font-semibold tabular-nums"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => changeQuantity(1)}
            disabled={quantity >= maxQuantity || soldOut}
            aria-label="Tăng số lượng"
            className="grid h-10 w-10 place-items-center rounded-r-xl text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {selectedVariant && (
          <span className="text-xs text-muted-foreground">
            SKU {selectedVariant.sku}
          </span>
        )}
      </div>

      {/* ── Hành động ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={addToCart}
          disabled={soldOut || busy}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[var(--color-primary)] bg-white text-sm font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ShoppingCart className="h-4 w-4" aria-hidden />
          )}
          Thêm vào giỏ
        </button>
        <button
          type="button"
          onClick={buyNow}
          disabled={soldOut || busy}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-accent)] text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Mua ngay
        </button>
      </div>

      {/* Phản hồi sau khi bấm — aria-live để screen reader đọc được */}
      <div aria-live="polite" className="min-h-5">
        {status.kind === 'added' && (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-success)]">
            <Check className="h-4 w-4" aria-hidden />
            Đã thêm vào giỏ.
            <Link href="/cart" className="underline underline-offset-2">
              Xem giỏ hàng
            </Link>
          </p>
        )}
        {status.kind === 'error' && (
          <p className="inline-flex items-center gap-1.5 text-sm text-[var(--color-danger)]">
            <TriangleAlert className="h-4 w-4" aria-hidden />
            {status.message}
          </p>
        )}
      </div>

      {/* ── Cam kết ────────────────────────────────────────────────────────── */}
      <ul className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, text: 'Bảo hành chính hãng 12 tháng' },
          { icon: Truck, text: 'Miễn phí giao hàng toàn quốc' },
          { icon: RefreshCcw, text: 'Đổi trả trong 7 ngày' },
        ].map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2 text-xs text-gray-600">
            <Icon
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-primary)]"
              aria-hidden
            />
            {text}
          </li>
        ))}
      </ul>
    </div>
  )
}
