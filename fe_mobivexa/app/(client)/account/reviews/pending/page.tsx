import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function PendingReviewsPage() {
  return (
    <PagePlaceholder
      title="Chờ đánh giá"
      endpoint="GET /users/me/reviews/pending · reviewApi.pending()"
      todos={[
        'Danh sách order item đã giao chưa đánh giá',
        'Nút viết đánh giá → reviewApi.create(orderItemId, ...)',
      ]}
    />
  )
}
