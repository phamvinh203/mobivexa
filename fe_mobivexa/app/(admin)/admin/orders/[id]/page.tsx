import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <PagePlaceholder
      title="Chi tiết đơn hàng"
      description={`Đơn #${id}`}
      endpoint="GET /admin/orders/:id · adminOrderApi.get()"
      todos={[
        'Layout 3 cột: sản phẩm / khách & vận chuyển / hành động',
        'Cập nhật trạng thái (updateStatus) & thanh toán (updatePayment)',
      ]}
    />
  )
}
