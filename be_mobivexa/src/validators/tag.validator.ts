import { Request, Response, NextFunction } from 'express'
import { checkName } from './common.validator'

export function validateCreateTag(req: Request, res: Response, next: NextFunction): void {
  if (!checkName(res, req.body.name, 'Tên tag', { min: 1 })) return
  next()
}
