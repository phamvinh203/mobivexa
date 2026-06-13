import { http } from '@/lib/api/http'
import type {
  RegisterPayload,
  RegisterResult,
  LoginPayload,
  LoginResult,
  TokenPair,
  ForgotPasswordPayload,
  ResetPasswordPayload,
} from './types'

// Khớp src/routes/auth.route.ts — prefix /auth, tất cả public
export const authApi = {
  register: (body: RegisterPayload) =>
    http.post<RegisterResult>('/auth/register', body, { auth: false }),

  login: (body: LoginPayload) =>
    http.post<LoginResult>('/auth/login', body, { auth: false }),

  refresh: (refreshToken: string) =>
    http.post<TokenPair>('/auth/refresh', { refreshToken }, { auth: false }),

  forgotPassword: (body: ForgotPasswordPayload) =>
    http.post<{ message: string }>('/auth/forgot-password', body, { auth: false }),

  resetPassword: (body: ResetPasswordPayload) =>
    http.post<{ message: string }>('/auth/reset-password', body, { auth: false }),

  logout: (refreshToken: string) =>
    http.post<{ message: string }>('/auth/logout', { refreshToken }),
}
