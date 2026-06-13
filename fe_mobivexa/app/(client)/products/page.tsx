import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function ProductsPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8">
      <PagePlaceholder
        title="Danh sách sản phẩm"
        endpoint="GET /products · productApi.list(query)"
        todos={[
          'Filter sidebar: danh mục, thương hiệu, giá, tag',
          'Lưới ProductCard + phân trang/sắp xếp',
        ]}
      />
    </div>
  )
}
