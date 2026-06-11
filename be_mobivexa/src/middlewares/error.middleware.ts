import { Request, Response, NextFunction } from 'express'
import { AppError } from '../helpers/app_error'
import { sendError } from '../helpers/response'

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

  console.error('[Error]', err)
  sendError(res, 500, 'Lỗi server, vui lòng thử lại')
}
