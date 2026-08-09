import type { ReactElement } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Rating,
  Stack,
  Typography,
} from "@mui/material";
import { ErrorAlert } from "../../components/ErrorAlert";
import { AccountSectionHeader } from "../../layouts/AccountLayout";
import { useMyReviews } from "../../features/reviews/hooks/useMyReviews";
import {
  REVIEW_STATUS_META,
  canEditReview,
  pendingItemImage,
  type MyReview,
  type PendingReviewItem,
} from "../../features/reviews/types";
import { formatDate } from "../../lib/format";

function variantLabel(
  parts: {
    color: string | null;
    storage: string | null;
    ram: string | null;
  } | null,
): string | null {
  if (!parts) return null;
  const label = [parts.color, parts.storage, parts.ram]
    .filter(Boolean)
    .join(" / ");
  return label || null;
}

function ReviewCard({
  review,
  onDelete,
  isDeleting,
}: {
  review: MyReview;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}): ReactElement {
  const status = REVIEW_STATUS_META[review.status];
  const variant = variantLabel(review.orderItem);
  const cover = review.product?.images?.[0]?.url;

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={2}>
        {cover && (
          <Box
            component="img"
            src={cover}
            alt=""
            sx={{
              width: 64,
              height: 64,
              objectFit: "contain",
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
              flexShrink: 0,
            }}
          />
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography sx={{ fontWeight: 600 }}>
              {review.product?.name ?? "Sản phẩm đã gỡ"}
            </Typography>
            <Chip label={status.label} color={status.color} size="small" />
          </Stack>

          {variant && (
            <Typography variant="caption" color="text.secondary">
              Phiên bản: {variant}
            </Typography>
          )}

          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", mt: 0.5 }}
          >
            <Rating value={review.rating} readOnly size="small" />
            <Typography variant="caption" color="text.secondary">
              {formatDate(review.createdAt)}
            </Typography>
          </Stack>

          <Typography variant="body2" sx={{ mt: 1 }}>
            {review.content}
          </Typography>

          {review.photos.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
              {review.photos.map((photo) => (
                <Box
                  key={photo.id}
                  component="img"
                  src={photo.url}
                  alt=""
                  sx={{
                    width: 56,
                    height: 56,
                    objectFit: "cover",
                    borderRadius: 1,
                  }}
                />
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button
              size="small"
              color="error"
              loading={isDeleting}
              onClick={() => {
                if (window.confirm("Xoá đánh giá này?")) onDelete(review.id);
              }}
            >
              Xoá
            </Button>
            {!canEditReview(review) && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ alignSelf: "center" }}
              >
                Đã quá hạn 30 ngày để sửa
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function PendingCard({ item }: { item: PendingReviewItem }): ReactElement {
  const cover = pendingItemImage(item);
  const variant = variantLabel(item);

  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        {cover && (
          <Box
            component="img"
            src={cover}
            alt=""
            sx={{ width: 48, height: 48, objectFit: "contain", flexShrink: 0 }}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {item.productName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Đơn #{item.order.orderCode}
            {variant ? ` · ${variant}` : ""}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export function ReviewsPage(): ReactElement {
  const { reviews, pagination, pending, deleteReview } = useMyReviews();

  return (
    <Stack spacing={2}>
      <AccountSectionHeader
        title="Đánh giá của tôi"
        description={
          pagination.total > 0
            ? `Bạn đã viết ${pagination.total} đánh giá.`
            : undefined
        }
      />

      <ErrorAlert error={deleteReview.error} />

      {pending.length > 0 && (
        <>
          <Alert severity="info">
            Bạn có {pending.length} sản phẩm đã nhận nhưng chưa đánh giá.
          </Alert>
          {pending.map((item) => (
            <PendingCard key={item.id} item={item} />
          ))}
        </>
      )}

      {reviews.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            Bạn chưa viết đánh giá nào.
          </Typography>
        </Paper>
      ) : (
        reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onDelete={(id) => deleteReview.mutate(id)}
            isDeleting={
              deleteReview.isPending && deleteReview.variables === review.id
            }
          />
        ))
      )}
    </Stack>
  );
}
