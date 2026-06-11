import { Request, Response, NextFunction } from 'express'
import { checkName } from './common.validator'

export function validateCreateCategory(req: Request, res: Response, next: NextFunction): void {
  if (!checkName(res, req.body.name, 'Tên danh mục')) return
  next()
}

export function validateUpdateCategory(req: Request, res: Response, next: NextFunction): void {
  if (!checkName(res, req.body.name, 'Tên danh mục', { optional: true })) return
  next()
}
