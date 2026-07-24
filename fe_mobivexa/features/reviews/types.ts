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

/** Thống kê đánh giá của 1 sản phẩm — /products/:slug/reviews/summary.
 *  Khớp getReviewSummary() trong be_mobivexa/src/services/review.service.ts —
 *  chỉ tính review đã APPROVED. */
export interface ReviewSummary {
  averageRating: number
  totalCount: number
  /** Số review theo từng mức sao (1..5), luôn đủ 5 khoá */
  breakdown: Record<number, number>
  withPhotoCount: number
}

/** Review ở góc nhìn public — backend chỉ select một tập field hẹp
 *  (REVIEW_PUBLIC_SELECT), không trả userId/status/productId như Review đầy đủ.
 *  Kèm orderItem để hiển thị "đã mua phiên bản nào". */
export interface ProductReview {
  id: string
  rating: number
  content: string
  replyContent: string | null
  repliedAt: string | null
  createdAt: string
  orderItem: { color: string | null; storage: string | null; ram: string | null; sku: string } | null
  user: { id: string; fullName: string; avatarUrl: string | null } | null
  photos: { id: string; url: string }[]
  _count: { helpful: number }
}

/** Kết quả GET /products/:slug/reviews — paginated */
export interface ProductReviewListResult {
  reviews: ProductReview[]
  pagination: PaginationMeta
}

/** Query lọc review public — khớp ReviewListQuery backend */
export interface ProductReviewQuery extends ListQuery {
  rating?: number
  hasPhoto?: boolean
  sort?: 'recent' | 'helpful'
}

/** Đánh giá của chính mình — GET /users/me/reviews dùng select HẸP, không trả
 *  Review đầy đủ: không có userId/productId/orderItemId/replyContent. Bù lại có
 *  kèm product để hiển thị mà không phải fetch thêm. */
export interface MyReview {
  id: string
  rating: number
  content: string
  status: ReviewStatus
  createdAt: string
  updatedAt: string
  photos: { id: string; url: string }[]
  product: { name: string; slug: string; images: { url: string }[] } | null
  orderItem: { color: string | null; storage: string | null; ram: string | null } | null
}

/** Kết quả GET /users/me/reviews — paginated */
export interface MyReviewListResult {
  reviews: MyReview[]
  pagination: PaginationMeta
}

/** Cửa sổ được phép sửa đánh giá — khớp EDIT_WINDOW_MS (30 ngày) bên backend. */
export const REVIEW_EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** Số ảnh tối đa mỗi đánh giá — khớp MAX_PHOTOS bên backend. */
export const MAX_REVIEW_PHOTOS = 5

/** Giới hạn độ dài nội dung — khớp validateContent bên backend. */
export const REVIEW_CONTENT_MIN = 10
export const REVIEW_CONTENT_MAX = 2000

/** Còn trong hạn sửa không (backend trả 400 nếu quá hạn). */
export function canEditReview(review: { createdAt: string }): boolean {
  return Date.now() - new Date(review.createdAt).getTime() <= REVIEW_EDIT_WINDOW_MS
}

/** Kết quả POST /reviews/:id/helpful — khớp toggleHelpful().
 *  `helpful` là TRẠNG THÁI sau khi bấm (đã thích hay chưa), `count` mới là số lượt. */
export interface HelpfulResult {
  helpful: boolean
  count: number
}

/** Order item đang chờ đánh giá — /users/me/reviews/pending.
 *  Khớp đúng select của getPendingReviews(): khoá chính là `id` (không phải
 *  orderItemId), orderCode nằm trong `order`, ảnh nằm sâu trong
 *  variant.product.images — không có field phẳng nào cả. */
export interface PendingReviewItem {
  id: string
  productName: string
  sku: string
  color: string | null
  storage: string | null
  ram: string | null
  unitPrice: string | number
  quantity: number
  order: { id: string; orderCode: string; updatedAt: string }
  variant: { product: { slug: string; images: { url: string }[] } } | null
}

/** Ảnh bìa của item chờ đánh giá — gỡ dần lớp lồng nhau cho gọn phía UI. */
export function pendingItemImage(item: PendingReviewItem): string | undefined {
  return item.variant?.product?.images?.[0]?.url
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
