import { queryOptions } from "@tanstack/react-query";
import { USER_SCOPED } from "../../../lib/queryClient";
import { reviewsApi } from "./reviewsApi";
import type { MyReviewQuery } from "../types";

export const reviewKeys = {
  all: ["reviews"] as const,
  mine: (query?: MyReviewQuery) =>
    [...reviewKeys.all, "mine", query ?? {}] as const,
  pending: () => [...reviewKeys.all, "pending"] as const,
};

export const myReviewsQueryOptions = (query?: MyReviewQuery) =>
  queryOptions({
    queryKey: reviewKeys.mine(query),
    queryFn: () => reviewsApi.myReviews(query),
    meta: USER_SCOPED,
  });

export const pendingReviewsQueryOptions = queryOptions({
  queryKey: reviewKeys.pending(),
  queryFn: () => reviewsApi.pending(),
  meta: USER_SCOPED,
});
