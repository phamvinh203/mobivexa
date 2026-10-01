import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/token_manager'

// (Kiểu req.user khai báo global duy nhất tại auth.middleware.ts — không lặp lại ở đây.)

// Optional auth cho /api/chat: chatbot phải dùng được cho cả guest lẫn user đã
// đăng nhập. Có Bearer token hợp lệ → gắn req.user để mở tool tra đơn/coupon;
// thiếu token hoặc token hỏng/hết hạn → để guest và đi tiếp, KHÔNG BAO GIỜ trả
// 401 (khác authenticate — middleware này không chặn, chỉ nhận diện).
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(authHeader.slice(7))
    } catch {
      // Token không hợp lệ hoặc đã hết hạn → coi như guest, không chặn request
    }
  }

  next()
}
