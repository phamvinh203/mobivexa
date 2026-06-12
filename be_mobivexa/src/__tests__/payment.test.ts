import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  order: {
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn(),
  },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app        = createApp()
const USER_TOKEN = `Bearer ${signAccessToken({ userId: 'user-1', email: 'user@test.com', role: 'CUSTOMER' })}`
const WEBHOOK_SECRET = 'test-webhook-secret'

const BASE_ORDER = {
  id:            'order-1',
  orderCode:     'ORD-20240101-AABBCC',
  total:         500000,
  paymentMethod: 'BANK_TRANSFER',
  paymentStatus: 'UNPAID',
  status:        'PENDING',
}

// ─── GET /api/orders/:id/payment ──────────────────────────────────────────────

describe('GET /api/orders/:id/payment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả thông tin thanh toán QR', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(BASE_ORDER)

    const res = await request(app)
      .get('/api/orders/order-1/payment')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.content).toBe('ORD-20240101-AABBCC')
    expect(res.body.amount).toBe(500000)
  })

  it('400 - đơn hàng không dùng chuyển khoản', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ ...BASE_ORDER, paymentMethod: 'COD' })

    const res = await request(app)
      .get('/api/orders/order-1/payment')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/chuyển khoản/i)
  })

  it('400 - đơn đã thanh toán rồi', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ ...BASE_ORDER, paymentStatus: 'PAID' })

    const res = await request(app)
      .get('/api/orders/order-1/payment')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/đã.*thanh toán/i)
  })

  it('404 - đơn hàng không tồn tại', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/orders/not-found/payment')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(404)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/orders/order-1/payment')
    expect(res.status).toBe(401)
  })
})

// ─── POST /api/webhooks/sepay ─────────────────────────────────────────────────

describe('POST /api/webhooks/sepay', () => {
  beforeEach(() => vi.clearAllMocks())

  const validPayload = {
    transferType:    'in',
    transferAmount:  500000,
    content:         'Thanh toan ORD-20240101-AABBCC',
    transactionDate: '2024-01-01 10:00:00',
  }

  it('200 - xử lý webhook hợp lệ và đánh dấu đã thanh toán', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)
    mockPrisma.order.update.mockResolvedValue({ ...BASE_ORDER, paymentStatus: 'PAID' })

    const res = await request(app)
      .post('/api/webhooks/sepay')
      .set('x-sepay-secret', WEBHOOK_SECRET)
      .send(validPayload)

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(true)
    expect(res.body.orderCode).toBe('ORD-20240101-AABBCC')
  })

  it('200 - bỏ qua nếu loại giao dịch là "out"', async () => {
    const res = await request(app)
      .post('/api/webhooks/sepay')
      .set('x-sepay-secret', WEBHOOK_SECRET)
      .send({ ...validPayload, transferType: 'out' })

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(false)
  })

  it('200 - bỏ qua nếu không tìm thấy mã đơn trong nội dung', async () => {
    const res = await request(app)
      .post('/api/webhooks/sepay')
      .set('x-sepay-secret', WEBHOOK_SECRET)
      .send({ ...validPayload, content: 'chuyen khoan vang lai' })

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(false)
  })

  it('200 - bỏ qua nếu số tiền không khớp', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)

    const res = await request(app)
      .post('/api/webhooks/sepay')
      .set('x-sepay-secret', WEBHOOK_SECRET)
      .send({ ...validPayload, transferAmount: 100 })

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(false)
  })

  it('401 - thiếu header x-sepay-secret', async () => {
    const res = await request(app).post('/api/webhooks/sepay').send(validPayload)
    expect(res.status).toBe(401)
  })

  it('401 - secret không đúng', async () => {
    const res = await request(app)
      .post('/api/webhooks/sepay')
      .set('x-sepay-secret', 'wrong-secret')
      .send(validPayload)

    expect(res.status).toBe(401)
  })
})
