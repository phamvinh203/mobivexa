import { http, ApiError } from '@/lib/api/http'
import type {
  RegisterPayload,
  LoginPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  AuthUser,
} from './types'

// login/register/logout đi qua BFF Route Handler same-origin (/api/auth/*) để
// set/xoá HttpOnly cookie. Token KHÔNG bao giờ trả về cho JavaScript client.
async function authFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? 'Có lỗi xảy ra')
  }
  return data as T
}

export const authApi = {
  register: (body: RegisterPayload) =>
    authFetch<{ user: AuthUser }>('/api/auth/register', body),

  login: (body: LoginPayload) =>
    authFetch<{ user: AuthUser }>('/api/auth/login', body),

  logout: () => authFetch<{ message: string }>('/api/auth/logout', {}),

  // forgot/reset là public — đi qua proxy tới backend (auth:false)
  forgotPassword: (body: ForgotPasswordPayload) =>
    http.post<{ message: string }>('/auth/forgot-password', body, { auth: false }),

  resetPassword: (body: ResetPasswordPayload) =>
    http.post<{ message: string }>('/auth/reset-password', body, { auth: false }),
}
