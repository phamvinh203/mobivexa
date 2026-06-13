import { API_URL, PROXY_BASE } from './config'
import type { ApiErrorBody } from '@/types/api'

// ─────────────────────────────────────────────────────────────────────────────
// HTTP client bọc fetch. KHÔNG còn xử lý token phía client (token nằm trong
// HttpOnly cookie do BFF quản lý):
//  - Phía client: mọi request đi qua BFF proxy same-origin (/api/backend/*),
//    cookie tự gửi kèm, proxy gắn Bearer + tự refresh khi 401.
//  - Phía server (Server Component): chỉ cho phép endpoint public (auth:false),
//    gọi thẳng backend bằng URL tuyệt đối để cache được (ISR).
//  - Hỗ trợ JSON + FormData (upload). Lỗi 5xx → message generic, tránh rò rỉ.
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
  /** Có cần đăng nhập không. Mặc định true. Đặt false cho endpoint public. */
  auth?: boolean
  /** Query params dạng object — tự build querystring */
  params?: Record<string, string | number | boolean | undefined>
  /**
   * Số giây cache (ISR) khi gọi public từ Server Component. Chỉ có tác dụng
   * server-side; client luôn fetch trực tiếp.
   */
  revalidate?: number
}

function buildUrl(
  base: string,
  path: string,
  params?: RequestOptions['params'],
): string {
  let url = base + path
  if (params) {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        qs.set(key, String(value))
      }
    }
    const s = qs.toString()
    if (s) url += (url.includes('?') ? '&' : '?') + s
  }
  return url
}

async function parseError(res: Response): Promise<never> {
  // 5xx: không lộ chi tiết nội bộ. 4xx: giữ message backend (thường actionable).
  let message =
    res.status >= 500 ? 'Lỗi hệ thống, vui lòng thử lại sau' : `Lỗi ${res.status}`
  if (res.status < 500) {
    try {
      const body = (await res.json()) as ApiErrorBody
      if (body?.message) message = body.message
    } catch {
      /* body không phải JSON — giữ message mặc định */
    }
  }
  throw new ApiError(res.status, message)
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true, params, revalidate } = options
  const onServer = typeof window === 'undefined'

  // Server Component không có cookie context ở client → chỉ phục vụ public data.
  if (auth && onServer) {
    throw new Error(
      'Không thể gọi API cần đăng nhập từ Server Component qua http client — ' +
        'hãy gọi từ Client Component (cookie sẽ tự đi qua BFF proxy).',
    )
  }

  // Client: luôn qua BFF proxy same-origin (tránh CORS, cookie tự gửi).
  // Server: gọi thẳng backend (public, URL tuyệt đối, cache được).
  const base = onServer ? API_URL : PROXY_BASE

  const headers: Record<string, string> = {}
  const isFormData = body instanceof FormData
  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(buildUrl(base, path, params), {
    method,
    headers,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    credentials: onServer ? 'same-origin' : 'include',
    ...(revalidate !== undefined ? { next: { revalidate } } : {}),
  })

  if (!res.ok) return parseError(res)
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
