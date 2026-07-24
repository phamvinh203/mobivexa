'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, Minus, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { ApiError } from '@/lib/api/http'
import { useCart } from '@/lib/cart/cart-context'
import { formatVND, discountPercent } from '@/lib/utils/format'
import { MAX_CART_QUANTITY, type CartItem } from '@/features/cart/types'

/** "256GB · 8GB RAM · Titan đen" */
function variantLabel(item: CartItem): string {
  const { color, storage, ram } = item.variant
  return [storage, ram && `${ram} RAM`, color].filter(Boolean).join(' · ')
}

export function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { variant } = item
  const product = variant.product
  const cover = product.images?.[0]?.url
  const unitPrice = Number(variant.salePrice)
  const lineTotal = unitPrice * item.quantity
  const discount = discountPercent(variant.originalPrice, variant.salePrice)

  // Tồn kho có thể tụt sau khi đã bỏ vào giỏ — backend sẽ chặn ở bước đặt hàng,
  // nên cảnh báo sớm tại đây.
  const outOfStock = variant.stock <= 0
  const overStock = !outOfStock && item.quantity > variant.stock
  const unavailable = !variant.isActive || outOfStock
  const maxQuantity = Math.min(variant.stock, MAX_CART_QUANTITY)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Thao tác không thành công',
      )
    } finally {
      setBusy(false)
    }
  }

  function changeQuantity(next: number) {
    if (next < 1 || next > maxQuantity || next === item.quantity) return
    void run(() => updateQuantity(item.id, next))
  }

  return (
    <li className="flex gap-4 py-5">
      <Link
        href={`/products/${product.slug}`}
        className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-white"
      >
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="96px"
            className="object-contain p-2"
          />
        ) : (
          <span className="grid h-full place-items-center text-xs text-muted-foreground">
            Không ảnh
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/products/${product.slug}`}
              className="line-clamp-2 font-semibold text-gray-900 hover:text-[var(--color-primary)]"
            >
              {product.name}
            </Link>
            {variantLabel(item) && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {variantLabel(item)}
              </p>
            )}
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {variant.sku}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void run(() => removeItem(item.id))}
            disabled={busy}
            aria-label={`Xoá ${product.name} khỏi giỏ hàng`}
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-[var(--color-danger)] disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {(unavailable || overStock) && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger)]">
            <TriangleAlert className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            {!variant.isActive
              ? 'Phiên bản này đã ngừng bán — vui lòng xoá khỏi giỏ'
              : outOfStock
                ? 'Sản phẩm đã hết hàng'
                : `Chỉ còn ${variant.stock} sản phẩm — hãy giảm số lượng`}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
          <div className="inline-flex items-center rounded-xl border border-border bg-white">
            <button
              type="button"
              onClick={() => changeQuantity(item.quantity - 1)}
              disabled={busy || item.quantity <= 1 || unavailable}
              aria-label="Giảm số lượng"
              className="grid h-9 w-9 place-items-center rounded-l-xl text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className="grid w-11 place-items-center text-sm font-semibold tabular-nums">
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                item.quantity
              )}
            </span>
            <button
              type="button"
              onClick={() => changeQuantity(item.quantity + 1)}
              disabled={busy || item.quantity >= maxQuantity || unavailable}
              aria-label="Tăng số lượng"
              className="grid h-9 w-9 place-items-center rounded-r-xl text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <div className="text-right">
            <div className="font-bold text-[var(--color-sale-strong)]">
              {formatVND(lineTotal)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatVND(unitPrice)}
              {discount > 0 && (
                <span className="ml-1.5 line-through">
                  {formatVND(variant.originalPrice)}
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}
