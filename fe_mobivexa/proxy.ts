import { NextRequest, NextResponse } from 'next/server'
import { REFRESH_COOKIE } from '@/lib/server/cookies'

// Chặn server-side: route /admin và /account yêu cầu có refresh token (HttpOnly
// cookie). Đây là lớp bảo vệ THẬT trước khi Next.js render — RouteGuard phía
// client chỉ còn lo trải nghiệm + ẩn/hiện UI theo vai trò.
//
// Lưu ý: proxy chỉ kiểm tra SỰ TỒN TẠI của token, không decode vai trò
// (cần secret). Phân quyền theo role vẫn do backend enforce trên mỗi API.
export function proxy(req: NextRequest) {
  // Gate theo refresh cookie (đời dài) — access cookie có thể đã hết hạn nhưng
  // BFF proxy vẫn tự refresh được. Token hợp lệ hay không do backend quyết định.
  const hasToken = Boolean(req.cookies.get(REFRESH_COOKIE)?.value)
  const { pathname, search } = req.nextUrl

  if (!hasToken) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname + search)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
}
