// URL gốc của backend. Đặt trong .env.local: NEXT_PUBLIC_API_URL
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api'

// Key lưu token trong localStorage
export const TOKEN_KEYS = {
  access: 'mbv_access_token',
  refresh: 'mbv_refresh_token',
} as const
