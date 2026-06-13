import type { ReviewStatus, ListQuery } from '@/types/api'

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

export interface ReplyReviewPayload {
  replyContent: string
}

export interface AdminReviewListQuery extends ListQuery {
  rating?: number
  status?: ReviewStatus
}
