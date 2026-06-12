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
  return jwt.sign(payload, ACCESS_SECRET!, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions)
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET!, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET!, { algorithms: ['HS256'] }) as JwtPayload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET!, { algorithms: ['HS256'] }) as JwtPayload
}
