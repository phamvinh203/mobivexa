import { RouteGuard } from '@/components/layout/route-guard'
import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function MyOrdersPage() {
  return (
    <RouteGuard>
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <PagePlaceholder
          title="Đơn hàng của tôi"
          endpoint="GET /orders · orderApi.listMine()"
          todos={[
            'Tab lọc theo trạng thái',
            'Card đơn + nút huỷ (orderApi.cancel) / thanh toán / đánh giá',
          ]}
        />
      </div>
    </RouteGuard>
  )
}
