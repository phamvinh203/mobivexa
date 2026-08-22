import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ProductBrowser } from '@/components/product/product-browser'
import { brandApi } from '@/features/brands/api'
import { loadBrowseData } from '@/features/products/browse'
import { parseFilters } from '@/features/products/filters'
import type { Brand } from '@/features/brands/types'

export const revalidate = 60

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// getBySlug ném lỗi khi 404 → trả null để cả metadata lẫn page cùng xử lý
const findBrand = (slug: string) =>
  brandApi.getBySlug(slug).catch(() => null as Brand | null)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const brand = await findBrand(slug)
  if (!brand) return { title: 'Không tìm thấy thương hiệu · Mobivexa' }

  return {
    title: `${brand.name} · Mobivexa`,
    description:
      brand.description ??
      `Điện thoại và phụ kiện ${brand.name} chính hãng tại Mobivexa — giá tốt, bảo hành đầy đủ.`,
  }
}

export default async function BrandDetailPage({ params, searchParams }: PageProps) {
  const [{ slug }, rawSearch] = await Promise.all([params, searchParams])

  const brand = await findBrand(slug)
  if (!brand || !brand.isActive) notFound()

  // Thương hiệu nằm trong path chứ không phải query → ép vào filter trước khi query
  const filters = { ...parseFilters(rawSearch), brand: slug }
  const { products, pagination, facets, loadFailed } = await loadBrowseData(filters)

  return (
    <div className="bg-[#f2f5f6] pb-10">
      <div className="mx-auto max-w-[1280px] px-6 py-6">
        <Breadcrumb
          items={[
            { label: 'Trang chủ', href: '/' },
            { label: 'Thương hiệu', href: '/brands' },
            { label: brand.name },
          ]}
        />

        {/* ── Hero thương hiệu ───────────────────────────────────────────── */}
        <header className="mb-6 flex items-center gap-5 rounded-2xl border border-border bg-white p-5">
          <div className="relative grid h-20 w-28 flex-shrink-0 place-items-center rounded-xl bg-muted">
            {brand.logoUrl ? (
              <Image
                src={brand.logoUrl}
                alt={brand.name}
                fill
                sizes="112px"
                className="object-contain p-2"
                priority
              />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">
                {brand.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{brand.name}</h1>
            <p className="text-sm text-muted-foreground">{pagination.total} sản phẩm</p>
            {brand.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {brand.description}
              </p>
            )}
          </div>
        </header>

        <ProductBrowser
          filters={filters}
          facets={facets}
          products={products}
          pagination={pagination}
          loadFailed={loadFailed}
          basePath={`/brands/${slug}`}
          locked="brand"
          emptyMessage="Thương hiệu này hiện chưa có sản phẩm nào."
        />
      </div>
    </div>
  )
}
