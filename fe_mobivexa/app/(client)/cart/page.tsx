import { RouteGuard } from '@/components/layout/route-guard'
import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function CartPage() {
  return (
    <RouteGuard>
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <PagePlaceholder
          title="Giỏ hàng"
          endpoint="GET /cart · cartApi.get()"
          todos={[
            'Danh sách item + chỉnh số lượng (cartApi.updateItem)',
            'Xoá item (removeItem) / xoá tất cả (clear)',
            'Tóm tắt đơn + nút tới /checkout',
          ]}
        />
      </div>
    </RouteGuard>
  )
}
