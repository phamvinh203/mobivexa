import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { checkName } from './common.validator'

const PHONE_RE = /^(0|\+84)[0-9]{8,10}$/

export function validateUpdateProfile(req: Request, res: Response, next: NextFunction): void {
  const { fullName, phone } = req.body

  if (fullName !== undefined && String(fullName).trim().length < 2) {
    sendError(res, 400, 'Họ tên phải có ít nhất 2 ký tự')
    return
  }
  // phone: null là hợp lệ — service chủ đích hỗ trợ xóa số điện thoại
  if (phone !== undefined && phone !== null && !PHONE_RE.test(phone)) {
    sendError(res, 400, 'Số điện thoại không hợp lệ')
    return
  }
  // Chỉ chặn khi cả hai trường đều không được gửi; { phone: null } là một update hợp lệ
  if (fullName === undefined && phone === undefined) {
    sendError(res, 400, 'Vui lòng cung cấp ít nhất một trường cần cập nhật')
    return
  }

  next()
}

export function validateChangePassword(req: Request, res: Response, next: NextFunction): void {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword) {
    sendError(res, 400, 'Vui lòng nhập mật khẩu hiện tại')
    return
  }
  if (!newPassword || String(newPassword).length < 8) {
    sendError(res, 400, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    return
  }
  if (currentPassword === newPassword) {
    sendError(res, 400, 'Mật khẩu mới phải khác mật khẩu hiện tại')
    return
  }

  next()
}

export function validateAddress(req: Request, res: Response, next: NextFunction): void {
  const { fullName, phone, province, district, ward, streetDetail } = req.body

  if (!checkName(res, fullName, 'Họ tên người nhận')) return
  if (!phone || !PHONE_RE.test(phone)) {
    sendError(res, 400, 'Số điện thoại không hợp lệ')
    return
  }
  if (!province || !district || !ward || !streetDetail) {
    sendError(res, 400, 'Vui lòng điền đầy đủ thông tin địa chỉ')
    return
  }

  next()
}
