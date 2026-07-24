import { Request, Response, NextFunction } from 'express'
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
export function verifySePaySecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.SEPAY_WEBHOOK_SECRET
  if (!secret || extractSecret(req) !== secret) {
    sendError(res, 401, 'Webhook secret không hợp lệ')
    return
  }
  next()
}
