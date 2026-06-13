import { NextRequest, NextResponse } from 'next/server'
import { API_URL } from '@/lib/api/config'

export const runtime = 'nodejs'

// BFF register: backend trả { message, user } (không có token) → đăng ký xong
// vẫn cần đăng nhập. Chỉ forward kết quả.
export async function POST(req: NextRequest) {
  const body = await req.text()
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return NextResponse.json(
      { message: data?.message ?? 'Đăng ký thất bại' },
      { status: res.status },
    )
  }
  return NextResponse.json({ user: data.user }, { status: 201 })
}
