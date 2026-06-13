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
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {discount > 0 && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-md bg-sale-strong px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            -{discount}%
          </span>
        )}
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-5 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-muted-foreground text-sm">Không có ảnh</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {product.brand && (
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {product.brand.name}
          </div>
        )}
        <h3 className="text-[15px] font-medium line-clamp-2 min-h-11 leading-snug">
          {product.name}
        </h3>
        {variant && (
          <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-lg font-bold text-sale-strong">
              {formatVND(variant.salePrice)}
            </span>
            {discount > 0 && (
              <span className="text-sm text-muted-foreground line-through">
                {formatVND(variant.originalPrice)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
