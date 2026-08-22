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

  console.error('[Error]', err)
  sendError(res, 500, 'Lỗi server, vui lòng thử lại')
}
