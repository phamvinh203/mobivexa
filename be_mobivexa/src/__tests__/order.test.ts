import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  address:        { findFirst: vi.fn() },
  cart:           { findUnique: vi.fn() },
  productVariant: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  order: {
    create:     vi.fn(),
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    count:      vi.fn(),
    update:     vi.fn(),
  },
  cartItem: { deleteMany: vi.fn() },
  coupon:      { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  couponUsage: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { Prisma } from '../generated/prisma/client'
import { signAccessToken } from '../utils/token_manager'

const app = createApp()

const USER_TOKEN  = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`
const ADMIN_TOKEN = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`

const conflictError = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'test',
  })

const BASE_VARIANT = {
  id:        'var-1',
  sku:       'SKU-001',
  salePrice: 1000000,
  stock:     10,
  isActive:  true,
  color:     null,
  storage:   null,
  ram:       null,
  product:   { name: 'iPhone 15' },
}

const BASE_ORDER = {
  id:               'order-1',
  orderCode:        'ORD-20240101-AABBCC',
  userId:           'user-1',
  status:           'PENDING',
  paymentMethod:    'COD',
  paymentStatus:    'UNPAID',
  subtotal:         1000000,
  shippingFee:      0,
  discount:         0,
  total:            1000000,
  shippingName:     'Test User',
  shippingPhone:    '0900000001',
  shippingProvince: 'HCM',
  shippingDistrict: 'Q1',
  shippingWard:     'P1',
  shippingDetail:   '123 ABC',
  note:             null,
  cancelReason:     null,
  paidAt:           null,
  createdAt:        new Date(),
  updatedAt:        new Date(),
  items: [
    { id: 'item-1', variantId: 'var-1', productName: 'iPhone 15', sku: 'SKU-001', quantity: 1, unitPrice: 1000000, subtotal: 1000000, color: null, storage: null, ram: null },
  ],
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(mockPrisma)
    )
  })

  it('201 - tạo đơn hàng từ items truyền vào', async () => {
    mockPrisma.address.findFirst.mockResolvedValue({ id: 'addr-1', userId: 'user-1', fullName: 'Test', phone: '0900000001', province: 'HCM', district: 'Q1', ward: 'P1', streetDetail: '123 ABC' })
    mockPrisma.productVariant.findMany.mockResolvedValue([BASE_VARIANT])
    mockPrisma.order.create.mockResolvedValue(BASE_ORDER)
    mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', USER_TOKEN)
      .send({
        addressId: 'addr-1',
        paymentMethod: 'COD',
        items: [{ variantId: 'var-1', quantity: 1 }],
      })

    expect(res.status).toBe(201)
  })

  it('400 - thiếu addressId', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', USER_TOKEN)
      .send({ items: [{ variantId: 'var-1', quantity: 1 }] })

    expect(res.status).toBe(400)
  })

  it('404 - địa chỉ không tồn tại', async () => {
    mockPrisma.address.findFirst.mockResolvedValue(null)
    mockPrisma.productVariant.findMany.mockResolvedValue([BASE_VARIANT])

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', USER_TOKEN)
      .send({ addressId: 'not-found', items: [{ variantId: 'var-1', quantity: 1 }] })

    expect(res.status).toBe(404)
  })

  it('400 - đặt hàng từ giỏ trống', async () => {
    mockPrisma.address.findFirst.mockResolvedValue({ id: 'addr-1', userId: 'user-1', fullName: 'Test', phone: '0900000001', province: 'HCM', district: 'Q1', ward: 'P1', streetDetail: '123' })
    mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart-1', items: [] })

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', USER_TOKEN)
      .send({ addressId: 'addr-1' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/giỏ hàng trống/i)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/orders').send({ addressId: 'addr-1' })
    expect(res.status).toBe(401)
  })
})

// ─── GET /api/orders ──────────────────────────────────────────────────────────

describe('GET /api/orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - lấy danh sách đơn của tôi', async () => {
    mockPrisma.order.findMany.mockResolvedValue([BASE_ORDER])
    mockPrisma.order.count.mockResolvedValue(1)

    const res = await request(app).get('/api/orders').set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.orders).toHaveLength(1)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/orders')
    expect(res.status).toBe(401)
  })
})

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────

describe('GET /api/orders/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - lấy chi tiết đơn hàng', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(BASE_ORDER)

    const res = await request(app).get('/api/orders/order-1').set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
  })

  it('404 - đơn không thuộc về user này', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null)

    const res = await request(app).get('/api/orders/not-mine').set('Authorization', USER_TOKEN)

    expect(res.status).toBe(404)
  })
})

