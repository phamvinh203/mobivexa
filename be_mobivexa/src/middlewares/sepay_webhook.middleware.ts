import crypto from 'crypto'
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
  const provided = extractSecret(req)

  if (!secret || !provided) {
    sendError(res, 401, 'Webhook secret không hợp lệ')
    return
  }

  // So timing-safe: hash SHA-256 hai bên để cố định độ dài (tránh lệch độ dài
  // làm timingSafeEqual ném lỗi) rồi so bằng nhau từng byte, không lộ thông tin
  // qua thời gian so sánh như phép `===` thường.
  const expected = crypto.createHash('sha256').update(secret).digest()
  const actual = crypto.createHash('sha256').update(provided).digest()
  if (!crypto.timingSafeEqual(expected, actual)) {
    sendError(res, 401, 'Webhook secret không hợp lệ')
    return
  }
  next()
}
