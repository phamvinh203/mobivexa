import { Request, Response, NextFunction } from 'express'
import { checkName } from './common.validator'

export function validateCreateBrand(req: Request, res: Response, next: NextFunction): void {
  if (!checkName(res, req.body.name, 'Tên thương hiệu')) return
  next()
}

export function validateUpdateBrand(req: Request, res: Response, next: NextFunction): void {
  if (!checkName(res, req.body.name, 'Tên thương hiệu', { optional: true })) return
  next()
}
