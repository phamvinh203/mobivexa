'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { StarRating } from '@/components/ui/star-rating'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api/http'
import { adminReviewApi } from '@/features/reviews/api'
import type { AdminReview } from '@/features/reviews/types'

interface ReviewReplyModalProps {
  review: AdminReview
  onClose: () => void
  onSaved: (updated: AdminReview) => void
}

export function ReviewReplyModal({ review, onClose, onSaved }: ReviewReplyModalProps) {
  const [content, setContent] = useState(review.replyContent ?? '')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (content.trim().length < 1) {
      setError('Nội dung phản hồi không được để trống')
      return
    }

    setSubmitting(true)
    try {
      const reply = await adminReviewApi.reply(review.id, { content: content.trim() })
      onSaved(reply)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gửi phản hồi thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      title={review.replyContent ? 'Sửa phản hồi' : 'Phản hồi đánh giá'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {/* Ngữ cảnh: đánh giá gốc */}
        <div className="rounded-lg bg-muted/30 p-3 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium text-gray-700">{review.user?.fullName ?? 'Khách'}</span>
            <StarRating value={review.rating} />
          </div>
          <p className="line-clamp-3 text-gray-600">{review.content}</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="reply">Phản hồi của cửa hàng</Label>
          <Textarea
            id="reply"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Cảm ơn anh/chị đã đánh giá..."
            rows={4}
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground">{content.length}/1000 ký tự</p>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? 'Đang gửi...' : 'Gửi phản hồi'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
