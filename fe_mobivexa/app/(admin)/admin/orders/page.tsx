import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminOrdersPage() {
  return (
    <PagePlaceholder
      title="Quản lý Đơn hàng"
      endpoint="GET /admin/orders · adminOrderApi.list()"
      todos={[
        'Bảng đơn + filter trạng thái/thanh toán/ngày',
        'Link tới chi tiết đơn',
      ]}
    />
  )
}
