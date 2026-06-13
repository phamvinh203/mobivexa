// Cấu hình cookie HttpOnly lưu token — CHỈ dùng phía server (Route Handler +
// middleware). Token không bao giờ lộ ra JavaScript phía client.
import 'server-only'

export const ACCESS_COOKIE = 'mbv_at'
export const REFRESH_COOKIE = 'mbv_rt'

// Access token đời ngắn; refresh token đời dài hơn. maxAge chỉ là gợi ý lưu trữ;
// thời hạn thực tế do backend kiểm soát khi verify token.
export const ACCESS_MAX_AGE = 60 * 60 // 1 giờ
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7 // 7 ngày

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}
