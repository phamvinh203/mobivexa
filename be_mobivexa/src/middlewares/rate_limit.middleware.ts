import type { Request } from 'express'
import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit'

// Rate limit bị tắt trong test — nếu không các test chạy liên tiếp trên cùng
// process sẽ dùng chung counter và bắt đầu trả 429 giữa chừng.
const skipInTest = () => process.env.NODE_ENV === 'test'

function makeLimiter(
  limit: number,
  windowMs: number,
  message: string,
  keyGenerator?: (req: Request) => string,
): Partial<Options> {
  return {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: skipInTest,
    message: { message },
    ...(keyGenerator && { keyGenerator }),
  }
}

// Auth là bề mặt bị dò mật khẩu nhiều nhất. Cửa sổ 15 phút thay vì 1 phút như
// các limiter dưới: brute-force bị chặn phải chờ lâu hơn hẳn, còn người dùng gõ
// nhầm mật khẩu vài lần vẫn nằm trong 10 lượt.
export const authLimiter = rateLimit(
  makeLimiter(10, 15 * 60_000, 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút')
)

// Upload avatar tốn băng thông và quota Cloudinary — một người đổi ảnh đại diện
// quá 10 lần/giờ là bất thường.
export const avatarLimiter = rateLimit(
  makeLimiter(10, 60 * 60_000, 'Quá nhiều lần upload ảnh, vui lòng thử lại sau 1 giờ')
)

// Webhook là endpoint public — ai cũng POST được. SePay thực tế chỉ bắn vài
// request/phút, nên 120/phút vừa thoải mái cho retry vừa chặn được spam.
export const webhookLimiter = rateLimit(
  makeLimiter(120, 60_000, 'Quá nhiều request tới webhook')
)

// Sinh QR: mỗi user chỉ mở trang thanh toán vài lần — 30/phút là dư.
export const qrLimiter = rateLimit(
  makeLimiter(30, 60_000, 'Bạn thao tác quá nhanh, vui lòng thử lại sau')
)

// Preview mã là một cỗ máy DÒ MÃ: gõ đại một code là biết ngay mã đó có thật hay
// không, mà mỗi lượt tốn ba lượt truy vấn DB. Không chặn thì một script quét từ
// điển vừa moi được trọn bộ mã đang chạy vừa kéo DB xuống. 20/phút thoải mái cho
// người thật thử vài mã trong giỏ.
export const couponPreviewLimiter = rateLimit(
  makeLimiter(20, 60_000, 'Bạn thử mã giảm giá quá nhanh, vui lòng chờ một lát')
)

// Sync gọi ra SePay UserAPI (2 req/s theo giới hạn của SePay) → siết chặt.
export const syncLimiter = rateLimit(
  makeLimiter(10, 60_000, 'Đồng bộ quá thường xuyên, vui lòng thử lại sau')
)

// Mỗi tin nhắn tốn quota Gemini chứ không chỉ tốn CPU, nên siết chặt hơn các
// limiter khác. 15 tin/phút vẫn thoải mái cho người gõ thật — nhanh hơn thế là
// script. Key theo userId khi đã đăng nhập (optionalAuthenticate chạy trước
// chatLimiter): người dùng sau NAT công ty không phải chung bucket với người lạ.
// Khách vãng lai key theo IP qua ipKeyGenerator: IPv6 gom theo dải /56 — dùng
// req.ip trần thì mỗi địa chỉ trong dải ISP cấp là một bucket riêng, đổi địa chỉ
// là lách được giới hạn.
export const chatLimiter = rateLimit(
  makeLimiter(15, 60_000, 'Bạn nhắn quá nhanh, vui lòng chờ một lát', (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? ''))
)

// Danh mục sản phẩm/category/brand/banner/tag: đọc công khai, không tốn gì đặc
// biệt (không gọi API ngoài, không ghi DB), nên chỉ cần chặn scraping/DoS thô —
// 120/phút vẫn thoải mái cho một trang duyệt web bấm liên tục.
export const catalogLimiter = rateLimit(
  makeLimiter(120, 60_000, 'Bạn thao tác quá nhanh, vui lòng thử lại sau')
)
