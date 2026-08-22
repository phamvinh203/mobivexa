import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  coupon: {
    findMany:   vi.fn(),
    findUnique: vi.fn(),
    count:      vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
  },
  couponUsage: {
    findUnique: vi.fn(),
    findFirst:  vi.fn(),
    findMany:   vi.fn(),
    count:      vi.fn(),
  },
  cart:           { findUnique: vi.fn() },
  productVariant: { findMany: vi.fn() },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { Prisma } from '../generated/prisma/client'
import { signAccessToken } from '../utils/token_manager'

const app         = createApp()
const ADMIN_TOKEN = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`

const BASE_COUPON = {
  id:            'coupon-1',
  code:          'SALE10',
  description:   'Giảm 10%',
  type:          'PERCENT',
  value:         10,
  maxDiscount:   200_000,
  minOrderValue: 500_000,
  usageLimit:    100,
  usedCount:     0,
  startsAt:      new Date('2026-08-01T00:00:00.000Z'),
  endsAt:        new Date('2026-09-01T00:00:00.000Z'),
  isActive:      true,
  createdAt:     new Date(),
  updatedAt:     new Date(),
}

const VALID_BODY = {
  code:          'sale10',
  type:          'PERCENT',
  value:         10,
  maxDiscount:   200_000,
  minOrderValue: 500_000,
  usageLimit:    100,
  startsAt:      '2026-08-01T00:00:00.000Z',
  endsAt:        '2026-09-01T00:00:00.000Z',
}

const duplicateKeyError = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })

// ─── POST /api/admin/coupons ──────────────────────────────────────────────────

describe('POST /api/admin/coupons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - tạo mã, code được chuẩn hoá UPPERCASE', async () => {
    mockPrisma.coupon.create.mockResolvedValue(BASE_COUPON)

    const res = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', ADMIN_TOKEN)
      .send(VALID_BODY)

    expect(res.status).toBe(201)
    expect(mockPrisma.coupon.create.mock.calls[0][0].data.code).toBe('SALE10')
  })

  it('409 - code đã tồn tại', async () => {
    mockPrisma.coupon.create.mockRejectedValue(duplicateKeyError())

    const res = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', ADMIN_TOKEN)
      .send(VALID_BODY)

    expect(res.status).toBe(409)
  })

  it('400 - maxDiscount đi với FIXED là hiểu nhầm, phải báo', async () => {
    const res = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', ADMIN_TOKEN)
      .send({ ...VALID_BODY, type: 'FIXED', value: 100_000, maxDiscount: 50_000 })

    expect(res.status).toBe(400)
    expect(mockPrisma.coupon.create).not.toHaveBeenCalled()
  })

  it('400 - PERCENT value vượt 100', async () => {
    const res = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', ADMIN_TOKEN)
      .send({ ...VALID_BODY, value: 150 })

    expect(res.status).toBe(400)
  })

  // value âm cho ra discount âm, mà total = subtotal + shippingFee - discount nên
  // discount âm LÀM TĂNG tiền phải trả. Tầng thuần (utils/discount.ts) cố ý không
  // tự vệ, nên chốt chặn nằm hết ở đây.
  it('400 - value âm', async () => {
    const res = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', ADMIN_TOKEN)
      .send({ ...VALID_BODY, value: -10 })

    expect(res.status).toBe(400)
    expect(mockPrisma.coupon.create).not.toHaveBeenCalled()
  })

  // Validator kiểm Number(b.value) nhưng tầng dưới từng ghi b.value thô — hai giá
  // trị khác nhau. Ghi ngược giá trị đã ép kiểu (lối của parseIntField) để cái được
  // kiểm chính là cái được ghi, nếu không thì Number(true) = 1 lọt qua mọi vòng
  // kiểm rồi boolean rơi thẳng vào cột Decimal.
  it('201 - value dạng chuỗi số được ép về number trước khi ghi', async () => {
    mockPrisma.coupon.create.mockResolvedValue(BASE_COUPON)

    const res = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', ADMIN_TOKEN)
      .send({ ...VALID_BODY, value: '15' })

    expect(res.status).toBe(201)
    expect(mockPrisma.coupon.create.mock.calls[0][0].data.value).toBe(15)
  })

  it('400 - endsAt không sau startsAt', async () => {
    const res = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', ADMIN_TOKEN)
      .send({ ...VALID_BODY, endsAt: '2026-08-01T00:00:00.000Z' })

    expect(res.status).toBe(400)
  })

  it('400 - code sai định dạng', async () => {
    const res = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', ADMIN_TOKEN)
      .send({ ...VALID_BODY, code: 'a b' })

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/admin/coupons').send(VALID_BODY)
    expect(res.status).toBe(401)
  })

  it('403 - khách thường không được tạo mã', async () => {
    const userToken = `Bearer ${signAccessToken({ userId: 'u-1', email: 'u@test.com', role: 'CUSTOMER' })}`

    const res = await request(app)
      .post('/api/admin/coupons')
      .set('Authorization', userToken)
      .send(VALID_BODY)

    expect(res.status).toBe(403)
  })
})

// ─── GET /api/admin/coupons ───────────────────────────────────────────────────

describe('GET /api/admin/coupons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - danh sách kèm phân trang', async () => {
    mockPrisma.coupon.findMany.mockResolvedValue([BASE_COUPON])
    mockPrisma.coupon.count.mockResolvedValue(1)

    const res = await request(app).get('/api/admin/coupons').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.coupons).toHaveLength(1)
    expect(res.body.pagination.total).toBe(1)
  })

  it('200 - lọc status=expired dịch thành endsAt < now', async () => {
    mockPrisma.coupon.findMany.mockResolvedValue([])
    mockPrisma.coupon.count.mockResolvedValue(0)

    await request(app).get('/api/admin/coupons?status=expired').set('Authorization', ADMIN_TOKEN)

    const where = mockPrisma.coupon.findMany.mock.calls[0][0].where
    expect(where.endsAt).toHaveProperty('lt')
  })

  it('200 - search theo code, chuẩn hoá UPPERCASE', async () => {
    mockPrisma.coupon.findMany.mockResolvedValue([])
    mockPrisma.coupon.count.mockResolvedValue(0)

    await request(app).get('/api/admin/coupons?search=sale').set('Authorization', ADMIN_TOKEN)

    const where = mockPrisma.coupon.findMany.mock.calls[0][0].where
    expect(where.code).toEqual({ contains: 'SALE' })
  })
})

// ─── PUT /api/admin/coupons/:id ───────────────────────────────────────────────

// Update bỏ trống `type` thì validator không có gì để so — nó là middleware, không
// đọc được DB. Hai ca dưới đây đều lọt qua validator và phải bị service chặn lại
// bằng type ĐANG LƯU.
describe('PUT /api/admin/coupons/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('400 - value vượt 100 trên mã PERCENT đang lưu, dù body không gửi type', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(BASE_COUPON)

    const res = await request(app)
      .put('/api/admin/coupons/coupon-1')
      .set('Authorization', ADMIN_TOKEN)
      .send({ value: 150 })

    expect(res.status).toBe(400)
    expect(mockPrisma.coupon.update).not.toHaveBeenCalled()
  })

  it('400 - đặt trần giảm cho mã FIXED đang lưu, dù body không gửi type', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      ...BASE_COUPON,
      type:        'FIXED',
      value:       100_000,
      maxDiscount: null,
    })

    const res = await request(app)
      .put('/api/admin/coupons/coupon-1')
      .set('Authorization', ADMIN_TOKEN)
      .send({ maxDiscount: 50_000 })

    expect(res.status).toBe(400)
    expect(mockPrisma.coupon.update).not.toHaveBeenCalled()
  })

  // null trên cột NOT NULL từng là điểm mù: validator coi null như "không gửi" nên
  // bỏ qua hết, còn couponData lại coi là "có gửi" nên vẫn ghi. new Date(null) ra
  // 1970-01-01 — Date HỢP LỆ, không phải NaN — nên Prisma nhận, và mã hẹn lịch cho
  // đợt khuyến mãi tháng sau thành dùng được ngay lập tức.
  it('400 - startsAt = null không được coi là bỏ trống field', async () => {
    const res = await request(app)
      .put('/api/admin/coupons/coupon-1')
      .set('Authorization', ADMIN_TOKEN)
      .send({ startsAt: null })

    expect(res.status).toBe(400)
    expect(mockPrisma.coupon.update).not.toHaveBeenCalled()
  })

  // Cùng lỗ hổng, nhánh khác: normalizeCode(null) ném TypeError thành 500 "Lỗi
  // server" — lỗi của client mà báo như lỗi hệ thống.
  it('400 - code = null trả lỗi client chứ không phải 500', async () => {
    const res = await request(app)
      .put('/api/admin/coupons/coupon-1')
      .set('Authorization', ADMIN_TOKEN)
      .send({ code: null })

    expect(res.status).toBe(400)
    expect(mockPrisma.coupon.update).not.toHaveBeenCalled()
  })

  // Mặt còn lại của cùng một luật: cột NULLABLE thì null là thao tác xoá hợp lệ,
  // và là cách duy nhất admin gỡ trần giảm. Chặn nhầm ở đây là khoá luôn tính năng.
  it('200 - maxDiscount = null gỡ trần giảm của mã PERCENT', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(BASE_COUPON)
    mockPrisma.coupon.update.mockResolvedValue({ ...BASE_COUPON, maxDiscount: null })

    const res = await request(app)
      .put('/api/admin/coupons/coupon-1')
      .set('Authorization', ADMIN_TOKEN)
      .send({ maxDiscount: null })

    expect(res.status).toBe(200)
    expect(mockPrisma.coupon.update.mock.calls[0][0].data.maxDiscount).toBe(null)
  })
})

// ─── PATCH /api/admin/coupons/:id/status ──────────────────────────────────────

describe('PATCH /api/admin/coupons/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - đảo trạng thái mã đang bật thành tắt', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(BASE_COUPON)
    mockPrisma.coupon.update.mockResolvedValue({ ...BASE_COUPON, isActive: false })

    const res = await request(app)
      .patch('/api/admin/coupons/coupon-1/status')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(mockPrisma.coupon.update.mock.calls[0][0].data.isActive).toBe(false)
  })

  it('404 - đảo trạng thái mã không tồn tại', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/admin/coupons/khong-co/status')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(404)
    expect(mockPrisma.coupon.update).not.toHaveBeenCalled()
  })
})

// ─── DELETE /api/admin/coupons/:id ────────────────────────────────────────────

describe('DELETE /api/admin/coupons/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - xoá được mã chưa ai dùng', async () => {
    mockPrisma.couponUsage.count.mockResolvedValue(0)
    mockPrisma.coupon.delete.mockResolvedValue(BASE_COUPON)

    const res = await request(app)
      .delete('/api/admin/coupons/coupon-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })

  // Xoá mã đang chạy làm khách đang giữ mã mất mã giữa chừng, và mất luôn khả
  // năng đối chiếu — bảo admin tắt thay vì xoá.
  it('409 - mã đã có người dùng thì không cho xoá', async () => {
    mockPrisma.couponUsage.count.mockResolvedValue(3)

    const res = await request(app)
      .delete('/api/admin/coupons/coupon-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(409)
    expect(mockPrisma.coupon.delete).not.toHaveBeenCalled()
  })
})

// ─── GET /api/coupons ─────────────────────────────────────────────────────────

const USER_TOKEN = `Bearer ${signAccessToken({ userId: 'user-1', email: 'user@test.com', role: 'CUSTOMER' })}`

describe('GET /api/coupons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - chỉ mã đang chạy và còn lượt', async () => {
    mockPrisma.coupon.findMany.mockResolvedValue([BASE_COUPON])
    mockPrisma.couponUsage.findMany.mockResolvedValue([])

    const res = await request(app).get('/api/coupons').set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.coupons).toHaveLength(1)

    const where = mockPrisma.coupon.findMany.mock.calls[0][0].where
    expect(where.isActive).toBe(true)
    expect(where.startsAt).toHaveProperty('lte')
    expect(where.endsAt).toHaveProperty('gte')
  })

  // Mã đã dùng VẪN hiện nhưng gắn cờ — để FE làm mờ kèm lý do, thay vì mã biến
  // mất không rõ vì sao.
  it('200 - mã khách đã dùng vẫn hiện nhưng used = true', async () => {
    mockPrisma.coupon.findMany.mockResolvedValue([BASE_COUPON])
    mockPrisma.couponUsage.findMany.mockResolvedValue([{ couponId: 'coupon-1' }])

    const res = await request(app).get('/api/coupons').set('Authorization', USER_TOKEN)

    expect(res.body.coupons[0].used).toBe(true)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/coupons')
    expect(res.status).toBe(401)
  })
})

// ─── POST /api/coupons/preview ────────────────────────────────────────────────

const VARIANT = {
  id:        'var-1',
  sku:       'SKU-001',
  salePrice: 1_000_000,
  isActive:  true,
  color:     null,
  storage:   null,
  ram:       null,
  product:   { name: 'iPhone 15' },
}

describe('POST /api/coupons/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.productVariant.findMany.mockResolvedValue([VARIANT])
  })

  it('200 - mã hợp lệ, trả số tiền giảm và tổng mới', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(BASE_COUPON)
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/coupons/preview')
      .set('Authorization', USER_TOKEN)
      .send({ code: 'sale10', items: [{ variantId: 'var-1', quantity: 1 }] })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
    expect(res.body.subtotal).toBe(1_000_000)
    expect(res.body.discount).toBe(100_000)
    expect(res.body.total).toBe(900_000)
  })

  // Đây là endpoint KIỂM TRA — "mã không hợp lệ" là kết quả bình thường, không
  // phải lỗi. FE đọc một cờ `valid` thay vì phân nhánh theo bốn mã HTTP.
  it('200 - mã không tồn tại vẫn trả 200 kèm lý do', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(null)
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/coupons/preview')
      .set('Authorization', USER_TOKEN)
      .send({ code: 'KHONGCO', items: [{ variantId: 'var-1', quantity: 1 }] })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(false)
    expect(res.body.reason).toBe('Mã giảm giá không tồn tại')
    expect(res.body.discount).toBe(0)
  })

  it('200 - chưa đạt đơn tối thiểu thì báo lý do, không giảm', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({ ...BASE_COUPON, minOrderValue: 5_000_000 })
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/coupons/preview')
      .set('Authorization', USER_TOKEN)
      .send({ code: 'SALE10', items: [{ variantId: 'var-1', quantity: 1 }] })

    expect(res.body.valid).toBe(false)
    expect(res.body.reason).toMatch(/tối thiểu/)
    expect(res.body.discount).toBe(0)
  })

  // Nhận subtotal từ client là mời người ta gửi subtotal: 999999999 để qua ải
  // minOrderValue. Server tự tính từ giỏ hoặc từ items.
  it('200 - bỏ qua subtotal client gửi lên, tự tính từ items', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(BASE_COUPON)
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/coupons/preview')
      .set('Authorization', USER_TOKEN)
      .send({ code: 'SALE10', subtotal: 999_999_999, items: [{ variantId: 'var-1', quantity: 1 }] })

    expect(res.body.subtotal).toBe(1_000_000)
  })

  it('400 - thiếu code', async () => {
    const res = await request(app)
      .post('/api/coupons/preview')
      .set('Authorization', USER_TOKEN)
      .send({})

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/coupons/preview').send({ code: 'SALE10' })
    expect(res.status).toBe(401)
  })

  // Preview là endpoint KIỂM TRA: khách mở ngăn mã giảm giá trước khi bỏ gì vào
  // giỏ là chuyện bình thường. resolveItems ném 'Giỏ hàng trống, không thể đặt
  // hàng' vì nó sinh ra cho luồng ĐẶT HÀNG — thả lỗi đó bay lên là vừa phá hợp
  // đồng luôn-200, vừa bắn thông báo của luồng đặt hàng vào mặt người chỉ vừa gõ
  // mã. Kết quả đúng là 200 với subtotal 0, lý do đọc qua cờ `valid`.
  it('200 - giỏ trống vẫn trả 200 với subtotal 0, không lộ lỗi luồng đặt hàng', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(BASE_COUPON)
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)
    mockPrisma.cart.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/coupons/preview')
      .set('Authorization', USER_TOKEN)
      .send({ code: 'SALE10' })

    expect(res.status).toBe(200)
    expect(res.body.subtotal).toBe(0)
    expect(JSON.stringify(res.body)).not.toContain('Giỏ hàng trống, không thể đặt hàng')

    // BASE_COUPON có sàn 500.000 nên mã chưa dùng được — nhưng đó là lý do CỦA MÃ,
    // trả qua `valid` + `reason`, không phải một mã HTTP khác.
    expect(res.body.valid).toBe(false)
    expect(res.body.reason).toMatch(/tối thiểu/)
  })

  // Mặt còn lại của cùng một luật: mã không có sàn đơn thì giỏ trống vẫn là mã
  // HỢP LỆ, chỉ là chưa có gì để giảm. valid: true kèm discount 0 là câu trả lời
  // đúng, không phải lỗi.
  it('200 - giỏ trống + mã không có đơn tối thiểu vẫn valid, giảm 0', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({ ...BASE_COUPON, minOrderValue: 0 })
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)
    mockPrisma.cart.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/coupons/preview')
      .set('Authorization', USER_TOKEN)
      .send({ code: 'SALE10' })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
    expect(res.body.subtotal).toBe(0)
    expect(res.body.discount).toBe(0)
    expect(res.body.total).toBe(0)
  })

  // Lỗi hạ tầng KHÔNG được nuốt thành subtotal 0: nếu nuốt, khách đọc được "chưa
  // đạt đơn tối thiểu" trong khi sự thật là DB đang gãy.
  it('500 - lỗi DB khi đọc giỏ vẫn nổi lên, không hoá thành subtotal 0', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(BASE_COUPON)
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)
    mockPrisma.cart.findUnique.mockRejectedValue(new Error('connection lost'))

    const res = await request(app)
      .post('/api/coupons/preview')
      .set('Authorization', USER_TOKEN)
      .send({ code: 'SALE10' })

    expect(res.status).toBe(500)
  })
})
