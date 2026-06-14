import { ReviewStatus, type ListQuery, type PaginationMeta } from '@/types/api'

export interface ReviewPhoto {
  id: string
  reviewId: string
  url: string
  sortOrder: number
}

export interface Review {
  id: string
  orderItemId: string
  userId: string
  productId: string
  variantId: string | null
  rating: number // 1-5
  content: string
  status: ReviewStatus
  replyContent: string | null
  repliedAt: string | null
  createdAt: string
  updatedAt: string
  photos: ReviewPhoto[]
  user?: { id: string; fullName: string; avatarUrl: string | null }
  _count?: { helpful: number }
}

/** Review ở góc nhìn admin — include thêm product + email người review.
 *  (Backend select user {id,fullName,email} — khác user ở Review nên Omit rồi override.) */
export interface AdminReview extends Omit<Review, 'user'> {
  user?: { id: string; fullName: string; email?: string }
  product?: { id: string; name: string; slug: string }
}

/** Thống kê đánh giá của 1 sản phẩm — /products/:slug/reviews/summary */
export interface ReviewSummary {
  average: number
  total: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

/** Order item đang chờ đánh giá — /users/me/reviews/pending */
export interface PendingReviewItem {
  orderItemId: string
  productId: string
  productName: string
  sku: string
  color: string | null
  storage: string | null
  imageUrl: string | null
  orderCode: string
  deliveredAt: string | null
}

export interface CreateReviewPayload {
  rating: number
  content: string
}

export interface UpdateReviewPayload {
  rating?: number
  content?: string
}

/** Payload reply — backend đọc body.content (không phải replyContent). */
export interface ReplyReviewPayload {
  content: string
}

/** Kết quả GET /admin/reviews — paginated */
export interface AdminReviewListResult {
  reviews: AdminReview[]
  pagination: PaginationMeta
}

export interface AdminReviewListQuery extends ListQuery {
  rating?: number
  status?: ReviewStatus
  productId?: string
}

// Metadata hiển thị cho trạng thái review (nhãn VN + class màu badge).
// Gom cùng chỗ khớp pattern USER_ROLE_META / BANNER_POSITION_META.
export const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; badgeClass: string }> = {
  PENDING: { label: 'Chờ duyệt', badgeClass: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Đã duyệt', badgeClass: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Từ chối', badgeClass: 'bg-red-100 text-red-700' },
}
