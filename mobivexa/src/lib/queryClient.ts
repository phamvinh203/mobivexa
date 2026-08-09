import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

/** Lỗi 4xx là do dữ liệu/quyền, retry lại cũng vô ích — chỉ retry lỗi mạng/5xx. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status !== undefined && status >= 400 && status < 500) return false;
  }
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Đánh dấu query chứa dữ liệu riêng của người đang đăng nhập. Gắn cờ này thì
 * đăng xuất sẽ tự dọn — feature mới không phải sửa gì bên auth.
 */
export const USER_SCOPED = { userScoped: true } as const;

/**
 * Xoá mọi dữ liệu thuộc về người vừa đăng xuất.
 *
 * Cố ý KHÔNG dùng queryClient.clear(): clear() gỡ luôn query đang được mount,
 * khiến chúng refetch khi đã không còn token rồi ném lỗi trước lúc guard kịp
 * chuyển trang.
 */
export function clearUserScopedQueries(client: QueryClient): void {
  client.removeQueries({
    predicate: (query) => query.meta?.userScoped === true,
  });
}
