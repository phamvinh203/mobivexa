import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit'
import type { RequestHandler } from 'express'

// Rate limit bị tắt trong test — nếu không các test chạy liên tiếp trên cùng
// process sẽ dùng chung counter và bắt đầu trả 429 giữa chừng.
const skipInTest = () => process.env.NODE_ENV === 'test'

// keyGenerator bỏ trống → express-rate-limit tự key theo IP đã chuẩn hoá.
function makeLimiter(
  limit: Options['limit'],
  windowMs: number,
  message: string,
  keyGenerator?: Options['keyGenerator'],
): Partial<Options> {
  return {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: skipInTest,
    message: { message },
    keyGenerator,
  }
}

// Auth là bề mặt bị dò mật khẩu nhiều nhất. Cửa sổ 15 phút thay vì 1 phút như
// các limiter dưới: brute-force bị chặn phải chờ lâu hơn hẳn, còn người dùng gõ
// nhầm mật khẩu vài lần vẫn nằm trong 10 lượt.
export const authLimiter = rateLimit(makeLimiter(10, 15 * 60_000, 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút'))

// Upload avatar tốn băng thông và quota Cloudinary — một người đổi ảnh đại diện
// quá 10 lần/giờ là bất thường.
export const avatarLimiter = rateLimit(
  makeLimiter(10, 60 * 60_000, 'Quá nhiều lần upload ảnh, vui lòng thử lại sau 1 giờ'),
)

// Webhook là endpoint public — ai cũng POST được. SePay thực tế chỉ bắn vài
// request/phút, nên 120/phút vừa thoải mái cho retry vừa chặn được spam.
export const webhookLimiter = rateLimit(makeLimiter(120, 60_000, 'Quá nhiều request tới webhook'))

// Sinh QR: mỗi user chỉ mở trang thanh toán vài lần — 30/phút là dư.
export const qrLimiter = rateLimit(makeLimiter(30, 60_000, 'Bạn thao tác quá nhanh, vui lòng thử lại sau'))

// Preview mã là một cỗ máy DÒ MÃ: gõ đại một code là biết ngay mã đó có thật hay
// không, mà mỗi lượt tốn ba lượt truy vấn DB. Không chặn thì một script quét từ
// điển vừa moi được trọn bộ mã đang chạy vừa kéo DB xuống. 20/phút thoải mái cho
// người thật thử vài mã trong giỏ.
export const couponPreviewLimiter = rateLimit(
  makeLimiter(20, 60_000, 'Bạn thử mã giảm giá quá nhanh, vui lòng chờ một lát'),
)

// Sync gọi ra SePay UserAPI (2 req/s theo giới hạn của SePay) → siết chặt.
export const syncLimiter = rateLimit(makeLimiter(10, 60_000, 'Đồng bộ quá thường xuyên, vui lòng thử lại sau'))

// Tìm kiếm bài viết blog là endpoint public không cần đăng nhập — không chặn thì
// một script quét từ điển vừa dò được từ khoá vừa kéo DB xuống (NFR-blog-007,
// E-blog-014). Ngưỡng tham khảo couponPreviewLimiter — cùng lớp "tra cứu công khai".
export const blogSearchLimiter = rateLimit(
  makeLimiter(20, 60_000, 'Bạn tìm kiếm quá nhanh, vui lòng thử lại sau ít phút'),
)

// Đếm view bài viết là endpoint public và mỗi lượt là 1 UPDATE DB — không chặn thì
// một script loop POST là đẩy viewCount lên tùy ý, sai luôn số liệu đọc của admin
// (NFR-blog-007). 30/phút dư cho người thật mở vài bài, đủ chặn spam lặp.
export const viewLimiter = rateLimit(
  makeLimiter(30, 60_000, 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút'),
)

// ─── Chatbot (NFR-chat-001) ───────────────────────────────────────────────────
//
// Mỗi tin nhắn chat tốn MỘT lượt gọi LLM trả phí theo token — guest spam được
// vì không cần đăng nhập, nên hạn mức tách theo vai: user (đã xác thực, key theo
// userId) và guest (key theo IP). Mỗi vai có sàn phút (chống spam liên tiếp) VÀ
// sàn ngày (chống cháy quota buổi đêm — security-officer yêu cầu).
// Số liệu theo plan chatbot v1.0 mục 2.5.
export const CHAT_LIMITS = {
  userPerMinute: 10,
  guestPerMinute: 5,
  userPerDay: 50,
  guestPerDay: 20,
} as const

// Key = userId nếu đã đăng nhập, không thì IP chuẩn hoá bằng ipKeyGenerator của
// express-rate-limit (IPv4-mapped/IPv6 về cùng một key) thay vì req.ip thô. UUID và
// IP không bao giờ trùng nhau nên user với guest không chung counter dù chung store.
const keyByUserOrIp: NonNullable<Options['keyGenerator']> = (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? '')

// `limit` nhận hàm: một limiter phục vụ cả hai vai, số lượt chọn theo req.user
// (do optionalAuthenticate gắn trước đó).
const byRole = (user: number, guest: number): Options['limit'] => (req) => (req.user ? user : guest)

// Mảng middleware: Express tự flatten khi gắn vào route. Sàn phút đứng trước — request
// bị chặn ở đó thì không tính vào sàn ngày. Sàn ngày là cửa sổ trôi 24h tính từ lượt
// đầu (không reset lúc nửa đêm) nên message nói "thử lại sau 24 giờ" cho khớp hành vi thật.
export const chatLimiter: RequestHandler[] = [
  rateLimit(
    makeLimiter(
      byRole(CHAT_LIMITS.userPerMinute, CHAT_LIMITS.guestPerMinute),
      60_000,
      'Bạn nhắn tin quá nhanh, vui lòng chờ một lát',
      keyByUserOrIp,
    ),
  ),
  rateLimit(
    makeLimiter(
      byRole(CHAT_LIMITS.userPerDay, CHAT_LIMITS.guestPerDay),
      24 * 60 * 60_000,
      'Bạn đã dùng hết hạn mức chat, vui lòng thử lại sau 24 giờ',
      keyByUserOrIp,
    ),
  ),
]
