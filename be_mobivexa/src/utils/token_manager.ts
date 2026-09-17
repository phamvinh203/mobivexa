import jwt from 'jsonwebtoken'
import { JwtPayload } from '../types/auth.type'

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES  ?? '15m'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES ?? '7d'

// Fail fast: server không được khởi động khi thiếu hoặc yếu JWT secret
if (!ACCESS_SECRET || ACCESS_SECRET.length < 32) {
  throw new Error('JWT_ACCESS_SECRET phải được đặt và dài ít nhất 32 ký tự')
}
if (!REFRESH_SECRET || REFRESH_SECRET.length < 32) {
  throw new Error('JWT_REFRESH_SECRET phải được đặt và dài ít nhất 32 ký tự')
}

export function signAccessToken(payload: JwtPayload): string {
  // typ giúp phân biệt access token với guest-chat token dù cùng dùng ACCESS_SECRET
  return jwt.sign({ ...payload, typ: 'access' }, ACCESS_SECRET!, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions)
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET!, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): JwtPayload {
  const payload = jwt.verify(token, ACCESS_SECRET!, { algorithms: ['HS256'] }) as JwtPayload

  // Chống nhầm guest-chat token (cùng ACCESS_SECRET) làm access token:
  // thiếu userId là từ chối ngay, tránh Prisma lột điều kiện `where: { userId: undefined }`
  // thành query không giới hạn theo user.
  if (payload.typ === 'guest_chat') {
    throw new Error('Token không phải access token')
  }
  if (typeof payload.userId !== 'string' || !payload.userId) {
    throw new Error('Token thiếu định danh người dùng')
  }
  return payload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET!, { algorithms: ['HS256'] }) as JwtPayload
}

// Token sở hữu cho phiên chat của khách vãng lai: session id là cuid, không phải
// bí mật (có thể lộ qua log/referrer), nên chỉ ai giữ token này mới được coi là
// chủ phiên. Không dùng chung JwtPayload (không có userId/email/role thật).
// Cần typ riêng để verifyAccessToken nhận ra và từ chối, dù cùng ACCESS_SECRET.
interface GuestChatPayload {
  typ: 'guest_chat'
  sessionId: string
}

export function signGuestChatToken(sessionId: string): string {
  return jwt.sign({ typ: 'guest_chat', sessionId }, ACCESS_SECRET!, { expiresIn: '30d' } as jwt.SignOptions)
}

export function verifyGuestChatToken(token: string): string {
  const payload = jwt.verify(token, ACCESS_SECRET!, { algorithms: ['HS256'] }) as GuestChatPayload
  if (payload.typ !== 'guest_chat' || typeof payload.sessionId !== 'string' || !payload.sessionId) {
    throw new Error('Token không phải guest chat token')
  }
  return payload.sessionId
}
