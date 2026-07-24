import Image from 'next/image'
import { MessageSquareQuote, ThumbsUp } from 'lucide-react'
import { StarRating } from '@/components/ui/star-rating'
import { formatDate } from '@/lib/utils/format'
import type { ProductReview, ReviewSummary } from '@/features/reviews/types'

/** Phiên bản người mua đã dùng — hiển thị dưới tên để đánh giá có ngữ cảnh. */
function purchasedVariant(review: ProductReview): string | null {
  if (!review.orderItem) return null
  const parts = [
    review.orderItem.storage,
    review.orderItem.ram && `${review.orderItem.ram} RAM`,
    review.orderItem.color,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

function RatingBars({ summary }: { summary: ReviewSummary }) {
  return (
    <div className="flex flex-col gap-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = summary.breakdown[star] ?? 0
        const percent = summary.totalCount > 0 ? (count / summary.totalCount) * 100 : 0
        return (
          <div key={star} className="flex items-center gap-2.5 text-xs">
            <span className="w-8 text-right tabular-nums text-muted-foreground">
              {star} ★
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <span
                className="block h-full rounded-full bg-amber-400"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="w-7 tabular-nums text-muted-foreground">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ReviewPanel({
  summary,
  reviews,
}: {
  summary: ReviewSummary | null
  reviews: ProductReview[]
}) {
  const hasReviews = !!summary && summary.totalCount > 0

  if (!hasReviews) {
    return (
      <div className="grid place-items-center gap-2 py-10 text-center">
        <MessageSquareQuote className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="font-medium text-gray-700">Chưa có đánh giá nào</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Mua sản phẩm và nhận hàng thành công để trở thành người đầu tiên đánh giá.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tổng quan */}
      <div className="grid gap-6 rounded-xl border border-border bg-gray-50/60 p-5 sm:grid-cols-[auto_minmax(0,320px)] sm:items-center">
        <div className="text-center sm:text-left">
          <div className="text-4xl font-black leading-none text-gray-900">
            {summary.averageRating.toFixed(1)}
            <span className="text-lg font-semibold text-muted-foreground">/5</span>
          </div>
          <div className="mt-1.5 text-lg">
            <StarRating value={Math.round(summary.averageRating)} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.totalCount} đánh giá
            {summary.withPhotoCount > 0 && ` · ${summary.withPhotoCount} có ảnh`}
          </p>
        </div>
        <RatingBars summary={summary} />
      </div>

      {/* Danh sách */}
      <ul className="divide-y divide-border">
        {reviews.map((review) => {
          const variant = purchasedVariant(review)
          const helpful = review._count?.helpful ?? 0

          return (
            <li key={review.id} className="flex gap-3.5 py-5 first:pt-0">
              {review.user?.avatarUrl ? (
                <Image
                  src={review.user.avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-accent)] text-sm font-bold text-white">
                  {review.user?.fullName?.[0]?.toUpperCase() ?? 'K'}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-semibold text-gray-900">
                    {review.user?.fullName ?? 'Khách hàng'}
                  </span>
                  <StarRating value={review.rating} />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(review.createdAt)}
                  </span>
                </div>

                {variant && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Phiên bản: {variant}
                  </p>
                )}

                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                  {review.content}
                </p>

                {review.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {review.photos.map((photo) => (
                      <span
                        key={photo.id}
                        className="relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-white"
                      >
                        <Image
                          src={photo.url}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </span>
                    ))}
                  </div>
                )}

                {helpful > 0 && (
                  <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                    {helpful} người thấy hữu ích
                  </p>
                )}

                {review.replyContent && (
                  <div className="mt-3 rounded-lg border-l-2 border-[var(--color-primary)] bg-[var(--color-primary-light)]/60 px-3.5 py-2.5">
                    <p className="text-xs font-semibold text-[var(--color-primary)]">
                      Phản hồi từ Mobivexa
                      {review.repliedAt && (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          {formatDate(review.repliedAt)}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                      {review.replyContent}
                    </p>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {summary.totalCount > reviews.length && (
        <p className="text-center text-sm text-muted-foreground">
          Đang hiển thị {reviews.length} trên {summary.totalCount} đánh giá.
        </p>
      )}
    </div>
  )
}
