import { Prisma } from '../generated/prisma/client'

// Nhận diện lỗi Prisma theo mã.
//
// Chỉ làm việc NHẬN DIỆN, cố tình không dịch sang HTTP status: cùng một mã mang
// nghĩa khác nhau tuỳ chỗ gọi. P2025 là 409 khi WHERE có kèm guard trạng thái
// (đơn vừa bị đổi ở nơi khác), nhưng là 404 khi WHERE chỉ có khoá chính (bản ghi
// không tồn tại). Thông tin phân biệt hai ca đó nằm ở câu query, không nằm trong
// error object — nên phải để nơi gọi tự quyết định phản ứng.
export function isPrismaError(err: unknown, code: string): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code
}
