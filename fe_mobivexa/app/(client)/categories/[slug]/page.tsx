import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { LayoutGrid } from 'lucide-react'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ProductBrowser } from '@/components/product/product-browser'
import { categoryApi } from '@/features/categories/api'
import { loadBrowseData } from '@/features/products/browse'
import { parseFilters } from '@/features/products/filters'
import type { Category } from '@/features/categories/types'

export const revalidate = 60

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// getBySlug ném lỗi khi 404 → trả null để cả metadata lẫn page cùng xử lý
const findCategory = (slug: string) =>
  categoryApi.getBySlug(slug).catch(() => null as Category | null)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const category = await findCategory(slug)
  if (!category) return { title: 'Không tìm thấy danh mục · Mobivexa' }

  return {
    title: `${category.name} · Mobivexa`,
    description:
      category.description ??
      `Mua ${category.name} chính hãng tại Mobivexa — giá tốt, bảo hành đầy đủ.`,
  }
}

export default async function CategoryDetailPage({ params, searchParams }: PageProps) {
  const [{ slug }, rawSearch] = await Promise.all([params, searchParams])

  const category = await findCategory(slug)
  if (!category || !category.isActive) notFound()

  // Danh mục nằm trong path chứ không phải query → ép vào filter trước khi query
  const filters = { ...parseFilters(rawSearch), category: slug }
  const { products, pagination, facets, loadFailed } = await loadBrowseData(filters)

  const parent = category.parentId
    ? facets.categories.find((c) => c.id === category.parentId)
    : undefined

  return (
    <div className="bg-[#f2f5f6] pb-10">
      <div className="mx-auto max-w-[1280px] px-6 py-6">
        <Breadcrumb
          items={[
            { label: 'Trang chủ', href: '/' },
            { label: 'Danh mục', href: '/categories' },
            ...(parent ? [{ label: parent.name, href: `/categories/${parent.slug}` }] : []),
            { label: category.name },
          ]}
        />

        {/* ── Hero danh mục ──────────────────────────────────────────────── */}
        <header className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-white p-5">
          <div className="relative grid h-20 w-20 flex-shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
            {category.imageUrl ? (
              <Image
                src={category.imageUrl}
                alt={category.name}
                fill
                sizes="80px"
                className="object-cover"
                priority
              />
            ) : (
              <LayoutGrid className="h-8 w-8 text-muted-foreground" aria-hidden />
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
            <p className="text-sm text-muted-foreground">
              {pagination.total} sản phẩm
            </p>
            {category.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {category.description}
              </p>
            )}
          </div>
        </header>

        {/* ── Danh mục con ───────────────────────────────────────────────── */}
        <SubCategories parentId={category.id} all={facets.categories} />

        <ProductBrowser
          filters={filters}
          facets={facets}
          products={products}
          pagination={pagination}
          loadFailed={loadFailed}
          basePath={`/categories/${slug}`}
          locked="category"
          emptyMessage="Danh mục này hiện chưa có sản phẩm nào."
        />
      </div>
    </div>
  )
}

function SubCategories({ parentId, all }: { parentId: string; all: Category[] }) {
  const children = all.filter((c) => c.parentId === parentId && c.isActive)
  if (children.length === 0) return null

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {children.map((child) => (
        <Link
          key={child.id}
          href={`/categories/${child.slug}`}
          className="rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-gray-600 ring-1 ring-border transition-colors hover:text-[var(--color-primary)]"
        >
          {child.name}
          {child._count?.products != null && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              {child._count.products}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}
