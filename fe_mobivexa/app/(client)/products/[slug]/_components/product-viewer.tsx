'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { StarRating } from '@/components/ui/star-rating'
import { discountPercent } from '@/lib/utils/format'
import { activeVariants, galleryImages, productTagList } from '@/features/products/utils'
import type { Product } from '@/features/products/types'
import type { ReviewSummary } from '@/features/reviews/types'
import { ProductGallery } from './product-gallery'
import { ProductPurchase } from './product-purchase'
import {
  buildDimensions,
  defaultVariant,
  matchVariant,
  reconcileSelection,
  selectionOf,
  type VariantDimension,
  type VariantSelection,
} from './variant-matrix'

interface ProductViewerProps {
  product: Product
  summary: ReviewSummary | null
}

/**
 * Nửa trên trang chi tiết: gallery + thông tin mua hàng.
 * Là Client Component vì gallery và bảng chọn phiên bản dùng chung state —
 * đổi màu phải đổi luôn ảnh đang xem.
 */
export function ProductViewer({ product, summary }: ProductViewerProps) {
  const variants = useMemo(() => activeVariants(product), [product])
  const dimensions = useMemo(() => buildDimensions(variants), [variants])
  const images = useMemo(() => galleryImages(product), [product])
  const tags = useMemo(() => productTagList(product), [product])

  const [selection, setSelection] = useState<VariantSelection>(() => {
    const fallback = defaultVariant(variants)
    return fallback ? selectionOf(fallback, buildDimensions(variants)) : {}
  })
  const [activeImage, setActiveImage] = useState(0)

  const selectedVariant = matchVariant(variants, dimensions, selection)
  const discount = selectedVariant
    ? discountPercent(selectedVariant.originalPrice, selectedVariant.salePrice)
    : 0

  function handleSelect(dimension: VariantDimension, value: string) {
    const next = reconcileSelection(variants, dimensions, selection, dimension, value)
    setSelection(next)

    // Đồng bộ ảnh: variant mới có ảnh riêng thì nhảy tới ảnh đó trong gallery.
    const variant = matchVariant(variants, dimensions, next)
    if (variant?.imageUrl) {
      const index = images.findIndex((img) => img.url === variant.imageUrl)
      if (index >= 0) setActiveImage(index)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <ProductGallery
          images={images}
          productName={product.name}
          activeIndex={Math.min(activeImage, Math.max(0, images.length - 1))}
          onSelect={setActiveImage}
          discount={discount}
        />
      </div>

      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-2.5">
          {product.brand && (
            <Link
              href={`/brands/${product.brand.slug}`}
              className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)] hover:underline"
            >
              {product.brand.name}
            </Link>
          )}

          <h1 className="text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">
            {product.name}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            {summary && summary.totalCount > 0 ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <StarRating value={Math.round(summary.averageRating)} />
                  <span className="font-semibold text-gray-800">
                    {summary.averageRating.toFixed(1)}
                  </span>
                </span>
                <a
                  href="#danh-gia"
                  className="text-muted-foreground underline-offset-2 hover:underline"
                >
                  {summary.totalCount} đánh giá
                </a>
              </>
            ) : (
              <span className="text-muted-foreground">Chưa có đánh giá</span>
            )}

            {tags.length > 0 && (
              <span className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/products?tag=${tag.slug}`}
                    className="rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)] hover:opacity-80"
                  >
                    {tag.name}
                  </Link>
                ))}
              </span>
            )}
          </div>
        </header>

        {variants.length > 0 ? (
          <ProductPurchase
            variants={variants}
            dimensions={dimensions}
            selection={selection}
            selectedVariant={selectedVariant}
            onSelect={handleSelect}
          />
        ) : (
          <p className="rounded-2xl border border-border bg-white p-5 text-sm text-muted-foreground">
            Sản phẩm hiện chưa mở bán phiên bản nào.
          </p>
        )}
      </div>
    </div>
  )
}
