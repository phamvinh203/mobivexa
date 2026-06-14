import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { checkName } from './common.validator'
import { BannerPosition } from '../types/banner.type'

const VALID_POSITIONS = Object.values(BannerPosition)
const POSITIONS_HINT = VALID_POSITIONS.join(', ')

function checkPosition(res: Response, position: unknown, optional = false): boolean {
  if (position === undefined) {
    if (optional) return true
    sendError(res, 400, `Vị trí banner là bắt buộc. Các giá trị hợp lệ: ${POSITIONS_HINT}`)
    return false
  }
  if (!VALID_POSITIONS.includes(position as BannerPosition)) {
    sendError(res, 400, `Vị trí banner không hợp lệ. Các giá trị hợp lệ: ${POSITIONS_HINT}`)
    return false
  }
  return true
}

export function validateCreateBanner(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    sendError(res, 400, 'Ảnh banner là bắt buộc')
    return
  }
  if (!checkName(res, req.body.alt, 'Alt text')) return
  if (!checkPosition(res, req.body.position)) return
  next()
}

export function validateUpdateBanner(req: Request, res: Response, next: NextFunction): void {
  const { alt, position } = req.body
  if (!checkName(res, alt, 'Alt text', { optional: true })) return
  if (!checkPosition(res, position, true)) return
  next()
}
