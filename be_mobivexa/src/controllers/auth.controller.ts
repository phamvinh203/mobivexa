import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import {
  registerService,
  loginService,
  refreshTokenService,
  forgotPasswordService,
  resetPasswordService,
  logoutService,
} from '../services/auth.service'

export const register = asyncHandler(async (req, res) => {
  const user = await registerService(req.body)
  sendSuccess(res, { message: 'Đăng ký thành công', user }, 201)
})

export const login = asyncHandler(async (req, res) => {
  const result = await loginService(req.body)
  sendSuccess(res, { message: 'Đăng nhập thành công', ...result })
})

export const refreshToken = asyncHandler(async (req, res) => {
  const tokens = await refreshTokenService(req.body.refreshToken)
  sendSuccess(res, tokens)
})

export const forgotPassword = asyncHandler(async (req, res) => {
  await forgotPasswordService(req.body.email)
  // Luôn trả về 200 để không tiết lộ email có tồn tại hay không
  sendSuccess(res, { message: 'Nếu email tồn tại, mã OTP đã được gửi' })
})

export const resetPassword = asyncHandler(async (req, res) => {
  const { otp, newPassword } = req.body
  await resetPasswordService(otp, newPassword)
  sendSuccess(res, { message: 'Đặt lại mật khẩu thành công' })
})

export const logout = asyncHandler(async (req, res) => {
  await logoutService(req.body.refreshToken)
  sendSuccess(res, { message: 'Đăng xuất thành công' })
})
