import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, PackageSearch } from 'lucide-react'
import { productApi } from '@/features/products/api'
import { categoryApi } from '@/features/categories/api'
import { brandApi } from '@/features/brands/api'
import { tagApi } from '@/features/tags/api'
import { ProductCard } from '@/components/product/product-card'
import { LinkPagination } from '@/components/ui/link-pagination'
import type { Product } from '@/features/products/types'
import type { PaginationMeta } from '@/types/api'
import { FilterPanel, type FacetData } from './_components/filter-panel'
import { ProductControls } from './_components/product-controls'
import {
  buildHref,
  parseFilters,
  hasActiveFilters,
  type ProductFilters,
} from './_lib/filters'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Tất cả sản phẩm · Mobivexa',
  description:
    'Danh sách điện thoại và phụ kiện chính hãng tại Mobivexa — lọc theo danh mục, thương hiệu, khoảng giá.',
}

/**
 * Backend public KHÔNG lọc được isFeatured (product.service.ts chỉ xử lý
 * isFeatured trong nhánh admin), nên ?featured=true phải đi qua endpoint riêng
 * /products/featured. Endpoint đó trả tối đa 8 sản phẩm và không phân trang.
 */
async function loadProducts(
  filters: ProductFilters,
): Promise<{ products: Product[]; pagination: PaginationMeta }> {
  if (filters.featured) {
    const products = await productApi.featured()
    return {
      products,
      pagination: {
        page: 1,
        limit: products.length || 1,
        total: products.length,
        totalPages: 1,
      },
    }
  }

  return productApi.listPaged({
    page: filters.page,
    search: filters.search,
    category: filters.category,
    brand: filters.brand,
    tag: filters.tag,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    sort: filters.sort,
  })
}

export default async function ProductListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseFilters(await searchParams)

  // Facet (danh mục/hãng/nhãn) hỏng thì vẫn phải hiện được lưới sản phẩm.
  const [productsR, categoriesR, brandsR, tagsR] = await Promise.allSettled([
    loadProducts(filters),
    categoryApi.list(),
    brandApi.list(),
    tagApi.list(),
  ])

  const { products, pagination } =
    productsR.status === 'fulfilled'
      ? productsR.value
      : {
          products: [] as Product[],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
        }

  const facets: FacetData = {
    categories: categoriesR.status === 'fulfilled' ? categoriesR.value : [],
    brands: brandsR.status === 'fulfilled' ? brandsR.value : [],
    tags: tagsR.status === 'fulfilled' ? tagsR.value : [],
  }

  const loadFailed = productsR.status === 'rejected'
  const filtered = hasActiveFilters(filters)

  return (
    <div className="bg-[#f2f5f6] pb-10">
      <div className="mx-auto max-w-[1280px] px-6 py-6">
        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex items-center gap-1 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-[var(--color-primary)]">
                Trang chủ
              </Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <li aria-current="page" className="font-medium text-gray-700">
              Sản phẩm
            </li>
          </ol>
        </nav>

        <h1 className="mb-5 text-2xl font-bold text-gray-900">
          {filters.search
            ? `Kết quả cho "${filters.search}"`
            : filters.featured
              ? 'Sản phẩm nổi bật'
              : 'Tất cả sản phẩm'}
        </h1>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* ── Sidebar (desktop) ────────────────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-2xl border border-border bg-white p-4">
              <FilterPanel filters={filters} facets={facets} />
            </div>
          </aside>

          {/* ── Kết quả ──────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            <ProductControls
              filters={filters}
              facets={facets}
              total={pagination.total}
            />

            {loadFailed ? (
              <div className="grid place-items-center gap-2 rounded-2xl border border-border bg-white py-16 text-center">
                <PackageSearch className="h-9 w-9 text-muted-foreground" aria-hidden />
                <p className="font-semibold text-gray-800">
                  Không tải được danh sách sản phẩm
                </p>
                <p className="text-sm text-muted-foreground">
                  Vui lòng thử lại sau ít phút.
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-2xl border border-border bg-white py-16 text-center">
                <PackageSearch className="h-9 w-9 text-muted-foreground" aria-hidden />
                <p className="font-semibold text-gray-800">
                  Không tìm thấy sản phẩm nào
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {filtered
                    ? 'Thử bỏ bớt bộ lọc hoặc mở rộng khoảng giá.'
                    : 'Danh mục này hiện chưa có sản phẩm nào.'}
                </p>
                {filtered && (
                  <Link
                    href="/products"
                    className="mt-2 rounded-xl border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
                  >
                    Xoá tất cả bộ lọc
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                <LinkPagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  hrefFor={(page) => buildHref(filters, { page })}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
