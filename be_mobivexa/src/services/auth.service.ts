import crypto from 'crypto'
import prisma from '../config/db'
import { AppError } from '../helpers/app_error'
import { isPrismaError } from '../helpers/prisma_error'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/token_manager'
import { hashPassword, verifyPassword } from '../utils/password'
import { sendResetPasswordEmail } from '../utils/mailer'
import type { RegisterBody, LoginBody, JwtPayload } from '../types/auth.type'

const RESET_TOKEN_EXPIRES_MS = 15 * 60 * 1000 // 15 phút
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000 // 7 ngày

// Hash-at-rest: DB chỉ lưu sha256, rò rỉ DB không cho dùng lại token/OTP gốc
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function hashesMatch(storedToken: string | null, providedToken: string): boolean {
  if (!storedToken || storedToken.length !== providedToken.length) return false
  return crypto.timingSafeEqual(Buffer.from(storedToken), Buffer.from(providedToken))
}

function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS)
}

export async function registerService(body: RegisterBody) {
  const { email, fullName, password } = body

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) throw new AppError(409, 'Email đã được sử dụng')

  const passwordHash = await hashPassword(password)

  try {
    return await prisma.user.create({
      data: { email, fullName, passwordHash },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    })
  } catch (err) {
    // Double-submit song song vượt qua pre-check ở trên, unique index là chốt chặn cuối
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Email đã được sử dụng')
    throw err
  }
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

  // Lưu bản hash của refresh token — bản gốc JWT chỉ tồn tại ở client
  await prisma.refreshToken.create({
    data: { token: hashToken(refreshToken), userId: user.id, expiresAt: refreshExpiry() },
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

  const stored = await prisma.refreshToken.findUnique({ where: { token: hashToken(token) } })
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
      data: { token: hashToken(newRefreshToken), userId: stored.userId, expiresAt: refreshExpiry() },
    }),
  ])

  return { accessToken, refreshToken: newRefreshToken }
}

export async function forgotPasswordService(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  // Không tiết lộ user tồn tại hay không
  if (!user) return

  // OTP 6 chữ số — hash trước khi lưu DB, chỉ gửi bản gốc qua email
  const otp = String(crypto.randomInt(100000, 1000000))
  const hashedOtp = hashToken(otp)
  const expires = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS)

  await prisma.user.update({
    where: { id: user.id },
    data: { resetPasswordToken: hashedOtp, resetPasswordExpires: expires, resetPasswordAttempts: 0 },
  })

  await sendResetPasswordEmail(email, otp)
}

const MAX_RESET_ATTEMPTS = 5

export async function resetPasswordService(otp: string, newPassword: string, email?: string) {
  const hashedToken = hashToken(otp)

  // Khi client gửi kèm email: OTP tra theo đúng user đó và MỌI lần đoán sai đều
  // tăng resetPasswordAttempts — không có email thì đoán sai không biết key vào
  // user nào, Counter MAX_RESET_ATTEMPTS chỉ bật được qua nhánh email này
  // (FE hiện tại chưa gửi email, lúc đó chỉ còn authLimiter chắn brute-force).
  if (email) {
    const target = await prisma.user.findUnique({ where: { email } })

    if (target) {
      // Chỉ đếm khi user đang giữ OTP còn hạn — hết hạn/trống thì không cần đếm
      if (target.resetPasswordToken && target.resetPasswordExpires && target.resetPasswordExpires > new Date()) {
        await prisma.user.updateMany({
          where: { id: target.id, resetPasswordAttempts: { lt: MAX_RESET_ATTEMPTS } },
          data: { resetPasswordAttempts: { increment: 1 } },
        })
      }

      const match = await prisma.user.findFirst({
        where: {
          id: target.id,
          resetPasswordToken: hashedToken,
          resetPasswordExpires: { gt: new Date() },
        },
      })

      if (!match) throw new AppError(400, 'Token không hợp lệ hoặc đã hết hạn')

      if (match.resetPasswordAttempts >= MAX_RESET_ATTEMPTS) {
        await prisma.user.update({
          where: { id: match.id },
          data: { resetPasswordToken: null, resetPasswordExpires: null, resetPasswordAttempts: 0 },
        })
        throw new AppError(400, 'Token không hợp lệ hoặc đã hết hạn')
      }

      await finishResetPassword(match.id, newPassword)
      return
    }
  }

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { gt: new Date() },
    },
  })

  if (!user) {
    throw new AppError(400, 'Token không hợp lệ hoặc đã hết hạn')
  }

  if (user.resetPasswordAttempts >= MAX_RESET_ATTEMPTS) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: null, resetPasswordExpires: null, resetPasswordAttempts: 0 },
    })
    throw new AppError(400, 'Token không hợp lệ hoặc đã hết hạn')
  }

  await finishResetPassword(user.id, newPassword)
}

async function finishResetPassword(userId: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword)

  // Đổi mật khẩu + revoke toàn bộ refresh token cũ trong 1 transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, resetPasswordToken: null, resetPasswordExpires: null, resetPasswordAttempts: 0 },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    }),
  ])
}

export function logoutService(token: string) {
  return prisma.refreshToken.updateMany({
    where: { token: hashToken(token), isRevoked: false },
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