// ─── PATCH /api/orders/:id/cancel ────────────────────────────────────────────

describe('PATCH /api/orders/:id/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(mockPrisma)
    )
  })

  it('200 - hủy đơn hàng PENDING thành công', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(BASE_ORDER)
    mockPrisma.order.update.mockResolvedValue({ ...BASE_ORDER, status: 'CANCELLED' })
    mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .patch('/api/orders/order-1/cancel')
      .set('Authorization', USER_TOKEN)
      .send({})

    expect(res.status).toBe(200)
    expect(res.body.order.status).toBe('CANCELLED')
  })

  it('400 - không thể hủy đơn DELIVERED', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ ...BASE_ORDER, status: 'DELIVERED' })

    const res = await request(app)
      .patch('/api/orders/order-1/cancel')
      .set('Authorization', USER_TOKEN)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/không thể hủy/i)
  })

  // Guard `status` trong WHERE là thứ chặn hoàn kho hai lần khi hai request huỷ
  // chạy song song: request thua cuộc không khớp WHERE nên ăn P2025 và dừng lại
  // TRƯỚC bước increment.
  it('409 - đơn vừa bị đổi trạng thái ở nơi khác, không hoàn kho', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(BASE_ORDER)
    mockPrisma.order.update.mockRejectedValue(conflictError())

    const res = await request(app)
      .patch('/api/orders/order-1/cancel')
      .set('Authorization', USER_TOKEN)
      .send({})

    expect(res.status).toBe(409)
    expect(mockPrisma.productVariant.updateMany).not.toHaveBeenCalled()
  })
})

// ─── Admin: GET /api/admin/orders ─────────────────────────────────────────────

describe('GET /api/admin/orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - admin lấy tất cả đơn hàng', async () => {
    mockPrisma.order.findMany.mockResolvedValue([BASE_ORDER])
    mockPrisma.order.count.mockResolvedValue(1)

    const res = await request(app).get('/api/admin/orders').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.orders).toHaveLength(1)
  })

  it('200 - lọc theo mã đơn, khớp một phần và bỏ qua hoa thường', async () => {
    mockPrisma.order.findMany.mockResolvedValue([BASE_ORDER])
    mockPrisma.order.count.mockResolvedValue(1)

    const res = await request(app)
      .get('/api/admin/orders')
      .query({ search: 'aabbcc' })
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orderCode: { contains: 'aabbcc', mode: 'insensitive' } }),
      })
    )
  })

  it('200 - search chỉ có khoảng trắng thì không lọc mã đơn', async () => {
    mockPrisma.order.findMany.mockResolvedValue([BASE_ORDER])
    mockPrisma.order.count.mockResolvedValue(1)

    const res = await request(app)
      .get('/api/admin/orders')
      .query({ search: '   ' })
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(mockPrisma.order.findMany.mock.calls[0][0].where).not.toHaveProperty('orderCode')
  })

  it('200 - lọc ngày trần được nới ra trọn hai đầu ngày', async () => {
    mockPrisma.order.findMany.mockResolvedValue([BASE_ORDER])
    mockPrisma.order.count.mockResolvedValue(1)

    await request(app)
      .get('/api/admin/orders')
      .query({ from: '2026-08-01', to: '2026-08-17' })
      .set('Authorization', ADMIN_TOKEN)

    const { createdAt } = mockPrisma.order.findMany.mock.calls[0][0].where
    expect(createdAt.gte).toEqual(new Date('2026-08-01T00:00:00.000'))
    expect(createdAt.lte).toEqual(new Date('2026-08-17T23:59:59.999'))
  })

  it('200 - mốc đã kèm giờ thì giữ nguyên, không bị nới', async () => {
    mockPrisma.order.findMany.mockResolvedValue([BASE_ORDER])
    mockPrisma.order.count.mockResolvedValue(1)

    await request(app)
      .get('/api/admin/orders')
      .query({ to: '2026-08-17T09:30:00.000Z' })
      .set('Authorization', ADMIN_TOKEN)

    const { createdAt } = mockPrisma.order.findMany.mock.calls[0][0].where
    expect(createdAt.lte).toEqual(new Date('2026-08-17T09:30:00.000Z'))
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/admin/orders')
    expect(res.status).toBe(401)
  })
})

// ─── Admin: PATCH /api/admin/orders/:id/status ────────────────────────────────

