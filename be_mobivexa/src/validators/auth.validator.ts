import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Trả về true nếu email hợp lệ; ngược lại gửi lỗi 400 và trả về false
function checkEmail(res: Response, email: unknown): boolean {
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    sendError(res, 400, 'Email không hợp lệ')
    return false
  }
  return true
}

export function validateRegister(req: Request, res: Response, next: NextFunction): void {
  const { email, fullName, password } = req.body

  if (!checkEmail(res, email)) return
  if (!fullName || String(fullName).trim().length < 2) {
    sendError(res, 400, 'Họ tên phải có ít nhất 2 ký tự')
    return
  }
  if (!password || String(password).length < 8) {
    sendError(res, 400, 'Mật khẩu phải có ít nhất 8 ký tự')
    return
  }

  next()
}

export function validateLogin(req: Request, res: Response, next: NextFunction): void {
  const { email, password } = req.body

  if (!checkEmail(res, email)) return
  if (!password) {
    sendError(res, 400, 'Vui lòng nhập mật khẩu')
    return
  }

  next()
}

export function validateForgotPassword(req: Request, res: Response, next: NextFunction): void {
  if (!checkEmail(res, req.body.email)) return
  next()
}

export function validateResetPassword(req: Request, res: Response, next: NextFunction): void {
  const { otp, newPassword } = req.body

  if (!otp || !/^\d{6}$/.test(String(otp))) {
    sendError(res, 400, 'OTP phải là 6 chữ số')
    return
  }
  if (!newPassword || String(newPassword).length < 8) {
    sendError(res, 400, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    return
  }

  next()
}

export function validateRefreshToken(req: Request, res: Response, next: NextFunction): void {
  if (!req.body.refreshToken) {
    sendError(res, 400, 'Thiếu refresh token')
    return
  }
  next()
}
