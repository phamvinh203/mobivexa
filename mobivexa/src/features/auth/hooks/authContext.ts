import { createContext } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type {
  AuthUser,
  LoginPayload,
  RegisteredUser,
  RegisterPayload,
} from "../types";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /**
   * Đang xác nhận phiên với server lần đầu (chưa có gì để hiển thị).
   * Nếu localStorage còn cache user thì cờ này đã là false — giao diện dựng
   * ngay từ cache rồi đồng bộ ngầm ở nền.
   */
  isRestoring: boolean;
  /** Trả nguyên mutation (không phải mutateAsync) để form đọc thẳng
   *  isPending/error, khỏi tự dựng lại state loading + lỗi. */
  login: UseMutationResult<AuthUser, Error, LoginPayload>;
  register: UseMutationResult<RegisteredUser, Error, RegisterPayload>;
  logout: () => Promise<void>;
  /** Thay toàn bộ user (khi đã có object đầy đủ từ server). */
  setUser: (user: AuthUser) => void;
  /** Cập nhật một phần user, vd chỉ đổi avatarUrl. */
  patchUser: (patch: Partial<AuthUser>) => void;
}

// Tách khỏi AuthProvider.tsx để file component chỉ export component — giữ
// react-refresh (hot reload) hoạt động đúng.
export const AuthContext = createContext<AuthContextValue | null>(null);
