import { Request, Response, NextFunction } from 'express'
import { checkId } from './common.validator'

export function validateAddFavorite(req: Request, res: Response, next: NextFunction): void {
  if (!checkId(res, req.body.productId, 'productId không hợp lệ')) return
  next()
}
