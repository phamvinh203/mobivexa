import type {
  ListQuery,
  PaginationMeta,
  ReviewStatus,
} from "../../../lib/apiTypes";

export type { PaginationMeta, ReviewStatus };

/**
 * Đánh giá của chính mình — GET /users/me/reviews dùng select HẸP, không trả
 * Review đầy đủ: không có userId/productId/orderItemId/replyContent. Bù lại có
 * kèm product để hiển thị mà không phải fetch thêm.
 */
export interface MyReview {
  id: string;
  rating: number;
  content: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  photos: { id: string; url: string }[];
  product: { name: string; slug: string; images: { url: string }[] } | null;
  orderItem: {
    color: string | null;
    storage: string | null;
    ram: string | null;
  } | null;
}

export interface MyReviewListResult {
  reviews: MyReview[];
  pagination: PaginationMeta;
}

export type MyReviewQuery = ListQuery;

/**
 * Order item đang chờ đánh giá — /users/me/reviews/pending.
 * Khớp đúng select của getPendingReviews(): khoá chính là `id` (không phải
 * orderItemId), orderCode nằm trong `order`, ảnh nằm sâu trong
 * variant.product.images — không có field phẳng nào cả.
 */
export interface PendingReviewItem {
  id: string;
  productName: string;
  sku: string;
  color: string | null;
  storage: string | null;
  ram: string | null;
  unitPrice: string | number;
  quantity: number;
  order: { id: string; orderCode: string; updatedAt: string };
  variant: { product: { slug: string; images: { url: string }[] } } | null;
}

/** Ảnh bìa của item chờ đánh giá — gỡ dần lớp lồng nhau cho gọn phía UI. */
export function pendingItemImage(item: PendingReviewItem): string | undefined {
  return item.variant?.product?.images?.[0]?.url;
}

/** Cửa sổ được phép sửa đánh giá — khớp EDIT_WINDOW_MS (30 ngày) bên backend. */
export const REVIEW_EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Còn trong hạn sửa không (backend trả 400 nếu quá hạn). */
export function canEditReview(review: { createdAt: string }): boolean {
  return (
    Date.now() - new Date(review.createdAt).getTime() <= REVIEW_EDIT_WINDOW_MS
  );
}

type ChipColor = "default" | "success" | "warning" | "error";

export const REVIEW_STATUS_META: Record<
  ReviewStatus,
  { label: string; color: ChipColor }
> = {
  PENDING: { label: "Chờ duyệt", color: "warning" },
  APPROVED: { label: "Đã duyệt", color: "success" },
  REJECTED: { label: "Từ chối", color: "error" },
};
