import { API_URL } from './config'
import type { ApiErrorBody } from '@/types/api'
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from '../auth/token-storage'

// ─────────────────────────────────────────────────────────────────────────────
// HTTP client gọn nhẹ bọc fetch:
//  - Tự gắn Authorization: Bearer <accessToken>
//  - Tự refresh token 1 lần khi gặp 401 rồi retry request
//  - Hỗ trợ JSON và multipart/form-data (upload ảnh)
//  - Ném ApiError với message tiếng Việt từ backend ({ message })
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface RequestOptions {
  /** Gắn token vào header. Mặc định true. Đặt false cho endpoint public. */
  auth?: boolean
  /** Query params dạng object — tự build querystring */
  params?: Record<string, string | number | boolean | undefined>
  /**
   * Số giây cache (ISR) khi gọi từ Server Component. Next.js 15+ mặc định
   * fetch là `no-store`; truyền giá trị này để bật revalidate cho data công khai
   * (catalog sản phẩm/danh mục). KHÔNG dùng cho data theo từng user (giỏ, đơn).
   */
  revalidate?: number
}

// Internal flag passed only inside this module to prevent refresh recursion
interface InternalOptions extends RequestOptions {
  _skipRefresh?: boolean
}

function buildUrl(
  path: string,
  params?: RequestOptions['params'],
): string {
  const url = new URL(API_URL + path)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

async function parseError(res: Response): Promise<never> {
  let message = `Lỗi ${res.status}`
  try {
    const body = (await res.json()) as ApiErrorBody
    if (body?.message) message = body.message
  } catch {
    /* body không phải JSON — giữ message mặc định */
  }
  throw new ApiError(res.status, message)
}

/** Gọi POST /auth/refresh để lấy cặp token mới. Trả về true nếu thành công. */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  const res = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })

  if (!res.ok) {
    clearTokens()
    return false
  }

  const data = (await res.json()) as {
    accessToken: string
    refreshToken: string
  }
  setTokens(data.accessToken, data.refreshToken)
  return true
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: InternalOptions = {},
): Promise<T> {
  const { auth = true, params, revalidate, _skipRefresh } = options

  const headers: Record<string, string> = {}
  const isFormData = body instanceof FormData

  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json'
  }
  if (auth) {
    const token = getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    // Server Component: bật ISR khi có revalidate; ngược lại giữ no-store mặc định
    ...(revalidate !== undefined ? { next: { revalidate } } : {}),
  })

  // Token hết hạn → thử refresh 1 lần rồi retry
  if (res.status === 401 && auth && !_skipRefresh) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return request<T>(method, path, body, { ...options, _skipRefresh: true })
    }
  }

  if (!res.ok) return parseError(res)

  // 204 No Content
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),
}

