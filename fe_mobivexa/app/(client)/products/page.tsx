import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ProductBrowser } from '@/components/product/product-browser'
import { loadBrowseData } from '@/features/products/browse'
import { parseFilters } from '@/features/products/filters'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Tất cả sản phẩm · Mobivexa',
  description:
    'Danh sách điện thoại và phụ kiện chính hãng tại Mobivexa — lọc theo danh mục, thương hiệu, khoảng giá.',
}

export default async function ProductListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseFilters(await searchParams)
  const { products, pagination, facets, loadFailed } = await loadBrowseData(filters)

  return (
    <div className="bg-[#f2f5f6] pb-10">
      <div className="mx-auto max-w-[1280px] px-6 py-6">
        <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Sản phẩm' }]} />

        <h1 className="mb-5 text-2xl font-bold text-gray-900">
          {filters.search
            ? `Kết quả cho "${filters.search}"`
            : filters.featured
              ? 'Sản phẩm nổi bật'
              : 'Tất cả sản phẩm'}
        </h1>

        <ProductBrowser
          filters={filters}
          facets={facets}
          products={products}
          pagination={pagination}
          loadFailed={loadFailed}
        />
      </div>
    </div>
  )
}
