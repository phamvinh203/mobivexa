import { http } from '@/lib/api/http'
import { assertImageFiles } from '@/lib/utils/file'
import type {
  Review,
  ReviewSummary,
  PendingReviewItem,
  CreateReviewPayload,
  UpdateReviewPayload,
  ReplyReviewPayload,
  AdminReviewListQuery,
} from './types'
import type { ListQuery } from '@/types/api'

// Khớp src/routes/review.route.ts
export const reviewApi = {
  // Public: /products/:slug/reviews
  listByProduct: (slug: string, query?: ListQuery) =>
    http.get<Review[]>(`/products/${slug}/reviews`, { auth: false, params: query }),
  summary: (slug: string) =>
    http.get<ReviewSummary>(`/products/${slug}/reviews/summary`, { auth: false }),

  // User: /users/me/reviews
  myReviews: (query?: ListQuery) =>
    http.get<Review[]>('/users/me/reviews', { params: query }),
  pending: () =>
    http.get<PendingReviewItem[]>('/users/me/reviews/pending'),

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
  remove: (id: string) => http.delete<{ message: string }>(`/reviews/${id}`),
  markHelpful: (id: string) =>
    http.post<{ helpful: number }>(`/reviews/${id}/helpful`),
}

// Admin: /admin/reviews (STAFF + ADMIN)
export const adminReviewApi = {
  list: (query?: AdminReviewListQuery) =>
    http.get<Review[]>('/admin/reviews', { params: query }),
  reply: (id: string, body: ReplyReviewPayload) =>
    http.post<Review>(`/admin/reviews/${id}/reply`, body),
  remove: (id: string) =>
    http.delete<{ message: string }>(`/admin/reviews/${id}`),
}
