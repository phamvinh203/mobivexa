import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminPaymentPage() {
  return (
    <PagePlaceholder
      title="Giám sát thanh toán SePay"
      description="Theo dõi webhook chuyển khoản & đối soát đơn hàng."
      endpoint="POST /webhooks/sepay (server-to-server)"
      todos={[
        'Feed giao dịch realtime (cần endpoint log riêng — chưa có)',
        'Đối chiếu giao dịch sai nội dung với đơn hàng',
        'Ghi chú: webhook do SePay gọi, FE chỉ hiển thị log',
      ]}
    />
  )
}
