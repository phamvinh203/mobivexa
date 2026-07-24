'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, Loader2, PenLine, PartyPopper, TriangleAlert } from 'lucide-react'
import { ReviewForm } from '@/components/review/review-form'
import { reviewApi } from '@/features/reviews/api'
import { pendingItemImage, type PendingReviewItem } from '@/features/reviews/types'
import { ApiError } from '@/lib/api/http'
import { formatDate, formatVND } from '@/lib/utils/format'

export function PendingReviews() {
  const [items, setItems] = useState<PendingReviewItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [writingId, setWritingId] = useState<string | null>(null)
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    reviewApi
      .pending()
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setItems([])
        setError(
          err instanceof ApiError ? err.message : 'Không tải được danh sách',
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (items === null) {
    return (
      <div className="grid min-h-[30vh] place-items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <header className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Chờ đánh giá</h1>
        <Link
          href="/account/reviews"
          className="text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          Đánh giá đã viết
        </Link>
      </header>
      <p className="mb-5 text-sm text-muted-foreground">
        Sản phẩm thuộc đơn đã giao thành công mà bạn chưa đánh giá.
      </p>

      {error && (
        <p
          role="alert"
          className="mb-4 flex items-start gap-1.5 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {doneCount > 0 && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-[var(--color-success)]">
          <Check className="h-4 w-4 flex-shrink-0" aria-hidden />
          Đã gửi {doneCount} đánh giá. Cảm ơn bạn!
        </p>
      )}

      {items.length === 0 ? (
        <div className="grid place-items-center gap-2 py-12 text-center">
          <PartyPopper className="h-9 w-9 text-muted-foreground" aria-hidden />
          <p className="font-medium text-gray-700">Không còn gì để đánh giá</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Mọi sản phẩm đã giao đều được bạn đánh giá rồi.
          </p>
          <Link
            href="/products"
            className="mt-1 text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            Tiếp tục mua sắm
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const cover = pendingItemImage(item)
            const slug = item.variant?.product?.slug
            const variant = [item.storage, item.ram && `${item.ram} RAM`, item.color]
              .filter(Boolean)
              .join(' · ')

            return (
              <li key={item.id} className="py-5 first:pt-0">
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
                        {slug ? (
                          <Link
                            href={`/products/${slug}`}
                            className="line-clamp-1 font-semibold text-gray-900 hover:text-[var(--color-primary)]"
                          >
                            {item.productName}
                          </Link>
                        ) : (
                          <span className="font-semibold text-gray-900">
                            {item.productName}
                          </span>
                        )}
                        {variant && (
                          <p className="text-xs text-muted-foreground">{variant}</p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Đơn{' '}
                          <Link
                            href={`/orders/${item.order.id}`}
                            className="font-mono hover:underline"
                          >
                            {item.order.orderCode}
                          </Link>
                          {' · '}
                          {formatDate(item.order.updatedAt)}
                          {' · '}
                          {formatVND(item.unitPrice)} × {item.quantity}
                        </p>
                      </div>

                      {writingId !== item.id && (
                        <button
                          type="button"
                          onClick={() => setWritingId(item.id)}
                          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
                        >
                          <PenLine className="h-3.5 w-3.5" aria-hidden />
                          Viết đánh giá
                        </button>
                      )}
                    </div>

                    {writingId === item.id && (
                      <div className="mt-3 rounded-xl border border-border p-4">
                        <ReviewForm
                          onSubmit={async (rating, content, photos) => {
                            await reviewApi.create(
                              item.id,
                              { rating, content },
                              photos.length ? photos : undefined,
                            )
                            // Đánh giá xong thì item rời khỏi danh sách chờ
                            setItems((prev) =>
                              prev?.filter((i) => i.id !== item.id) ?? null,
                            )
                            setDoneCount((n) => n + 1)
                            setWritingId(null)
                          }}
                          onCancel={() => setWritingId(null)}
                        />
                      </div>
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
