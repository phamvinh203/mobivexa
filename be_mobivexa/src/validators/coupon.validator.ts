import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { CouponType } from '../generated/prisma/client'

const CODE_RE = /^[A-Z0-9_-]{3,32}$/

// Kiểm tra chung cho create và update. `partial` bật lên khi update — field không
// gửi lên thì bỏ qua, field có gửi thì vẫn phải đúng.
function validateBody(req: Request, res: Response, partial: boolean): boolean {
  const b = req.body ?? {}
  const has = (k: string) => b[k] !== undefined && b[k] !== null

  if (!partial || has('code')) {
    if (typeof b.code !== 'string' || !CODE_RE.test(b.code.trim().toUpperCase())) {
      sendError(res, 400, 'Mã chỉ gồm chữ, số, gạch ngang và gạch dưới, dài 3-32 ký tự')
      return false
    }
  }

  if (!partial || has('type')) {
    if (!Object.values(CouponType).includes(b.type)) {
      sendError(res, 400, 'Loại mã giảm giá không hợp lệ')
      return false
    }
  }

  if (!partial || has('value')) {
    const value = Number(b.value)
    if (!Number.isFinite(value) || value <= 0) {
      sendError(res, 400, 'Giá trị giảm phải là số dương')
      return false
    }
    if (b.type === CouponType.PERCENT && value > 100) {
      sendError(res, 400, 'Giảm theo phần trăm không được vượt quá 100')
      return false
    }
  }

  // Trần giảm chỉ có nghĩa với PERCENT. Báo lỗi chứ không bỏ qua im lặng: admin
  // đặt trần cho mã tiền cố định là đang hiểu nhầm, để họ tưởng đã đặt được thì
  // tệ hơn là báo ngay.
  if (has('maxDiscount')) {
    if (b.type === CouponType.FIXED) {
      sendError(res, 400, 'Mã giảm số tiền cố định không có trần giảm')
      return false
    }
    const max = Number(b.maxDiscount)
    if (!Number.isFinite(max) || max <= 0) {
      sendError(res, 400, 'Trần giảm phải là số dương')
      return false
    }
  }

  if (has('minOrderValue')) {
    const min = Number(b.minOrderValue)
    if (!Number.isFinite(min) || min < 0) {
      sendError(res, 400, 'Giá trị đơn tối thiểu không được là số âm')
      return false
    }
  }

  if (has('usageLimit')) {
    const limit = Number(b.usageLimit)
    if (!Number.isInteger(limit) || limit <= 0) {
      sendError(res, 400, 'Giới hạn lượt dùng phải là số nguyên dương')
      return false
    }
  }

  if (!partial || has('startsAt') || has('endsAt')) {
    const starts = new Date(b.startsAt)
    const ends   = new Date(b.endsAt)

    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      sendError(res, 400, 'Thời gian áp dụng không hợp lệ')
      return false
    }
    if (ends <= starts) {
      sendError(res, 400, 'Thời gian kết thúc phải sau thời gian bắt đầu')
      return false
    }
  }

  return true
}

export function validateCreateCoupon(req: Request, res: Response, next: NextFunction): void {
  if (!validateBody(req, res, false)) return
  next()
}

export function validateUpdateCoupon(req: Request, res: Response, next: NextFunction): void {
  if (!validateBody(req, res, true)) return
  next()
}
