import { RouteGuard } from '@/components/layout/route-guard'
import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default async function MyOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <RouteGuard>
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <PagePlaceholder
          title="Chi tiết đơn hàng"
          description={`Đơn #${id}`}
          endpoint="GET /orders/:id · orderApi.getMine(id)"
          todos={[
            'Tracker trạng thái + sản phẩm + địa chỉ',
            'Nút huỷ đơn (orderApi.cancel) khi còn PENDING',
          ]}
        />
      </div>
    </RouteGuard>
  )
}
