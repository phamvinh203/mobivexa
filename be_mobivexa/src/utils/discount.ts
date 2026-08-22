import type { Prisma, CouponType } from '../generated/prisma/client'

// Tầng luật thuần của mã giảm giá — KHÔNG import prisma.
//
// Số học và thứ tự luật là phần dễ sai nhất của tính năng này, nên tách hẳn ra
// khỏi tầng truy vấn: test được bằng bảng input/output, không phải dựng mock DB.
//
// `import type` ở trên là ngoại lệ CÓ CHỦ Ý và là ngoại lệ duy nhất: nó bị xoá
// sạch lúc biên dịch nên file này vẫn không kéo theo runtime nào. Không được
// import chính `prisma`, cũng không được import coupon.service hay order.service
// — cả hai service đều import ngược lên đây, nên một import xuôi sẽ dựng lại
// đúng vòng lặp mà việc tách file này sinh ra để phá.

// ─── Chuẩn hoá mã ─────────────────────────────────────────────────────────────

// Chuẩn hoá cả lúc ghi lẫn lúc tra, nhờ vậy @unique trên `code` có tác dụng như
// so sánh không phân biệt hoa thường. Nằm ở tầng thuần để order.service dùng được
// mà không phải import ngược coupon.service.
export const normalizeCode = (raw: string) => raw.trim().toUpperCase()

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
  //
  // Làm tròn TRƯỚC rồi mới kẹp, và kẹp bằng Math.floor(subtotal) chứ không phải
  // subtotal thô: nếu kẹp trước rồi mới làm tròn thì chính bước làm tròn lại đẩy
  // discount vượt lên trên một subtotal lẻ — subtotal 300.000,6 cho ra discount
  // 300.001, total thành -0,4. Đây không phải giả định: salePrice là Decimal(12,2)
  // và validator chỉ chặn số âm chứ không ép số nguyên, nên subtotal lẻ vào được
  // tới đây. Math.floor giữ trần luôn là số nguyên <= subtotal, nên sau khi làm
  // tròn discount vẫn không thể vượt.
  return Math.min(Math.round(discount), Math.floor(subtotal))
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

// ─── Đổi bản ghi Prisma sang input thuần ──────────────────────────────────────

// Hai hàm này SỐNG CHUNG với computeDiscount/checkCouponUsable một cách cố ý.
//
// Trước đây chúng nằm trong coupon.service còn order.service tự chép lại một bản
// y hệt. Hai bản giống nhau từng byte nên không hỏng gì, nhưng đó đúng là thứ mà
// việc export resolveItems sinh ra để chặn: preview và đặt hàng phải tính RA CÙNG
// MỘT CON SỐ cho cùng một giỏ. Chép tay nửa còn lại của phép tính đó nghĩa là một
// lần sửa vào một bản là báo giá một đằng, thu tiền một nẻo — và không test nào
// bắt được, vì mỗi bên vẫn tự nhất quán với chính nó.
//
// Kiểu trả về khai báo tường minh để trình biên dịch giữ hai đầu khớp nhau: đổi
// DiscountRule hay CouponCheckInput mà quên đổi hàm đổi kiểu thì hỏng ngay ở đây,
// không phải lúc chạy.
export type CouponRow = {
  type: CouponType
  value: Prisma.Decimal
  maxDiscount: Prisma.Decimal | null
  isActive: boolean
  startsAt: Date
  endsAt: Date
  usageLimit: number | null
  usedCount: number
  minOrderValue: Prisma.Decimal
}

export const toRule = (c: CouponRow): DiscountRule => ({
  type:        c.type,
  value:       Number(c.value),
  maxDiscount: c.maxDiscount === null ? null : Number(c.maxDiscount),
})

export const toCheckInput = (c: CouponRow): CouponCheckInput => ({
  isActive:      c.isActive,
  startsAt:      c.startsAt,
  endsAt:        c.endsAt,
  usageLimit:    c.usageLimit,
  usedCount:     c.usedCount,
  minOrderValue: Number(c.minOrderValue),
})
