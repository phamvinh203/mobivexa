import axios from "axios";

const FALLBACK = "Có lỗi xảy ra, vui lòng thử lại";

/** Backend trả lỗi dạng { message } — xem helpers/response.ts bên be_mobivexa. */
interface ApiErrorBody {
  message: string;
}

/**
 * Đổi lỗi bất kỳ thành câu hiển thị được cho người dùng.
 *
 * Không chỉ có lỗi HTTP: validate ảnh phía client ném Error thường, và message
 * của nó ("Chỉ chấp nhận ảnh JPEG...") mới là thứ người dùng cần đọc — nên
 * nhánh Error phải đứng trước fallback.
 */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? FALLBACK;
  }
  if (error instanceof Error && error.message) return error.message;
  return FALLBACK;
}