describe('PATCH /api/admin/orders/:id/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(mockPrisma)
    )
  })

  it('200 - chuyển trạng thái PENDING → CONFIRMED', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)
    mockPrisma.order.update.mockResolvedValue({ ...BASE_ORDER, status: 'CONFIRMED' })

    const res = await request(app)
      .patch('/api/admin/orders/order-1/status')
      .set('Authorization', ADMIN_TOKEN)
      .send({ status: 'CONFIRMED' })

    expect(res.status).toBe(200)
    expect(res.body.order.status).toBe('CONFIRMED')
  })

  it('400 - chuyển trạng thái không hợp lệ (PENDING → DELIVERED)', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)

    const res = await request(app)
      .patch('/api/admin/orders/order-1/status')
      .set('Authorization', ADMIN_TOKEN)
      .send({ status: 'DELIVERED' })

    expect(res.status).toBe(400)
  })

  it('400 - status không hợp lệ', async () => {
    const res = await request(app)
      .patch('/api/admin/orders/order-1/status')
      .set('Authorization', ADMIN_TOKEN)
      .send({ status: 'UNKNOWN' })

    expect(res.status).toBe(400)
  })

  it('404 - đơn hàng không tồn tại', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/admin/orders/not-found/status')
      .set('Authorization', ADMIN_TOKEN)
      .send({ status: 'CONFIRMED' })

    expect(res.status).toBe(404)
  })

  it('409 - admin khác vừa đổi trạng thái đơn này', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)
    mockPrisma.order.update.mockRejectedValue(conflictError())

    const res = await request(app)
      .patch('/api/admin/orders/order-1/status')
      .set('Authorization', ADMIN_TOKEN)
      .send({ status: 'CONFIRMED' })

    expect(res.status).toBe(409)
  })
})

// ─── Admin: PATCH /api/admin/orders/:id/payment ───────────────────────────────

describe('PATCH /api/admin/orders/:id/payment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - cập nhật trạng thái thanh toán', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)
    mockPrisma.order.update.mockResolvedValue({ ...BASE_ORDER, paymentStatus: 'PAID' })

    const res = await request(app)
      .patch('/api/admin/orders/order-1/payment')
      .set('Authorization', ADMIN_TOKEN)
      .send({ paymentStatus: 'PAID' })

    expect(res.status).toBe(200)
    expect(res.body.order.paymentStatus).toBe('PAID')
  })

  it('400 - paymentStatus không hợp lệ', async () => {
    const res = await request(app)
      .patch('/api/admin/orders/order-1/payment')
      .set('Authorization', ADMIN_TOKEN)
      .send({ paymentStatus: 'INVALID' })

    expect(res.status).toBe(400)
  })

  it('404 - đơn hàng không tồn tại', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/admin/orders/not-found/payment')
      .set('Authorization', ADMIN_TOKEN)
      .send({ paymentStatus: 'PAID' })

    expect(res.status).toBe(404)
  })
})

// ─── Đặt hàng có mã giảm giá ──────────────────────────────────────────────────

const ACTIVE_COUPON = {
  id:            'coupon-1',
  code:          'SALE10',
  type:          'PERCENT',
  value:         10,
  maxDiscount:   null,
  minOrderValue: 0,
  usageLimit:    100,
  usedCount:     0,
  startsAt:      new Date('2020-01-01T00:00:00.000Z'),
  endsAt:        new Date('2099-01-01T00:00:00.000Z'),
  isActive:      true,
}

