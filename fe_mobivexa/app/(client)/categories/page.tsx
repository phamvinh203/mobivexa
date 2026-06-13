import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function CategoriesPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8">
      <PagePlaceholder
        title="Tất cả danh mục"
        endpoint="GET /categories · categoryApi.list()"
        todos={['Lưới card danh mục + số sản phẩm']}
      />
    </div>
  )
}
