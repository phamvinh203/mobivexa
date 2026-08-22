import { describe, it, expect } from 'vitest'
import { computeDiscount, checkCouponUsable } from '../utils/discount'

// ─── computeDiscount ──────────────────────────────────────────────────────────

describe('computeDiscount', () => {
  it('PERCENT - giảm theo tỉ lệ khi không có trần', () => {
    expect(computeDiscount({ type: 'PERCENT', value: 10, maxDiscount: null }, 1_000_000)).toBe(100_000)
  })

  it('PERCENT - bị kẹp lại khi chạm trần maxDiscount', () => {
    expect(computeDiscount({ type: 'PERCENT', value: 50, maxDiscount: 200_000 }, 1_000_000)).toBe(200_000)
  })

  it('PERCENT - chưa chạm trần thì giữ nguyên tỉ lệ', () => {
    expect(computeDiscount({ type: 'PERCENT', value: 10, maxDiscount: 500_000 }, 1_000_000)).toBe(100_000)
  })

  it('FIXED - giảm đúng số tiền', () => {
    expect(computeDiscount({ type: 'FIXED', value: 150_000, maxDiscount: null }, 1_000_000)).toBe(150_000)
  })

  // maxDiscount là trần của tỉ lệ phần trăm; với FIXED thì số tiền đã là trần của
  // chính nó nên trần phải bị bỏ qua. Không có test này thì xoá điều kiện
  // `rule.type === 'PERCENT' &&` trong cài đặt sẽ âm thầm cắt mất tiền giảm.
  it('FIXED - bỏ qua maxDiscount', () => {
    expect(computeDiscount({ type: 'FIXED', value: 150_000, maxDiscount: 50_000 }, 1_000_000)).toBe(150_000)
  })

  // Chốt chặn total âm: total = subtotal + shippingFee - discount
  it('FIXED - không bao giờ giảm quá subtotal', () => {
    expect(computeDiscount({ type: 'FIXED', value: 500_000, maxDiscount: null }, 300_000)).toBe(300_000)
  })

  // salePrice là Decimal(12,2) nên subtotal lẻ vào được tới đây. Nếu kẹp ở subtotal
  // trước rồi mới làm tròn thì ra 300.001 > subtotal, total âm.
  it('FIXED - subtotal lẻ vẫn không bị giảm quá', () => {
    expect(computeDiscount({ type: 'FIXED', value: 500_000, maxDiscount: null }, 300_000.6)).toBe(300_000)
  })

  it('làm tròn về đồng', () => {
    // 333.333 * 10% = 33.333,3 -> 33.333
    expect(computeDiscount({ type: 'PERCENT', value: 10, maxDiscount: null }, 333_333)).toBe(33_333)
  })

  // Mốc .5 là chỗ duy nhất phân biệt được làm tròn với cắt cụt: 33.333,3 thì
  // round/floor/trunc đều ra 33.333, nên chỉ test đó thôi là đổi sang floor vẫn xanh.
  it('làm tròn nửa lên chứ không cắt cụt', () => {
    // 333.335 * 10% = 33.333,5 -> 33.334 (floor/trunc sẽ ra 33.333)
    expect(computeDiscount({ type: 'PERCENT', value: 10, maxDiscount: null }, 333_335)).toBe(33_334)
  })

  it('subtotal 0 thì giảm 0', () => {
    expect(computeDiscount({ type: 'PERCENT', value: 10, maxDiscount: null }, 0)).toBe(0)
  })
})

// ─── checkCouponUsable ────────────────────────────────────────────────────────

const NOW = new Date('2026-08-22T10:00:00.000Z')

const VALID = {
  isActive:      true,
  startsAt:      new Date('2026-08-01T00:00:00.000Z'),
  endsAt:        new Date('2026-09-01T00:00:00.000Z'),
  usageLimit:    100,
  usedCount:     10,
  minOrderValue: 500_000,
}

describe('checkCouponUsable', () => {
  it('hợp lệ khi thoả mọi điều kiện', () => {
    expect(checkCouponUsable(VALID, false, 1_000_000, NOW)).toEqual({ ok: true })
  })

  it('mã không tồn tại', () => {
    expect(checkCouponUsable(null, false, 1_000_000, NOW)).toEqual({
      ok: false,
      reason: 'Mã giảm giá không tồn tại',
    })
  })

  it('mã đã tắt', () => {
    expect(checkCouponUsable({ ...VALID, isActive: false }, false, 1_000_000, NOW)).toEqual({
      ok: false,
      reason: 'Mã giảm giá đã ngừng áp dụng',
    })
  })

  it('chưa tới thời gian áp dụng', () => {
    const coupon = { ...VALID, startsAt: new Date('2026-09-01T00:00:00.000Z') }
    expect(checkCouponUsable(coupon, false, 1_000_000, NOW)).toEqual({
      ok: false,
      reason: 'Mã giảm giá chưa đến thời gian áp dụng',
    })
  })

  it('đã hết hạn', () => {
    const coupon = { ...VALID, endsAt: new Date('2026-08-01T00:00:00.000Z') }
    expect(checkCouponUsable(coupon, false, 1_000_000, NOW)).toEqual({
      ok: false,
      reason: 'Mã giảm giá đã hết hạn',
    })
  })

  it('hết lượt toàn hệ thống', () => {
    const coupon = { ...VALID, usageLimit: 10, usedCount: 10 }
    expect(checkCouponUsable(coupon, false, 1_000_000, NOW)).toEqual({
      ok: false,
      reason: 'Mã giảm giá đã hết lượt sử dụng',
    })
  })

  it('usageLimit null nghĩa là không giới hạn tổng lượt', () => {
    const coupon = { ...VALID, usageLimit: null, usedCount: 999_999 }
    expect(checkCouponUsable(coupon, false, 1_000_000, NOW)).toEqual({ ok: true })
  })

  it('khách đã dùng mã này rồi', () => {
    expect(checkCouponUsable(VALID, true, 1_000_000, NOW)).toEqual({
      ok: false,
      reason: 'Bạn đã sử dụng mã này rồi',
    })
  })

  it('đơn chưa đạt giá trị tối thiểu, số tiền có dấu phân cách', () => {
    expect(checkCouponUsable(VALID, false, 100_000, NOW)).toEqual({
      ok: false,
      reason: 'Đơn hàng tối thiểu 500.000đ mới áp dụng được mã này',
    })
  })

  // Thứ tự quan trọng: điều kiện chung (mã hỏng) phải báo trước điều kiện riêng
  // của khách, nếu không khách sẽ tưởng lỗi do mình trong khi mã đã hết hạn.
  it('mã hết hạn được báo trước lỗi riêng của khách', () => {
    const coupon = { ...VALID, endsAt: new Date('2026-08-01T00:00:00.000Z') }
    expect(checkCouponUsable(coupon, true, 1_000, NOW)).toEqual({
      ok: false,
      reason: 'Mã giảm giá đã hết hạn',
    })
  })
})
