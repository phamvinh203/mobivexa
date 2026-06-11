import jwt from 'jsonwebtoken'
import { JwtPayload } from '../types/auth.type'

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string
const ACCESS_EXPIRES = (process.env.JWT_ACCESS_EXPIRES ?? '15m') as string
const REFRESH_EXPIRES = (process.env.JWT_REFRESH_EXPIRES ?? '7d') as string

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions)
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload
}
