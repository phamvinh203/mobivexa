'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquareReply, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { StarRating } from '@/components/ui/star-rating'
import { ApiError } from '@/lib/api/http'
import { adminReviewApi } from '@/features/reviews/api'
import type { AdminReview } from '@/features/reviews/types'
import { REVIEW_STATUS_META } from '@/features/reviews/types'
import { ReviewStatus, type PaginationMeta } from '@/types/api'
import { ReviewReplyModal } from './review-reply-modal'

const PAGE_SIZE = 10
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

type RatingFilter = 0 | 1 | 2 | 3 | 4 | 5 // 0 = tất cả
type StatusFilter = 'ALL' | ReviewStatus

const RATING_OPTIONS = [5, 4, 3, 2, 1] as const

export default function AdminReviewsPage() {
  const [result, setResult] = useState<{ reviews: AdminReview[]; pagination: PaginationMeta } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [ratingFilter, setRatingFilter] = useState<RatingFilter>(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)

  const [replying, setReplying] = useState<AdminReview | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminReviewApi.list({
        page,
        limit: PAGE_SIZE,
        rating: ratingFilter || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách đánh giá')
    } finally {
      setLoading(false)
    }
  }, [page, ratingFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const resetPage = () => setPage(1)

  async function runBusy(id: string, op: () => Promise<void>, errMsg: string) {
    setBusyId(id)
    try {
      await op()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errMsg)
    } finally {
      setBusyId(null)
    }
  }

  function handleReplySaved(updated: AdminReview) {
    setReplying(null)
    setResult((prev) =>
      prev
        ? { ...prev, reviews: prev.reviews.map((r) => (r.id === updated.id ? updated : r)) }
        : prev,
    )
  }

  function handleDelete(review: AdminReview) {
    if (!confirm('Xoá đánh giá này? Hành động không thể hoàn tác.')) return
    return runBusy(
      review.id,
      async () => {
        await adminReviewApi.remove(review.id)
        setResult((prev) => {
          if (!prev) return prev
          const total = Math.max(0, prev.pagination.total - 1)
          return {
            reviews: prev.reviews.filter((r) => r.id !== review.id),
            pagination: { ...prev.pagination, total, totalPages: Math.ceil(total / prev.pagination.limit) },
          }
        })
      },
      'Xoá đánh giá thất bại',
    )
  }

  const reviews = result?.reviews ?? []
  const pagination = result?.pagination ?? EMPTY_PAGINATION

  const rangeLabel = useMemo(() => {
    if (pagination.total === 0) return 'Không có đánh giá'
    const from = (pagination.page - 1) * pagination.limit + 1
    const to = Math.min(pagination.page * pagination.limit, pagination.total)
    return `${from}–${to} / ${pagination.total}`
  }, [pagination])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Đánh giá</h1>
        <p className="text-sm text-gray-500">Xem, phản hồi và xoá đánh giá sản phẩm của khách hàng.</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {RATING_OPTIONS.map((r) => (
          <FilterChip
            key={r}
            active={ratingFilter === r}
            label={`${r} ★`}
            onClick={() => {
              setRatingFilter(r)
              resetPage()
            }}
          />
        ))}
        <FilterChip
          active={ratingFilter === 0}
          label="Mọi sao"
          onClick={() => {
            setRatingFilter(0)
            resetPage()
          }}
        />

        <div className="ml-auto flex gap-2">
          {(['ALL', ...Object.values(ReviewStatus)] as StatusFilter[]).map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              label={s === 'ALL' ? 'Tất cả TT' : REVIEW_STATUS_META[s].label}
              onClick={() => {
                setStatusFilter(s)
                resetPage()
              }}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {/* Danh sách review (card feed) */}
      {loading ? (
        <div className="rounded-xl bg-white px-4 py-10 text-center text-sm text-gray-400 ring-1 ring-border">
          Đang tải...
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl bg-white px-4 py-10 text-center text-sm text-gray-400 ring-1 ring-border">
          Không có đánh giá phù hợp.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              busy={busyId === review.id}
              onReply={() => setReplying(review)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-border">
          <span className="text-gray-500">{rangeLabel}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Trước
            </Button>
            <span className="px-2 text-gray-600">{pagination.page} / {pagination.totalPages}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)}>
              Sau
            </Button>
          </div>
        </div>
      )}

      {replying && (
        <ReviewReplyModal
          review={replying}
          onClose={() => setReplying(null)}
          onSaved={handleReplySaved}
        />
      )}
    </div>
  )
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  busy,
  onReply,
  onDelete,
}: {
  review: AdminReview
  busy: boolean
  onReply: () => void
  onDelete: (r: AdminReview) => void
}) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-border">
      {/* Header: user + product + rating + status */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800">{review.user?.fullName ?? 'Khách'}</span>
            {review.user?.email && <span className="text-xs text-gray-400">{review.user.email}</span>}
          </div>
          {review.product && (
            <div className="text-xs text-gray-400">{review.product.name}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StarRating value={review.rating} />
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STATUS_META[review.status].badgeClass}`}>
            {REVIEW_STATUS_META[review.status].label}
          </span>
        </div>
      </div>

      {/* Nội dung đánh giá */}
      <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{review.content}</p>

      {/* Ảnh (nếu có) */}
      {review.photos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {review.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt="" className="h-16 w-16 rounded-md object-cover ring-1 ring-border" />
          ))}
        </div>
      )}

      {/* Phản hồi của cửa hàng (nếu có) */}
      {review.replyContent && (
        <div className="mt-3 rounded-lg bg-muted/30 p-3">
          <div className="mb-0.5 text-xs font-medium text-gray-500">Phản hồi cửa hàng</div>
          <p className="whitespace-pre-line text-sm text-gray-700">{review.replyContent}</p>
        </div>
      )}

      {/* Footer: thời gian + helpful + actions */}
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
          {typeof review._count?.helpful === 'number' && review._count.helpful > 0 && (
            <span>👍 {review._count.helpful}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onReply}>
            <MessageSquareReply className="h-4 w-4" />
            {review.replyContent ? 'Sửa phản hồi' : 'Phản hồi'}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => onDelete(review)}
            className="text-gray-400 hover:text-[var(--color-danger)]"
            title="Xoá đánh giá"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
