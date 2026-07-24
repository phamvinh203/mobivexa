import { http } from '@/lib/api/http'
import { assertImageFiles } from '@/lib/utils/file'
import type {
  Review,
  ReviewSummary,
  ProductReviewListResult,
  ProductReviewQuery,
  MyReviewListResult,
  HelpfulResult,
  PendingReviewItem,
  CreateReviewPayload,
  UpdateReviewPayload,
  ReplyReviewPayload,
  AdminReview,
  AdminReviewListQuery,
  AdminReviewListResult,
} from './types'
import type { ListQuery } from '@/types/api'

// Khớp src/routes/review.route.ts
export const reviewApi = {
  // Public: /products/:slug/reviews — backend bọc { reviews, pagination },
  // unwrap tại đây để consumer nhận thẳng ProductReview[] (khớp pattern productApi).
  listByProduct: (slug: string, query?: ProductReviewQuery) =>
    http
      .get<ProductReviewListResult>(`/products/${slug}/reviews`, {
        auth: false,
        params: query,
        revalidate: 60,
      })
      .then((r) => r.reviews ?? []),
  listByProductPaged: (slug: string, query?: ProductReviewQuery) =>
    http.get<ProductReviewListResult>(`/products/${slug}/reviews`, {
      auth: false,
      params: query,
    }),
  summary: (slug: string) =>
    http.get<ReviewSummary>(`/products/${slug}/reviews/summary`, {
      auth: false,
      revalidate: 60,
    }),

  // User: /users/me/reviews — backend bọc { reviews, pagination }
  myReviews: (query?: ListQuery) =>
    http
      .get<MyReviewListResult>('/users/me/reviews', { params: query })
      .then((r) => r.reviews ?? []),
  myReviewsPaged: (query?: ListQuery) =>
    http.get<MyReviewListResult>('/users/me/reviews', { params: query }),
  // Trả thẳng mảng orderItem (không bọc)
  pending: () => http.get<PendingReviewItem[]>('/users/me/reviews/pending'),

  // User: tạo review cho 1 order item (kèm tối đa 5 ảnh)
  create: (orderItemId: string, body: CreateReviewPayload, photos?: File[]) => {
    if (photos?.length) assertImageFiles(photos)
    const form = new FormData()
    form.append('rating', String(body.rating))
    form.append('content', body.content)
    photos?.forEach((f) => form.append('photos', f))
    return http.post<Review>(`/order-items/${orderItemId}/review`, form)
  },

  // User: /reviews/:id
  update: (id: string, body: UpdateReviewPayload, photos?: File[]) => {
    if (photos?.length) assertImageFiles(photos)
    const form = new FormData()
    if (body.rating != null) form.append('rating', String(body.rating))
    if (body.content != null) form.append('content', body.content)
    photos?.forEach((f) => form.append('photos', f))
    return http.put<Review>(`/reviews/${id}`, form)
  },
  // Backend trả 204 No Content (không có body)
  remove: (id: string) => http.delete<void>(`/reviews/${id}`),
  // toggleHelpful trả { helpful: đã-bấm-hay-chưa, count: tổng lượt } —
  // "helpful" là boolean trạng thái, KHÔNG phải số lượt.
  markHelpful: (id: string) =>
    http.post<HelpfulResult>(`/reviews/${id}/helpful`),
}

// Admin: /admin/reviews (STAFF + ADMIN). Backend bọc { reviews, pagination }
// cho list; reply trả partial; delete trả 204 null → unwrap tại đây.
export const adminReviewApi = {
  list: (query?: AdminReviewListQuery) =>
    http.get<AdminReviewListResult>('/admin/reviews', { params: query }),

  reply: (id: string, body: ReplyReviewPayload) =>
    http.post<AdminReview>(`/admin/reviews/${id}/reply`, body),

  remove: (id: string) =>
    http.delete(`/admin/reviews/${id}`),
}
