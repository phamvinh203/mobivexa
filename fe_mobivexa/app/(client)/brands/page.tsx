import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function BrandsPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8">
      <PagePlaceholder
        title="Tất cả thương hiệu"
        endpoint="GET /brands · brandApi.list()"
        todos={['Lưới logo thương hiệu + số sản phẩm']}
      />
    </div>
  )
}
