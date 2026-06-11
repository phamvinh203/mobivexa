import { Request, Response, NextFunction } from 'express'
import { UserRole } from '../generated/prisma/client'
import { sendError } from '../helpers/response'

const VALID_ROLES = new Set(Object.values(UserRole))

export function validateUpdateUserRole(req: Request, res: Response, next: NextFunction): void {
  const { role } = req.body
  if (!role || !VALID_ROLES.has(role)) {
    sendError(res, 400, `Role không hợp lệ. Hợp lệ: ${[...VALID_ROLES].join(', ')}`)
    return
  }
  next()
}
