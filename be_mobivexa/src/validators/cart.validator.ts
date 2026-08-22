import { Request, Response, NextFunction } from 'express'
import { checkId, checkQuantity } from './common.validator'

export function validateAddItem(req: Request, res: Response, next: NextFunction): void {
  const { variantId, quantity } = req.body

  if (!checkId(res, variantId, 'variantId không hợp lệ')) return
  if (!checkQuantity(res, Number(quantity), 100)) return

  next()
}

export function validateUpdateItem(req: Request, res: Response, next: NextFunction): void {
  if (!checkQuantity(res, Number(req.body.quantity), 100)) return
  next()
}
