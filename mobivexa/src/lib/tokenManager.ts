import { env } from "./env";
import type { AuthUser } from "../features/auth/types";

// SPA thuần không có BFF/cookie httpOnly như bản Next.js — token phải tự lưu và
// tự đính kèm request. localStorage là lựa chọn thực dụng cho đồ án; nếu sau
// này cần chống XSS tốt hơn thì đổi sang cookie + refresh qua backend.
//
// Ngoài 2 token, ta cache luôn object user để lúc F5 dựng lại giao diện được
// ngay (tên, avatar) trong khi chờ getMe() xác nhận lại — tránh chớp loading.
const { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } = env;

function readUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    // Cache hỏng (sửa tay / đổi format) — bỏ đi, getMe() sẽ nạp lại.
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function hasSession(): boolean {
  return localStorage.getItem(ACCESS_TOKEN_KEY) !== null;
}

// "Phiên đã kết thúc" có ba nguồn: người dùng bấm đăng xuất, refresh token hỏng,
// và đăng xuất ở tab khác. Cả ba đều đi qua clear() nên đăng ký ở đây là đủ —
// tầng trên không cần biết tên key hay tự nghe sự kiện storage.
type SessionListener = () => void;
const listeners = new Set<SessionListener>();

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    // e.key === null khi localStorage.clear() ở tab khác.
    if (e.key !== null && e.key !== ACCESS_TOKEN_KEY) return;
    if (!hasSession()) listeners.forEach((listener) => listener());
  });
}

export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),

  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),

  getUser: readUser,

  /** Có phiên đăng nhập lưu sẵn không (chưa chắc còn hiệu lực). */
  hasSession,

  /** Lưu toàn bộ phiên sau khi đăng nhập thành công. */
  setSession: (
    accessToken: string,
    refreshToken: string,
    user: AuthUser,
  ): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  /** Cập nhật cặp token sau khi refresh (user giữ nguyên). */
  setTokens: (accessToken: string, refreshToken: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  setUser: (user: AuthUser): void => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clear: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    listeners.forEach((listener) => listener());
  },

  /** Gọi listener mỗi khi phiên kết thúc (tab này hoặc tab khác). */
  onSessionEnd: (listener: SessionListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
