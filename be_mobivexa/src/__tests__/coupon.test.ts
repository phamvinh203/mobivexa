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
    findMany:   vi.fn(),
    count:      vi.fn(),
  },
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
