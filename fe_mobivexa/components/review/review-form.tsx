'use client'

import { useState } from 'react'
import { ImagePlus, Loader2, Star, X } from 'lucide-react'
import { ApiError } from '@/lib/api/http'
import { assertImageFiles } from '@/lib/utils/file'
import {
  MAX_REVIEW_PHOTOS,
  REVIEW_CONTENT_MAX,
  REVIEW_CONTENT_MIN,
} from '@/features/reviews/types'

interface ReviewFormProps {
  initialRating?: number
  initialContent?: string
  /** Số ảnh đang có (chế độ sửa) — dùng để cảnh báo ảnh cũ sẽ bị thay thế */
  existingPhotoCount?: number
  submitLabel?: string
  onSubmit: (rating: number, content: string, photos: File[]) => Promise<void>
  onCancel?: () => void
}

export function ReviewForm({
  initialRating = 5,
  initialContent = '',
  existingPhotoCount = 0,
  submitLabel = 'Gửi đánh giá',
  onSubmit,
  onCancel,
}: ReviewFormProps) {
  const [rating, setRating] = useState(initialRating)
  const [hover, setHover] = useState(0)
  const [content, setContent] = useState(initialContent)
  const [photos, setPhotos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function pickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0) return

    const next = [...photos, ...picked].slice(0, MAX_REVIEW_PHOTOS)
    try {
      assertImageFiles(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ảnh không hợp lệ')
      return
    }
    setError(null)
    setPhotos(next)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = content.trim()

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError('Vui lòng chọn số sao từ 1 đến 5')
      return
    }
    if (text.length < REVIEW_CONTENT_MIN) {
      setError(`Nội dung phải có ít nhất ${REVIEW_CONTENT_MIN} ký tự`)
      return
    }
    if (text.length > REVIEW_CONTENT_MAX) {
      setError(`Nội dung không được quá ${REVIEW_CONTENT_MAX} ký tự`)
      return
    }

    setError(null)
    setSaving(true)
    try {
      await onSubmit(rating, text, photos)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được đánh giá')
    } finally {
      setSaving(false)
    }
  }

  const shown = hover || rating

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {/* ── Số sao ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Đánh giá</span>
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHover(value)}
              aria-label={`${value} sao`}
              aria-pressed={rating === value}
              className="p-0.5"
            >
              <Star
                className={`h-6 w-6 transition-colors ${
                  value <= shown
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-gray-200 text-gray-200'
                }`}
                aria-hidden
              />
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{shown}/5</span>
      </div>

      {/* ── Nội dung ───────────────────────────────────────────────────────── */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Nhận xét của bạn</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          maxLength={REVIEW_CONTENT_MAX}
          placeholder="Sản phẩm dùng thế nào? Pin, camera, hiệu năng ra sao?"
          className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
        />
        <span className="text-right text-xs text-muted-foreground">
          {content.trim().length}/{REVIEW_CONTENT_MAX}
          {content.trim().length < REVIEW_CONTENT_MIN &&
            ` · cần tối thiểu ${REVIEW_CONTENT_MIN}`}
        </span>
      </label>

      {/* ── Ảnh ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {photos.map((file, i) => (
            <span
              key={`${file.name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-gray-50 px-2.5 py-1.5 text-xs"
            >
              <span className="max-w-[140px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label={`Bỏ ảnh ${file.name}`}
                className="text-gray-400 hover:text-[var(--color-danger)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}

          {photos.length < MAX_REVIEW_PHOTOS && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
              Thêm ảnh ({photos.length}/{MAX_REVIEW_PHOTOS})
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={pickPhotos}
                className="hidden"
              />
            </label>
          )}
        </div>

        {existingPhotoCount > 0 && photos.length > 0 && (
          <p className="mt-1.5 text-xs text-[var(--color-warning)]">
            Ảnh mới sẽ thay thế toàn bộ {existingPhotoCount} ảnh cũ.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Huỷ
          </button>
        )}
      </div>
    </form>
  )
}
