import { apiClient } from "../../../lib/apiClient";
import { tokenStorage } from "../../../lib/tokenManager";
import type {
  AuthUser,
  LoginPayload,
  LoginResult,
  RegisteredUser,
  RegisterPayload,
  RegisterResult,
} from "../types";

// Khớp src/routes/auth.route.ts bên be_mobivexa.
export const authApi = {
  async register(payload: RegisterPayload): Promise<RegisteredUser> {
    const { data } = await apiClient.post<RegisterResult>(
      "/auth/register",
      payload,
    );
    return data.user;
  },

  // Backend trả kèm accessToken/refreshToken (không dùng cookie httpOnly) —
  // SPA tự lưu để đính vào các request sau.
  async login(payload: LoginPayload): Promise<AuthUser> {
    const { data } = await apiClient.post<LoginResult>("/auth/login", payload);
    tokenStorage.setSession(data.accessToken, data.refreshToken, data.user);
    return data.user;
  },

  // Xoá phiên phía client TRƯỚC khi gọi API: kể cả request lỗi (mất mạng,
  // token đã hết hạn) thì người dùng vẫn phải được đăng xuất. /auth/logout
  // không đòi Authorization nên gọi sau khi xoá token vẫn chạy đúng.
  async logout(): Promise<void> {
    const refreshToken = tokenStorage.getRefreshToken();
    tokenStorage.clear();
    if (!refreshToken) return;

    await apiClient.post("/auth/logout", { refreshToken }).catch(() => {});
  },
};
