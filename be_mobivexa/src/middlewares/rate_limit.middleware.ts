import rateLimit, { type Options } from 'express-rate-limit'

// Rate limit bị tắt trong test — nếu không các test chạy liên tiếp trên cùng
// process sẽ dùng chung counter và bắt đầu trả 429 giữa chừng.
const skipInTest = () => process.env.NODE_ENV === 'test'

function makeLimiter(limit: number, windowMs: number, message: string): Partial<Options> {
  return {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: skipInTest,
    message: { message },
  }
}

// Webhook là endpoint public — ai cũng POST được. SePay thực tế chỉ bắn vài
// request/phút, nên 120/phút vừa thoải mái cho retry vừa chặn được spam.
export const webhookLimiter = rateLimit(
  makeLimiter(120, 60_000, 'Quá nhiều request tới webhook')
)

// Sinh QR: mỗi user chỉ mở trang thanh toán vài lần — 30/phút là dư.
export const qrLimiter = rateLimit(
  makeLimiter(30, 60_000, 'Bạn thao tác quá nhanh, vui lòng thử lại sau')
)

// Sync gọi ra SePay UserAPI (2 req/s theo giới hạn của SePay) → siết chặt.
export const syncLimiter = rateLimit(
  makeLimiter(10, 60_000, 'Đồng bộ quá thường xuyên, vui lòng thử lại sau')
)
