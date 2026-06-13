import Link from 'next/link'
import type { Product } from '@/features/products/types'
import { formatVND, discountPercent } from '@/lib/utils/format'

/** Card sản phẩm dùng lại ở homepage, listing, category, brand */
export function ProductCard({ product }: { product: Product }) {
  const cover =
    product.images?.find((i) => i.isCover)?.url ?? product.images?.[0]?.url
  // Lấy variant rẻ nhất để hiển thị giá "từ ..."
  const variant = product.variants?.[0]
  const discount = variant
    ? discountPercent(variant.originalPrice, variant.salePrice)
    : 0

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group bg-white rounded-xl border border-[var(--color-border)] overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-gray-50 grid place-items-center p-4">
        {discount > 0 && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[var(--color-danger)] text-white text-[11px] font-bold">
            -{discount}%
          </span>
        )}
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={product.name}
            className="max-h-full object-contain group-hover:scale-105 transition-transform"
          />
        ) : (
          <span className="text-gray-300 text-sm">Không có ảnh</span>
        )}
      </div>

      <div className="p-3">
        {product.brand && (
          <div className="text-[11px] uppercase tracking-wide text-gray-400">
            {product.brand.name}
          </div>
        )}
        <h3 className="text-sm font-medium line-clamp-2 min-h-10">{product.name}</h3>
        {variant && (
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[var(--color-danger)] font-bold">
              {formatVND(variant.salePrice)}
            </span>
            {discount > 0 && (
              <span className="text-xs text-gray-400 line-through">
                {formatVND(variant.originalPrice)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
