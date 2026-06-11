import { Request, Response, NextFunction } from 'express'
import { UserRole } from '../generated/prisma/client'
import { sendError } from '../helpers/response'

// Nhóm role được phép quản trị (catalog, đơn hàng...). Gắn với enum UserRole nên rename schema sẽ báo lỗi biên dịch.
export const STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.STAFF]

// Chặn route theo role — dùng sau authenticate. Vd: authorize(...STAFF_ROLES)
export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'Chưa xác thực')
      return
    }
    if (!roles.includes(req.user.role as UserRole)) {
      sendError(res, 403, 'Bạn không có quyền thực hiện thao tác này')
      return
    }
    next()
  }
}
