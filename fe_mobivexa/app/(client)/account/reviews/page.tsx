import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function MyReviewsPage() {
  return (
    <PagePlaceholder
      title="Đánh giá của tôi"
      endpoint="GET /users/me/reviews · reviewApi.myReviews()"
      todos={[
        'Tab: Đã đánh giá / Chờ đánh giá (link /account/reviews/pending)',
        'Sửa (reviewApi.update) / xoá (remove) đánh giá',
      ]}
    />
  )
}
