import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8">
      <PagePlaceholder
        title="Chi tiết sản phẩm"
        description={`slug: ${slug}`}
        endpoint="GET /products/:slug · productApi.getBySlug(slug)"
        todos={[
          'Gallery ảnh + chọn biến thể (màu/dung lượng)',
          'Thêm vào giỏ (cartApi.addItem)',
          'Tab mô tả / thông số / đánh giá (reviewApi.listByProduct + summary)',
        ]}
      />
    </div>
  )
}
