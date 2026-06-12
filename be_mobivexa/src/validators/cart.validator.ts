import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'

function checkQuantity(res: Response, qty: number): boolean {
  if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
    sendError(res, 400, 'Số lượng phải là số nguyên từ 1 đến 100')
    return false
  }
  return true
}

export function validateAddItem(req: Request, res: Response, next: NextFunction): void {
  const { variantId, quantity } = req.body

  if (!variantId || typeof variantId !== 'string') {
    sendError(res, 400, 'variantId không hợp lệ')
    return
  }

  if (!checkQuantity(res, Number(quantity))) return

  next()
}

export function validateUpdateItem(req: Request, res: Response, next: NextFunction): void {
  if (!checkQuantity(res, Number(req.body.quantity))) return
  next()
}
