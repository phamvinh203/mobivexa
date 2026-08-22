import crypto from 'crypto'
import prisma from '../config/db'
import { AppError } from '../helpers/app_error'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/token_manager'
import { hashPassword, verifyPassword } from '../utils/password'
import { sendResetPasswordEmail } from '../utils/mailer'
import type { RegisterBody, LoginBody, JwtPayload } from '../types/auth.type'

const RESET_TOKEN_EXPIRES_MS = 15 * 60 * 1000 // 15 phút
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000 // 7 ngày

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS)
}

export async function registerService(body: RegisterBody) {
  const { email, fullName, password } = body

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) throw new AppError(409, 'Email đã được sử dụng')

  const passwordHash = await hashPassword(password)

  return prisma.user.create({
    data: { email, fullName, passwordHash },
    select: { id: true, email: true, fullName: true, role: true, createdAt: true },
  })
}

export async function loginService(body: LoginBody) {
  const { email, password } = body

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash) throw new AppError(401, 'Email hoặc mật khẩu không đúng')
  if (!user.isActive) throw new AppError(403, 'Tài khoản đã bị khóa')

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw new AppError(401, 'Email hoặc mật khẩu không đúng')

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() },
  })

  const { passwordHash: _, resetPasswordToken: __, resetPasswordExpires: ___, ...safeUser } = user

  return { accessToken, refreshToken, user: safeUser }
}

export async function refreshTokenService(token: string) {
  let payload: JwtPayload
  try {
    payload = verifyRefreshToken(token)
  } catch {
    throw new AppError(401, 'Refresh token không hợp lệ hoặc đã hết hạn')
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } })
  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
    throw new AppError(401, 'Refresh token không hợp lệ')
  }

  const newPayload: JwtPayload = { userId: payload.userId, email: payload.email, role: payload.role }
  const accessToken = signAccessToken(newPayload)
  const newRefreshToken = signRefreshToken(newPayload)

  // Rotate atomically: revoke token cũ + tạo token mới trong 1 transaction
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { isRevoked: true } }),
    prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: stored.userId, expiresAt: refreshExpiry() },
    }),
  ])

  return { accessToken, refreshToken: newRefreshToken }
}

export async function forgotPasswordService(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  // Không tiết lộ user tồn tại hay không
  if (!user) return

  // OTP 6 chữ số — hash trước khi lưu DB, chỉ gửi bản gốc qua email
  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const hashedOtp = hashResetToken(otp)
  const expires = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS)

  await prisma.user.update({
    where: { id: user.id },
    data: { resetPasswordToken: hashedOtp, resetPasswordExpires: expires },
  })

  await sendResetPasswordEmail(email, otp)
}

export async function resetPasswordService(otp: string, newPassword: string) {
  const hashedToken = hashResetToken(otp)

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { gt: new Date() },
    },
  })

  if (!user) throw new AppError(400, 'Token không hợp lệ hoặc đã hết hạn')

  const passwordHash = await hashPassword(newPassword)

  // Đổi mật khẩu + revoke toàn bộ refresh token cũ trong 1 transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetPasswordToken: null, resetPasswordExpires: null },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, isRevoked: false },
      data: { isRevoked: true },
    }),
  ])
}

export function logoutService(token: string) {
  return prisma.refreshToken.updateMany({
    where: { token, isRevoked: false },
    data: { isRevoked: true },
  })
}

// Xóa token đã hết hạn hoặc bị thu hồi quá 7 ngày — chạy định kỳ để giữ bảng gọn
export async function cleanupExpiredTokens() {
  const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const { count } = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { isRevoked: true, createdAt: { lt: threshold } },
      ],
    },
  })
  if (count > 0) console.log(`[Auth] Đã xóa ${count} refresh token hết hạn`)
}
