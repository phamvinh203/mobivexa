import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { parseIntField } from './common.validator'
import { ReviewStatus } from '../generated/prisma/client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Cả hai route đánh giá đều nhận multipart/form-data (vì có upload ảnh) nên
// rating tới đây là chuỗi — parseIntField ghi số đã parse ngược lại vào body.
const RATING_FIELD = { min: 1, max: 5, message: 'Đánh giá phải từ 1 đến 5 sao' }

function validateContent(
  res: Response,
  content: unknown,
  opts: { required?: boolean; min?: number; max?: number } = {}
): boolean {
  const { required = false, min = 10, max = 2000 } = opts

  if (required && (!content || typeof content !== 'string' || content.toString().trim().length === 0)) {
    sendError(res, 400, `Nội dung phải có ít nhất ${min} ký tự`)
    return false
  }
  if (content === undefined || content === null) return true

  if (typeof content !== 'string') {
    sendError(res, 400, 'Nội dung không hợp lệ')
    return false
  }
  const len = content.trim().length
  if (len < min) { sendError(res, 400, `Nội dung phải có ít nhất ${min} ký tự`);      return false }
  if (len > max) { sendError(res, 400, `Nội dung không được quá ${max} ký tự`);       return false }
  return true
}

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateCreateReview(req: Request, res: Response, next: NextFunction): void {
  if (!parseIntField(res, req.body, 'rating', RATING_FIELD))       return
  if (!validateContent(res, req.body.content, { required: true })) return
  next()
}

export function validateUpdateReview(req: Request, res: Response, next: NextFunction): void {
  const { rating, content } = req.body

  if (rating === undefined && content === undefined) {
    sendError(res, 400, 'Không có gì để cập nhật')
    return
  }
  if (rating  !== undefined && !parseIntField(res, req.body, 'rating', RATING_FIELD)) return
  if (content !== undefined && !validateContent(res, content))                        return
  next()
}

export function validateUpdateReviewStatus(req: Request, res: Response, next: NextFunction): void {
  if (!Object.values(ReviewStatus).includes(req.body.status)) {
    sendError(res, 400, 'Trạng thái không hợp lệ')
    return
  }
  next()
}

export function validateReplyReview(req: Request, res: Response, next: NextFunction): void {
  if (!validateContent(res, req.body.content, { required: true, min: 1, max: 1000 })) return
  next()
}
