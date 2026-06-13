import { NextRequest, NextResponse } from 'next/server'
import { API_URL } from '@/lib/api/config'
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
  cookieOptions,
} from '@/lib/server/cookies'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// BFF proxy: client gọi same-origin /api/backend/<path>. Proxy đọc access token
// từ HttpOnly cookie, gắn Bearer, forward tới backend. Gặp 401 → tự refresh bằng
// refresh-cookie, set cookie mới rồi retry. Token không bao giờ lộ ra client.
// ─────────────────────────────────────────────────────────────────────────────

function forward(
  path: string,
  search: string,
  method: string,
  contentType: string | null,
  body: ArrayBuffer | undefined,
  accessToken?: string,
) {
  const headers = new Headers()
  if (contentType) headers.set('content-type', contentType)
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`)
  return fetch(`${API_URL}/${path}${search}`, {
    method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
  })
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params
  const joined = path.join('/')
  const search = req.nextUrl.search
  const method = req.method
  const contentType = req.headers.get('content-type')

  // CSRF defense-in-depth: với request thay đổi dữ liệu, Origin phải khớp host.
  // (sameSite=lax đã chặn cookie cross-site, đây là lớp thứ hai.)
  if (!SAFE_METHODS.has(method)) {
    const origin = req.headers.get('origin')
    if (origin && new URL(origin).host !== req.headers.get('host')) {
      return NextResponse.json(
        { message: 'Yêu cầu bị từ chối (origin không hợp lệ)' },
        { status: 403 },
      )
    }
  }
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await req.arrayBuffer()

  const access = req.cookies.get(ACCESS_COOKIE)?.value
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value

  let backendRes = await forward(joined, search, method, contentType, body, access)

  let newAccess: string | undefined
  let newRefresh: string | undefined

  // Token hết hạn → refresh 1 lần rồi retry
  if (backendRes.status === 401 && refresh) {
    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    })
    if (refreshRes.ok) {
      const tokens = await refreshRes.json()
      newAccess = tokens.accessToken
      newRefresh = tokens.refreshToken
      backendRes = await forward(joined, search, method, contentType, body, newAccess)
    } else {
      const expired = NextResponse.json(
        { message: 'Phiên đăng nhập đã hết hạn' },
        { status: 401 },
      )
      expired.cookies.delete(ACCESS_COOKIE)
      expired.cookies.delete(REFRESH_COOKIE)
      return expired
    }
  }

  const resBody = await backendRes.arrayBuffer()
  const out = new NextResponse(resBody, {
    status: backendRes.status,
    headers: {
      'content-type':
        backendRes.headers.get('content-type') ?? 'application/json',
    },
  })
  if (newAccess) out.cookies.set(ACCESS_COOKIE, newAccess, cookieOptions(ACCESS_MAX_AGE))
  if (newRefresh) out.cookies.set(REFRESH_COOKIE, newRefresh, cookieOptions(REFRESH_MAX_AGE))
  return out
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
}
