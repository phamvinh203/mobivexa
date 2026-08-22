import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { productApi } from '@/features/products/api'
import { reviewApi } from '@/features/reviews/api'
import { activeVariants, coverImageUrl, priceRange } from '@/features/products/utils'
import { ApiError } from '@/lib/api/http'
import { formatVND } from '@/lib/utils/format'
import { htmlToLines } from '@/lib/utils/html'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ProductCard } from '@/components/product/product-card'
import type { Product } from '@/features/products/types'
import type { ProductReview, ReviewSummary } from '@/features/reviews/types'
import { ProductViewer } from './_components/product-viewer'
import { ProductTabs } from './_components/product-tabs'
import { DescriptionPanel } from './_components/description-panel'
import { SpecPanel } from './_components/spec-panel'
import { ReviewPanel } from './_components/review-panel'

// Catalog ít đổi theo giây — khớp revalidate của productApi.getBySlug.
export const revalidate = 60

/** 404 của backend là trạng thái hợp lệ (slug sai) → để notFound() xử lý. */
async function loadProduct(slug: string): Promise<Product | null> {
  try {
    return await productApi.getBySlug(slug)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await loadProduct(slug)
  if (!product) return { title: 'Không tìm thấy sản phẩm · Mobivexa' }

  const range = priceRange(activeVariants(product))
  const summary = htmlToLines(product.description)[0]?.text
  const description =
    summary ??
    [
      product.name,
      product.brand && `chính hãng ${product.brand.name}`,
      range && `giá từ ${formatVND(range.min)}`,
    ]
      .filter(Boolean)
      .join(', ')

  const cover = coverImageUrl(product)

  return {
    title: `${product.name} · Mobivexa`,
    description: description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: description.slice(0, 160),
      type: 'website',
      images: cover ? [{ url: cover }] : undefined,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await loadProduct(slug)
  if (!product) notFound()

  // Review và sản phẩm liên quan là phần phụ — hỏng thì trang vẫn phải mở được.
  const [summaryR, reviewsR, relatedR] = await Promise.allSettled([
    reviewApi.summary(slug),
    reviewApi.listByProduct(slug, { limit: 10, sort: 'helpful' }),
    product.category
      ? productApi.list({ category: product.category.slug, limit: 12 })
      : Promise.resolve([]),
  ])

  const summary: ReviewSummary | null =
    summaryR.status === 'fulfilled' ? summaryR.value : null
  const reviews: ProductReview[] =
    reviewsR.status === 'fulfilled' ? reviewsR.value : []
  const related = (relatedR.status === 'fulfilled' ? relatedR.value : [])
    .filter((p) => p.id !== product.id)
    .slice(0, 5)

  const variants = activeVariants(product)

  return (
    <div className="bg-[#f2f5f6] pb-10">
      <div className="mx-auto max-w-[1280px] px-6 py-6">
        <Breadcrumb
          items={[
            { label: 'Trang chủ', href: '/' },
            { label: 'Sản phẩm', href: '/products' },
            ...(product.category
              ? [{ label: product.category.name, href: `/categories/${product.category.slug}` }]
              : []),
            { label: product.name },
          ]}
        />

        <div className="flex flex-col gap-6">
          {/* ── Gallery + mua hàng ───────────────────────────────────────── */}
          <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <ProductViewer product={product} summary={summary} />
          </section>

          {/* ── Mô tả / Thông số / Đánh giá ──────────────────────────────── */}
          <section id="danh-gia" className="scroll-mt-6">
            <ProductTabs
              tabs={[
                {
                  id: 'mo-ta',
                  label: 'Mô tả sản phẩm',
                  content: <DescriptionPanel description={product.description} />,
                },
                {
                  id: 'thong-so',
                  label: 'Thông số & phiên bản',
                  content: <SpecPanel product={product} variants={variants} />,
                },
                {
                  id: 'danh-gia',
                  label: 'Đánh giá',
                  count: summary?.totalCount ?? 0,
                  content: <ReviewPanel summary={summary} reviews={reviews} />,
                },
              ]}
            />
          </section>

          {/* ── Sản phẩm liên quan ───────────────────────────────────────── */}
          {related.length > 0 && (
            <section>
              <header className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="block h-6 w-1 rounded-full bg-[var(--color-primary)]" />
                  <h2 className="text-lg font-bold text-gray-800">
                    Sản phẩm tương tự
                  </h2>
                </div>
                {product.category && (
                  <Link
                    href={`/categories/${product.category.slug}`}
                    className="inline-flex items-center gap-0.5 text-sm text-[var(--color-primary)] hover:underline"
                  >
                    Xem tất cả
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                )}
              </header>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {related.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
