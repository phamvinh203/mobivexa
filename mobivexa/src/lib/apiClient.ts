import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env } from "./env";
import { tokenStorage } from "./tokenManager";
import type { TokenPair } from "../features/auth/types";

// Chỉ dùng trong file này — apiClient đã gắn sẵn baseURL cho mọi nơi khác.
const API_URL = env.API_URL;

export const apiClient = axios.create({ baseURL: API_URL });

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

// ─────────────────────────────────────────────────────────────────────────────
// Refresh token khi accessToken hết hạn (401). Nhiều request 401 cùng lúc chỉ
// gọi /auth/refresh MỘT lần — các request còn lại chờ rồi retry với token mới.
// Gọi bằng axios "trần" (không qua apiClient) để tránh đệ quy vào interceptor.
// ─────────────────────────────────────────────────────────────────────────────
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new Error("Không có refresh token");

  const { data } = await axios.post<TokenPair>(`${API_URL}/auth/refresh`, {
    refreshToken,
  });
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const isRefreshCall = config?.url?.includes("/auth/refresh");

    if (
      error.response?.status !== 401 ||
      !config ||
      config._retried ||
      isRefreshCall
    ) {
      return Promise.reject(error);
    }

    config._retried = true;

    // Tab khác có thể vừa refresh xong và ghi token mới vào localStorage. Nếu
    // token hiện tại đã khác token gửi kèm request hỏng thì chỉ cần thử lại —
    // refresh nữa sẽ dùng refresh token đã bị backend thu hồi (nó xoay vòng ở
    // mỗi lần refresh) và làm đăng xuất cả hai tab.
    const currentToken = tokenStorage.getAccessToken();
    if (
      currentToken &&
      config.headers.get("Authorization") !== `Bearer ${currentToken}`
    ) {
      config.headers.set("Authorization", `Bearer ${currentToken}`);
      return apiClient(config);
    }

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newAccessToken = await refreshPromise;

      config.headers.set("Authorization", `Bearer ${newAccessToken}`);
      return apiClient(config);
    } catch {
      // clear() tự báo cho những nơi đang lắng nghe phiên kết thúc.
      tokenStorage.clear();
      // Trả về lỗi 401 GỐC, không phải lỗi của /auth/refresh: giữ đúng status
      // để queryClient không retry, và không rò message nội bộ của endpoint
      // refresh ra giao diện.
      return Promise.reject(error);
    }
  },
);
