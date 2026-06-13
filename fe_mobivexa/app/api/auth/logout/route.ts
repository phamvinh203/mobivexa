import { NextRequest, NextResponse } from 'next/server'
import { API_URL } from '@/lib/api/config'
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/server/cookies'

export const runtime = 'nodejs'

// BFF logout: lấy refresh token từ cookie, báo backend thu hồi, rồi xoá cookie.
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value

  if (refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {
      /* kể cả backend lỗi vẫn xoá cookie local */
    })
  }

  const out = NextResponse.json({ message: 'Đăng xuất thành công' })
  out.cookies.delete(ACCESS_COOKIE)
  out.cookies.delete(REFRESH_COOKIE)
  return out
}
