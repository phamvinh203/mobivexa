'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Clock, Loader2, MessageSquareQuote, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { ReviewForm } from '@/components/review/review-form'
import { StarRating } from '@/components/ui/star-rating'
import { reviewApi } from '@/features/reviews/api'
import {
  REVIEW_STATUS_META,
  canEditReview,
  type MyReview,
} from '@/features/reviews/types'
import { ApiError } from '@/lib/api/http'
import { formatDate } from '@/lib/utils/format'

export function MyReviews() {
  const [reviews, setReviews] = useState<MyReview[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    reviewApi
      .myReviews({ limit: 50 })
      .then((list) => {
        if (!cancelled) setReviews(list)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setReviews([])
        setError(err instanceof ApiError ? err.message : 'Không tải được đánh giá')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function reload() {
    setReviews(await reviewApi.myReviews({ limit: 50 }))
  }

  async function remove(id: string) {
    setPendingId(id)
    setError(null)
    try {
      await reviewApi.remove(id)
      setReviews((prev) => prev?.filter((r) => r.id !== id) ?? null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xoá được đánh giá')
    } finally {
      setPendingId(null)
    }
  }

  if (reviews === null) {
    return (
      <div className="grid min-h-[30vh] place-items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">Đang tải đánh giá...</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Đánh giá của tôi</h1>
        <Link
          href="/account/reviews/pending"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
        >
          <Clock className="h-4 w-4" aria-hidden />
          Chờ đánh giá
        </Link>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 flex items-start gap-1.5 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {reviews.length === 0 ? (
        <div className="grid place-items-center gap-2 py-12 text-center">
          <MessageSquareQuote className="h-9 w-9 text-muted-foreground" aria-hidden />
          <p className="font-medium text-gray-700">Bạn chưa viết đánh giá nào</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Sau khi nhận hàng thành công, bạn có thể đánh giá sản phẩm đã mua.
          </p>
          <Link
            href="/account/reviews/pending"
            className="mt-1 text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            Xem sản phẩm chờ đánh giá
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {reviews.map((review) => {
            const cover = review.product?.images?.[0]?.url
            const variant = [
              review.orderItem?.storage,
              review.orderItem?.color,
            ]
              .filter(Boolean)
              .join(' · ')
            const editable = canEditReview(review)
            const busy = pendingId === review.id
            const status = REVIEW_STATUS_META[review.status]

            return (
              <li key={review.id} className="py-5 first:pt-0">
                <div className="flex gap-3.5">
                  <span className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                    {cover && (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-contain p-1"
                      />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        {review.product ? (
                          <Link
                            href={`/products/${review.product.slug}`}
                            className="line-clamp-1 font-semibold text-gray-900 hover:text-[var(--color-primary)]"
                          >
                            {review.product.name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-gray-900">
                            Sản phẩm đã bị xoá
                          </span>
                        )}
                        {variant && (
                          <p className="text-xs text-muted-foreground">{variant}</p>
                        )}
                      </div>

                      {status && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.badgeClass}`}
                        >
                          {status.label}
                        </span>
                      )}
                    </div>

                    {editingId === review.id ? (
                      <div className="mt-3 rounded-xl border border-border p-4">
                        <ReviewForm
                          initialRating={review.rating}
                          initialContent={review.content}
                          existingPhotoCount={review.photos.length}
                          submitLabel="Cập nhật đánh giá"
                          onSubmit={async (rating, content, photos) => {
                            await reviewApi.update(
                              review.id,
                              { rating, content },
                              photos.length ? photos : undefined,
                            )
                            await reload()
                            setEditingId(null)
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                          <StarRating value={review.rating} />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(review.createdAt)}
                          </span>
                        </div>

                        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                          {review.content}
                        </p>

                        {review.photos.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {review.photos.map((photo) => (
                              <span
                                key={photo.id}
                                className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-white"
                              >
                                <Image
                                  src={photo.url}
                                  alt=""
                                  fill
                                  sizes="64px"
                                  className="object-cover"
                                />
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingId(review.id)}
                            disabled={!editable || busy}
                            title={
                              editable
                                ? undefined
                                : 'Đã quá 30 ngày, không thể chỉnh sửa'
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(review.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-[var(--color-danger)] disabled:opacity-40"
                          >
                            {busy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Xoá
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
