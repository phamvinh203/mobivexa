import { Request, Response, NextFunction } from 'express'
import { MulterError } from 'multer'
import { AppError } from '../helpers/app_error'
import { sendError } from '../helpers/response'

// multer ném MulterError chứ không phải AppError khi chạm giới hạn. Không bắt riêng
// thì mọi lỗi vượt hạn mức đều rơi xuống nhánh 500 "Lỗi server", và người dùng không
// có manh mối nào về việc ảnh quá nặng hay mô tả quá dài.
const MULTER_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: 'Ảnh vượt quá dung lượng cho phép (tối đa 5MB)',
  LIMIT_FILE_COUNT: 'Vượt quá số lượng ảnh cho phép trong một lần tải lên',
  LIMIT_FIELD_VALUE: 'Nội dung quá lớn — hãy giảm bớt hoặc thu nhỏ ảnh chèn trong mô tả',
  LIMIT_UNEXPECTED_FILE: 'Trường tải ảnh không hợp lệ',
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`
  return `${Math.round(bytes / 1024)}KB`
}

// Error middleware toàn cục — nguồn duy nhất chuyển lỗi thành HTTP response
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    sendError(res, err.status, err.message)
    return
  }

  if (err instanceof MulterError) {
    sendError(res, 400, MULTER_MESSAGES[err.code] ?? 'Tải lên không hợp lệ')
    return
  }

  // express.json() ném lỗi thuần (không phải AppError/MulterError) khi body vượt giới
  // hạn cấu hình — nhánh này áp dụng CHUNG cho mọi route (2MB riêng cho /api/admin/blog,
  // E-blog-018; 100KB mặc định cho phần còn lại). RVW-010: message KHÔNG được ghi cứng
  // "2MB" vì route khác có hạn mức khác — dùng đúng `err.limit` (byte) mà body-parser
  // đính kèm để báo đúng giới hạn thật của chính request đó.
  if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.too.large') {
    const limit = (err as { limit?: unknown }).limit
    const limitText = typeof limit === 'number' ? ` (tối đa ${formatBytes(limit)})` : ''
    sendError(res, 413, `Nội dung gửi lên quá lớn${limitText}`)
    return
  }

  console.error('[Error]', err)
  sendError(res, 500, 'Lỗi server, vui lòng thử lại')
}
