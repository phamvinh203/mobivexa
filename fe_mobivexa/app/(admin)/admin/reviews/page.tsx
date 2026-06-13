import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminReviewsPage() {
  return (
    <PagePlaceholder
      title="Quản lý Đánh giá"
      endpoint="GET /admin/reviews · adminReviewApi.list()"
      todos={[
        'Bảng review + filter sao/trạng thái phản hồi',
        'Modal trả lời review (adminReviewApi.reply)',
        'Xoá review (adminReviewApi.remove)',
      ]}
    />
  )
}
