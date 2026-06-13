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

// BFF login: gọi backend, nhận token trong body, set vào HttpOnly cookie.
// Client chỉ nhận lại { user } — token không bao giờ chạm tới JavaScript.
export async function POST(req: NextRequest) {
  const body = await req.text()
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return NextResponse.json(
      { message: data?.message ?? 'Đăng nhập thất bại' },
      { status: res.status },
    )
  }

  const out = NextResponse.json({ user: data.user })
  out.cookies.set(ACCESS_COOKIE, data.accessToken, cookieOptions(ACCESS_MAX_AGE))
  out.cookies.set(REFRESH_COOKIE, data.refreshToken, cookieOptions(REFRESH_MAX_AGE))
  return out
}
