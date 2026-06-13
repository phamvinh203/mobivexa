// URL gốc của backend. Đặt trong .env.local: NEXT_PUBLIC_API_URL
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api'

// Fail-fast: ở production bắt buộc cấu hình URL backend, tránh request fail thầm lặng
if (
  process.env.NODE_ENV === 'production' &&
  !process.env.NEXT_PUBLIC_API_URL
) {
  throw new Error(
    'NEXT_PUBLIC_API_URL chưa được cấu hình cho môi trường production.',
  )
}

// Base của BFF proxy (Next.js Route Handler) — client gọi same-origin, cookie
// HttpOnly tự gửi kèm, proxy gắn Bearer token phía server.
export const PROXY_BASE = '/api/backend'
