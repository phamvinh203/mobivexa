import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8">
      <PagePlaceholder
        title="Sản phẩm theo danh mục"
        description={`slug: ${slug}`}
        endpoint="categoryApi.getBySlug(slug) + productApi.list({ category: slug })"
        todos={['Hero danh mục + filter sidebar + lưới sản phẩm']}
      />
    </div>
  )
}
