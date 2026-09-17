import { Request, Response, NextFunction } from 'express'
import crypto from 'node:crypto'
import { sendError } from '../helpers/response'

// SePay gửi secret theo cấu hình trong dashboard (Webhooks → Kiểu xác thực).
// Chọn "API Key" thì header là `Authorization: Apikey <key>`.
// Vẫn chấp nhận `x-sepay-secret` để không phá cấu hình cũ đang chạy.
function extractSecret(req: Request): string | undefined {
  const auth = req.headers.authorization
  // 'Apikey ' và 'Bearer ' đều dài 7 ký tự
  if (auth?.startsWith('Apikey ') || auth?.startsWith('Bearer ')) return auth.slice(7).trim()

  const custom = req.headers['x-sepay-secret']
  return typeof custom === 'string' ? custom : undefined
}

// Xác thực webhook SePay — dùng làm middleware trên route /webhooks/sepay.
//
// So sánh constant-time bằng crypto.timingSafeEqual: chuỗi !== chuỗi có thể
// rò rỉ qua thời gian phản hồi vị trí ký tự khác biệt đầu tiên (timing attack).
// Secret dài 32+ ký tự ngẫu nhiên nên leak window rất nhỏ, nhưng vẫn fix cho
// đúng chuẩn — đặc biệt khi secret dev có thể yếu hơn production.
export function verifySePaySecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.SEPAY_WEBHOOK_SECRET
  const provided = extractSecret(req)
  if (!secret || !provided) {
    sendError(res, 401, 'Webhook secret không hợp lệ')
    return
  }
  // timingSafeEqual yêu cầu 2 buffer cùng length — check trước để tránh throw
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    sendError(res, 401, 'Webhook secret không hợp lệ')
    return
  }
  next()
}
