import type { CouponType } from '../generated/prisma/client'

// Tầng luật thuần của mã giảm giá — KHÔNG import prisma.
//
// Số học và thứ tự luật là phần dễ sai nhất của tính năng này, nên tách hẳn ra
// khỏi tầng truy vấn: test được bằng bảng input/output, không phải dựng mock DB.
// Caller có nhiệm vụ đổi Decimal của Prisma thành number trước khi gọi.

// ─── Tính tiền giảm ───────────────────────────────────────────────────────────

export type DiscountRule = {
  type: CouponType
  value: number
  maxDiscount: number | null
}

export function computeDiscount(rule: DiscountRule, subtotal: number): number {
  let discount =
    rule.type === 'PERCENT'
      ? (subtotal * rule.value) / 100
      : rule.value

  if (rule.type === 'PERCENT' && rule.maxDiscount !== null) {
    discount = Math.min(discount, rule.maxDiscount)
  }

  // Kẹp ở subtotal là chốt chặn total âm: total = subtotal + shippingFee - discount,
  // nên discount <= subtotal đảm bảo total >= shippingFee >= 0, đúng cả khi sau này
  // shippingFee khác 0.
  return Math.round(Math.min(discount, subtotal))
}

// ─── Kiểm tra điều kiện áp mã ─────────────────────────────────────────────────

export type CouponCheckInput = {
  isActive: boolean
  startsAt: Date
  endsAt: Date
  usageLimit: number | null
  usedCount: number
  minOrderValue: number
}

export type CouponCheck = { ok: true } | { ok: false; reason: string }

// Tự định dạng thay vì toLocaleString: kết quả không phụ thuộc ICU của môi trường,
// nên test cho ra cùng chuỗi ở mọi máy.
function formatVnd(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Trả KẾT QUẢ chứ không ném lỗi, vì hai nơi gọi cần hai hành vi khác nhau:
// preview luôn trả 200 kèm lý do, còn createOrder ném AppError(400). Nếu hàm này
// ném lỗi thì preview phải bắt rồi dịch ngược — hoặc tệ hơn là hai nơi tự kiểm
// tra riêng, dẫn tới ngày preview báo "giảm 100k" mà đặt hàng lại ăn 400.
//
// `alreadyUsed` do caller tra và truyền vào, hàm không tự truy vấn — đó là thứ
// giữ cho nó thuần.
export function checkCouponUsable(
  coupon: CouponCheckInput | null,
  alreadyUsed: boolean,
  subtotal: number,
  now: Date = new Date(),
): CouponCheck {
  if (!coupon)          return { ok: false, reason: 'Mã giảm giá không tồn tại' }
  if (!coupon.isActive) return { ok: false, reason: 'Mã giảm giá đã ngừng áp dụng' }

  if (now < coupon.startsAt) return { ok: false, reason: 'Mã giảm giá chưa đến thời gian áp dụng' }
  if (now > coupon.endsAt)   return { ok: false, reason: 'Mã giảm giá đã hết hạn' }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: 'Mã giảm giá đã hết lượt sử dụng' }
  }

  // Điều kiện chung xét trước điều kiện riêng: mã đã hỏng thì báo mã hỏng, đừng
  // để khách tưởng lỗi do mình.
  if (alreadyUsed) return { ok: false, reason: 'Bạn đã sử dụng mã này rồi' }

  if (subtotal < coupon.minOrderValue) {
    return { ok: false, reason: `Đơn hàng tối thiểu ${formatVnd(coupon.minOrderValue)}đ mới áp dụng được mã này` }
  }

  return { ok: true }
}
