import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  type UseMutationResult,
} from "@tanstack/react-query";
import { reviewsApi } from "../api/reviewsApi";
import {
  myReviewsQueryOptions,
  pendingReviewsQueryOptions,
  reviewKeys,
} from "../api/queries";
import type {
  MyReview,
  MyReviewQuery,
  PaginationMeta,
  PendingReviewItem,
} from "../types";

export interface UseMyReviewsResult {
  reviews: MyReview[];
  pagination: PaginationMeta;
  /** Sản phẩm đã nhận nhưng chưa đánh giá. */
  pending: PendingReviewItem[];
  deleteReview: UseMutationResult<void, Error, string>;
}

/** Đánh giá của tôi + danh sách chờ đánh giá. Cần <Suspense> bao ngoài. */
export function useMyReviews(query?: MyReviewQuery): UseMyReviewsResult {
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(myReviewsQueryOptions(query));
  const { data: pending } = useSuspenseQuery(pendingReviewsQueryOptions);

  // Xoá đánh giá làm món hàng đó quay lại danh sách "chờ đánh giá" → nạp lại cả hai.
  const deleteReview = useMutation({
    mutationFn: (id: string) => reviewsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    },
  });

  return {
    reviews: data.reviews,
    pagination: data.pagination,
    pending,
    deleteReview,
  };
}
