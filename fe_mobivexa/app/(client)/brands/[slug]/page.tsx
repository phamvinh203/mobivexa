import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8">
      <PagePlaceholder
        title="Sản phẩm theo thương hiệu"
        description={`slug: ${slug}`}
        endpoint="brandApi.getBySlug(slug) + productApi.list({ brand: slug })"
        todos={['Hero thương hiệu + filter sidebar + lưới sản phẩm']}
      />
    </div>
  )
}
