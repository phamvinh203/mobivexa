import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminDashboardPage() {
  return (
    <PagePlaceholder
      title="Dashboard"
      description="Tổng quan hệ thống — doanh thu, đơn hàng, tồn kho, đánh giá."
      todos={[
        'Card thống kê: tổng đơn / doanh thu hôm nay / sản phẩm sắp hết',
        'Biểu đồ doanh thu theo ngày',
        'Danh sách đơn mới nhất + review cần phản hồi',
      ]}
    />
  )
}
