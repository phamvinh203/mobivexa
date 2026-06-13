import type { UserRole } from '@/types/api'

/** User an toàn (không có passwordHash) — khớp safeUser bên backend */
export interface AuthUser {
  id: string
  email: string
  phone: string | null
  fullName: string
  avatarUrl: string | null
  role: UserRole
  isActive: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface RegisterPayload {
  email: string
  fullName: string
  password: string
  phone?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResult {
  message: string
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface RegisterResult {
  message: string
  user: AuthUser
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  otp: string
  newPassword: string
}