describe('POST /api/orders - có mã giảm giá', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(mockPrisma)
    )
    mockPrisma.address.findFirst.mockResolvedValue({
      id: 'addr-1', userId: 'user-1', fullName: 'Test', phone: '0900000001',
      province: 'HCM', district: 'Q1', ward: 'P1', streetDetail: '123 ABC',
    })
    mockPrisma.productVariant.findMany.mockResolvedValue([BASE_VARIANT])
    mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.order.create.mockResolvedValue(BASE_ORDER)
  })

  const postOrder = () =>
    request(app)
      .post('/api/orders')
      .set('Authorization', USER_TOKEN)
      .send({
        addressId: 'addr-1',
        items: [{ variantId: 'var-1', quantity: 1 }],
        couponCode: 'sale10',
      })

  it('201 - đơn mang discount và couponCode snapshot', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(ACTIVE_COUPON)
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)
    mockPrisma.coupon.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.couponUsage.create.mockResolvedValue({})

    const res = await postOrder()

    expect(res.status).toBe(201)
    const data = mockPrisma.order.create.mock.calls[0][0].data
    expect(data.discount).toBe(100_000)   // 10% của 1.000.000
    expect(data.couponCode).toBe('SALE10')
    expect(data.total).toBe(900_000)
  })

  it('400 - mã không tồn tại, đơn không được tạo', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(null)
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)

    const res = await postOrder()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Mã giảm giá không tồn tại')
    expect(mockPrisma.order.create).not.toHaveBeenCalled()
  })

  // Mã hết lượt GIỮA lúc kiểm tra và lúc ghi: guard usedCount < usageLimit không
  // khớp nên updateMany trả count 0, transaction rollback.
  it('409 - mã vừa hết lượt trong lúc đặt', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(ACTIVE_COUPON)
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)
    mockPrisma.coupon.updateMany.mockResolvedValue({ count: 0 })

    const res = await postOrder()

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/hết lượt/)
  })

  // Khoá chính (couponId, userId) là thứ chặn, không phải logic ứng dụng.
  it('409 - khách đặt hai đơn song song cùng một mã', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(ACTIVE_COUPON)
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)
    mockPrisma.coupon.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.couponUsage.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    )

    const res = await postOrder()

    expect(res.status).toBe(409)
    expect(res.body.message).toBe('Bạn đã sử dụng mã này rồi')
  })

  const postCoupon = (couponCode: unknown) =>
    request(app)
      .post('/api/orders')
      .set('Authorization', USER_TOKEN)
      .send({
        addressId: 'addr-1',
        items: [{ variantId: 'var-1', quantity: 1 }],
        couponCode,
      })

  // Payload rác phải ra 400 ở cổng validator, không phải 500 ở normalizeCode:
  // couponCode: 123 là truthy nên đi trọn tới raw.trim() và nổ TypeError.
  it('400 - couponCode không phải chuỗi', async () => {
    const res = await postCoupon(123)

    expect(res.status).toBe(400)
    expect(mockPrisma.coupon.findUnique).not.toHaveBeenCalled()
  })

  // Chặn ĐỘ DÀI ngay tại cổng, cùng trần 32 với validatePreviewCoupon: mã vài
  // megabyte là lỗi của client, không được phép thành một lượt truy vấn Prisma.
  it('400 - couponCode dài quá trần, không chạm tới DB', async () => {
    const res = await postCoupon('A'.repeat(33))

    expect(res.status).toBe(400)
    expect(mockPrisma.coupon.findUnique).not.toHaveBeenCalled()
  })

  // Cổng chỉ kiểm tra khi couponCode TRUTHY — đúng nhánh mà createOrder sẽ chạy.
  // Form luôn gửi kèm field thì ô trống ra chuỗi rỗng; bắt lỗi nó là khoá luôn
  // đường đặt hàng của khách không dùng mã.
  it('201 - couponCode rỗng được coi như không dùng mã', async () => {
    const res = await postCoupon('')

    expect(res.status).toBe(201)
    expect(mockPrisma.coupon.findUnique).not.toHaveBeenCalled()
  })
})

// ─── Huỷ đơn có mã ────────────────────────────────────────────────────────────

describe('PATCH /api/orders/:id/cancel - hoàn lại mã', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(mockPrisma)
    )
    mockPrisma.order.findFirst.mockResolvedValue(BASE_ORDER)
    mockPrisma.order.update.mockResolvedValue({ ...BASE_ORDER, status: 'CANCELLED' })
    mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 })
  })

  it('200 - xoá usage và giảm usedCount', async () => {
    mockPrisma.couponUsage.findUnique.mockResolvedValue({
      couponId: 'coupon-1', userId: 'user-1', orderId: 'order-1',
    })
    mockPrisma.couponUsage.delete.mockResolvedValue({})
    mockPrisma.coupon.updateMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .patch('/api/orders/order-1/cancel')
      .set('Authorization', USER_TOKEN)
      .send({})

    expect(res.status).toBe(200)
    expect(mockPrisma.couponUsage.delete).toHaveBeenCalledWith({
      where: { couponId_userId: { couponId: 'coupon-1', userId: 'user-1' } },
    })
    // gt: 0 là chốt phòng thân để usedCount không bao giờ âm
    expect(mockPrisma.coupon.updateMany.mock.calls[0][0].where.usedCount).toEqual({ gt: 0 })
  })

  it('200 - đơn không dùng mã thì không đụng tới bảng coupon', async () => {
    mockPrisma.couponUsage.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/orders/order-1/cancel')
      .set('Authorization', USER_TOKEN)
      .send({})

    expect(res.status).toBe(200)
    expect(mockPrisma.coupon.updateMany).not.toHaveBeenCalled()
  })
})
