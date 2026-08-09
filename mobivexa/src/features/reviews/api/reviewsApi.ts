import { apiClient } from "../../../lib/apiClient";
import type {
  MyReviewListResult,
  MyReviewQuery,
  PendingReviewItem,
} from "../types";

// Khớp src/routes/review.route.ts — phần của người dùng đăng nhập.
export const reviewsApi = {
  // Backend bọc { reviews, pagination }.
  async myReviews(query?: MyReviewQuery): Promise<MyReviewListResult> {
    const { data } = await apiClient.get<MyReviewListResult>(
      "/users/me/reviews",
      { params: query },
    );
    return data;
  },

  // Endpoint này trả THẲNG mảng, không bọc trong object như các endpoint khác.
  async pending(): Promise<PendingReviewItem[]> {
    const { data } = await apiClient.get<PendingReviewItem[]>(
      "/users/me/reviews/pending",
    );
    return data ?? [];
  },

  // Backend trả 204 No Content.
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/reviews/${id}`);
  },
};
