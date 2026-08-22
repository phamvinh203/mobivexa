import Link from 'next/link'
import { ProductCard } from '@/components/product/product-card'
import { FilterPanel, type FacetData } from '@/components/product/filter-panel'
import { ProductControls } from '@/components/product/product-controls'
import { LinkPagination } from '@/components/ui/link-pagination'
import { EmptyBox } from '@/components/ui/empty-box'
import type { Product } from '@/features/products/types'
import type { PaginationMeta } from '@/types/api'
import {
  PRODUCTS_BASE,
  buildHref,
  hasActiveFilters,
  type ProductFilters,
  type LockedFacet,
} from '@/features/products/filters'

interface ProductBrowserProps {
  filters: ProductFilters
  facets: FacetData
  products: Product[]
  pagination: PaginationMeta
  /** Query sản phẩm thất bại → hiện thông báo lỗi thay vì "không tìm thấy" */
  loadFailed?: boolean
  /** Route gốc để dựng link filter (mặc định /products) */
  basePath?: string
  /** Facet do route quyết định (vd /brands/apple khoá brand) */
  locked?: LockedFacet
  /** Thông báo khi chưa lọc gì mà vẫn rỗng — tuỳ ngữ cảnh trang */
  emptyMessage?: string
}

/**
 * Thân trang duyệt sản phẩm: sidebar lọc + thanh điều khiển + lưới + phân trang.
 * Dùng chung cho /products, /categories/[slug], /brands/[slug] — ba trang chỉ
 * khác nhau ở phần hero/breadcrumb và facet bị khoá.
 */
export function ProductBrowser({
  filters,
  facets,
  products,
  pagination,
  loadFailed = false,
  basePath = PRODUCTS_BASE,
  locked,
  emptyMessage = 'Danh mục này hiện chưa có sản phẩm nào.',
}: ProductBrowserProps) {
  const filtered = hasActiveFilters(filters, locked)

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* ── Sidebar (desktop) ──────────────────────────────────────────────── */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 rounded-2xl border border-border bg-white p-4">
          <FilterPanel
            filters={filters}
            facets={facets}
            basePath={basePath}
            locked={locked}
          />
        </div>
      </aside>

      {/* ── Kết quả ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <ProductControls
          filters={filters}
          facets={facets}
          total={pagination.total}
          basePath={basePath}
          locked={locked}
        />

        {loadFailed ? (
          <EmptyBox
            title="Không tải được danh sách sản phẩm"
            hint="Vui lòng thử lại sau ít phút."
          />
        ) : products.length === 0 ? (
          <EmptyBox
            title="Không tìm thấy sản phẩm nào"
            hint={filtered ? 'Thử bỏ bớt bộ lọc hoặc mở rộng khoảng giá.' : emptyMessage}
            action={
              filtered ? (
                <Link
                  href={basePath}
                  className="mt-2 rounded-xl border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
                >
                  Xoá tất cả bộ lọc
                </Link>
              ) : undefined
            }
          />
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
              hrefFor={(page) => buildHref(filters, { page }, basePath, locked)}
            />
          </>
        )}
      </div>
    </div>
  )
}
