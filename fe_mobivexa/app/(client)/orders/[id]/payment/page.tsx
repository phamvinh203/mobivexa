import { RouteGuard } from '@/components/layout/route-guard'
import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default async function OrderPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <RouteGuard>
      <div className="max-w-[900px] mx-auto px-6 py-8">
        <PagePlaceholder
          title="Thanh toán đơn hàng"
          description={`Đơn #${id} — chuyển khoản VietQR/SePay`}
          endpoint="GET /orders/:id/payment · paymentApi.getInfo(id)"
          todos={[
            'Hiển thị QR (qrUrl) + thông tin ngân hàng + nội dung CK',
            'Đếm ngược + polling trạng thái đơn (orderApi.getMine)',
            'Tự chuyển sang thành công khi paymentStatus = PAID',
          ]}
        />
      </div>
    </RouteGuard>
  )
}
