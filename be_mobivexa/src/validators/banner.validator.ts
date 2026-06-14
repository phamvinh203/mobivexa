import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { BANNER_POSITIONS, type BannerPosition } from '../types/banner.type'

function checkPosition(res: Response, position: unknown, optional = false): boolean {
  if (position === undefined) return optional ? true : (sendError(res, 400, `Vị trí banner là bắt buộc. Các giá trị hợp lệ: ${BANNER_POSITIONS.join(', ')}`), false)
  if (!BANNER_POSITIONS.includes(position as BannerPosition)) {
    sendError(res, 400, `Vị trí banner không hợp lệ. Các giá trị hợp lệ: ${BANNER_POSITIONS.join(', ')}`)
    return false
  }
  return true
}

export function validateCreateBanner(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    sendError(res, 400, 'Ảnh banner là bắt buộc')
    return
  }
  const alt = req.body.alt?.trim()
  if (!alt || alt.length < 2) {
    sendError(res, 400, 'Alt text phải có ít nhất 2 ký tự')
    return
  }
  if (!checkPosition(res, req.body.position)) return
  next()
}

export function validateUpdateBanner(req: Request, res: Response, next: NextFunction): void {
  const { alt, position } = req.body
  if (alt !== undefined && (!alt || String(alt).trim().length < 2)) {
    sendError(res, 400, 'Alt text phải có ít nhất 2 ký tự')
    return
  }
  if (!checkPosition(res, position, true)) return
  next()
}
