import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  address:        { findFirst: vi.fn() },
  cart:           { findUnique: vi.fn() },
  productVariant: { findMany: vi.fn(), update: vi.fn() },
  order: {
    create:     vi.fn(),
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    count:      vi.fn(),
    update:     vi.fn(),
  },
  cartItem: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app = createApp()

const USER_TOKEN  = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`
const ADMIN_TOKEN = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`

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
    mockPrisma.productVariant.update.mockResolvedValue({})
    // updateMany được gọi trong transaction
    mockPrisma.productVariant.findMany.mockResolvedValue([BASE_VARIANT])

    // mock updateMany via productVariant (trong tx = mockPrisma)
    ;(mockPrisma.productVariant as any).updateMany = vi.fn().mockResolvedValue({ count: 1 })

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
    mockPrisma.productVariant.update.mockResolvedValue({})

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
