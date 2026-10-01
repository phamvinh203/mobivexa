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

// Hash bcrypt hợp lệ của một chuỗi ngẫu nhiên — không khớp mật khẩu của ai.
// Dùng để so khi user không tồn tại, cân bằng thời gian phản hồi chống user enumeration.
const DUMMY_PASSWORD_HASH = '$2b$10$GUAyGGNGesBDUdElBSCjdu8jxJUjtW4ItGrVgtFApRAIgCmo5NkpW'

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Refresh token lưu DB dạng SHA-256 hash — DB bị dump/backup lộ cũng không dùng
// được token. Lưu ý: đổi cách lưu làm chết các phiên đăng nhập cũ trong DB dev
// (dự án dùng `prisma db push`, không có migration — người dùng chỉ cần đăng nhập lại).
const hashToken = hashResetToken

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
    // Race: hai request đăng ký cùng email lọt qua check ở trên — unique index
    // của DB chặn. Trả cùng 409 như nhánh exists.
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Email đã được sử dụng')
    throw err
  }
}

export async function loginService(body: LoginBody) {
  const { email, password } = body

  const user = await prisma.user.findUnique({ where: { email } })

  // Luôn chạy bcrypt.compare (khi user không tồn tại thì so với dummy hash) để
  // thời gian phản hồi như nhau — tránh đoán email tồn tại hay không qua timing.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)
  if (!user?.passwordHash || !valid) throw new AppError(401, 'Email hoặc mật khẩu không đúng')
  if (!user.isActive) throw new AppError(403, 'Tài khoản đã bị khóa')

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  await prisma.refreshToken.create({
    data: { token: hashToken(refreshToken), userId: user.id, expiresAt: refreshExpiry() },
  })

  const { passwordHash: _, resetPasswordToken: __, resetPasswordExpires: ___, ...safeUser } = user

  return { accessToken, refreshToken, user: safeUser }
}

export async function refreshTokenService(token: string) {
  // Kiểm tra chữ ký + hạn của JWT; giá trị payload KHÔNG dùng để cấp token mới
  try {
    verifyRefreshToken(token)
  } catch {
    throw new AppError(401, 'Refresh token không hợp lệ hoặc đã hết hạn')
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: hashToken(token) } })
  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
    throw new AppError(401, 'Refresh token không hợp lệ')
  }

  // Role/isActive phải đọc lại từ DB: JWT cũ có thể đã lỗi thời (user bị khóa,
  // bị hạ role) — copy từ JWT thì user bị khóa vẫn refresh vô hạn với quyền cũ.
  const user = await prisma.user.findUnique({
    where: { id: stored.userId },
    select: { id: true, email: true, role: true, isActive: true },
  })
  if (!user || !user.isActive) {
    // Tài khoản không còn khả dụng — thu hồi luôn token đang cầm
    await prisma.refreshToken.updateMany({
      where: { id: stored.id, isRevoked: false },
      data: { isRevoked: true },
    })
    throw new AppError(401, 'Tài khoản không khả dụng hoặc đã bị khóa')
  }

  const newPayload: JwtPayload = { userId: user.id, email: user.email, role: user.role }
  const accessToken = signAccessToken(newPayload)
  const newRefreshToken = signRefreshToken(newPayload)

  // Rotate có điều kiện: chỉ revoke nếu token VẪN chưa thu hồi. Hai request
  // refresh song song cùng dùng 1 token thì đúng 1 request thắng — request thua
  // (count === 0) là dấu hiệu token reuse → thu hồi toàn bộ phiên của user.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, isRevoked: false },
    data: { isRevoked: true },
  })
  if (count === 0) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, isRevoked: false },
      data: { isRevoked: true },
    })
    throw new AppError(401, 'Refresh token đã bị sử dụng lại, vui lòng đăng nhập lại')
  }

  await prisma.refreshToken.create({
    data: { token: hashToken(newRefreshToken), userId: stored.userId, expiresAt: refreshExpiry() },
  })

  return { accessToken, refreshToken: newRefreshToken }
}

export async function forgotPasswordService(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  // Không tiết lộ user tồn tại hay không
  if (!user) return

  // OTP 6 chữ số — crypto.randomInt (an toàn mật mã, không dùng Math.random);
  // hash trước khi lưu DB, chỉ gửi bản gốc qua email
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
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
  // DB lưu hash nên tra cứu theo hash của token nhận được
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
