import {
  useCallback,
  useEffect,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearUserScopedQueries } from "../../../lib/queryClient";
import { tokenStorage } from "../../../lib/tokenManager";
import { accountApi } from "../../account/api/accountApi";
import { authApi } from "../api/authApi";
import { authKeys } from "../api/queryKeys";
import { AuthContext, type AuthContextValue } from "./authContext";
import type { AuthUser, LoginPayload, RegisterPayload } from "../types";

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const queryClient = useQueryClient();

  const { data: user = null, isPending } = useQuery({
    queryKey: authKeys.currentUser(),
    // Chưa có token thì khỏi gọi API — trả null luôn, tránh request chắc chắn 401.
    queryFn: (): Promise<AuthUser | null> =>
      tokenStorage.hasSession() ? accountApi.getMe() : Promise.resolve(null),
    // Dựng ngay từ cache localStorage để F5 không chớp màn hình trống...
    initialData: (): AuthUser | null | undefined =>
      tokenStorage.hasSession() ? (tokenStorage.getUser() ?? undefined) : null,
    // ...nhưng đánh dấu đã cũ để refetch nền ngay, phòng phiên đã bị thu hồi.
    initialDataUpdatedAt: 0,
  });

  // Một chỗ duy nhất ghi user xuống localStorage — nơi khác chỉ cần setQueryData.
  useEffect(() => {
    if (user) tokenStorage.setUser(user);
  }, [user]);

  // Phiên kết thúc vì bất kỳ lý do gì (đăng xuất, refresh token hỏng, đăng xuất
  // ở tab khác) đều đi qua đây — tokenStorage là nơi duy nhất phát tín hiệu.
  useEffect(
    () =>
      tokenStorage.onSessionEnd(() => {
        clearUserScopedQueries(queryClient);
        queryClient.setQueryData(authKeys.currentUser(), null);
      }),
    [queryClient],
  );

  const login = useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (loggedIn) => {
      queryClient.setQueryData(authKeys.currentUser(), loggedIn);
    },
  });

  // Đăng ký xong KHÔNG tự đăng nhập — backend register không trả token
  // (xem auth.controller.ts), người dùng phải login riêng.
  const register = useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
  });

  // authApi.logout gọi tokenStorage.clear() → onSessionEnd ở trên dọn cache.
  const logout = useCallback(() => authApi.logout(), []);

  const setUser = useCallback(
    (next: AuthUser): void => {
      queryClient.setQueryData(authKeys.currentUser(), next);
    },
    [queryClient],
  );

  const patchUser = useCallback(
    (patch: Partial<AuthUser>): void => {
      queryClient.setQueryData<AuthUser | null>(
        authKeys.currentUser(),
        (prev) => (prev ? { ...prev, ...patch } : prev),
      );
    },
    [queryClient],
  );

  // Memo hoá: mọi consumer của useAuth (và cả router context) render lại theo
  // object này, nên nó chỉ nên đổi khi trạng thái thật sự đổi.
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isRestoring: isPending,
      login,
      register,
      logout,
      setUser,
      patchUser,
    }),
    [user, isPending, login, register, logout, setUser, patchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
