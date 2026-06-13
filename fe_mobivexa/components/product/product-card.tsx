import Link from 'next/link'
import Image from 'next/image'
import type { Product } from '@/features/products/types'
import { coverImageUrl } from '@/features/products/utils'
import { formatVND, discountPercent } from '@/lib/utils/format'

/** Card sản phẩm dùng lại ở homepage, listing, category, brand */
export function ProductCard({ product }: { product: Product }) {
  const cover = coverImageUrl(product)
  // Lấy variant rẻ nhất để hiển thị giá "từ ..."
  const variant = product.variants?.[0]
  const discount = variant
    ? discountPercent(variant.originalPrice, variant.salePrice)
    : 0

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-all hover:shadow-md"
    >
      <div className="relative aspect-square bg-muted flex items-center justify-center p-4">
        {discount > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">
            -{discount}%
          </span>
        )}
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-4 transition-transform group-hover:scale-105"
          />
        ) : (
          <span className="text-muted-foreground text-sm">Không có ảnh</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.brand && (
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {product.brand.name}
          </div>
        )}
        <h3 className="text-sm font-medium line-clamp-2 min-h-10 leading-snug">
          {product.name}
        </h3>
        {variant && (
          <div className="mt-auto flex items-baseline gap-2">
            <span className="text-destructive font-bold">
              {formatVND(variant.salePrice)}
            </span>
            {discount > 0 && (
              <span className="text-xs text-muted-foreground line-through">
                {formatVND(variant.originalPrice)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
