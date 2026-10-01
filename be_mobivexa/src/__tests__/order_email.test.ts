import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Test này chạy service email THẬT (khác order.test.ts / payment.test.ts mock ở
// ranh giới service) — mock đúng hai phụ thuộc của nó: prisma và mailer. Đủ để
// kiểm gate env, điều kiện "chỉ gửi khi transition thật sự" và hành vi ném lỗi.

const mockMailer = vi.hoisted(() => ({
  sendMail:               vi.fn().mockResolvedValue(undefined),
  sendResetPasswordEmail: vi.fn().mockResolvedValue(undefined),
}))

const mockPrisma = vi.hoisted(() => ({
  order: { findUnique: vi.fn() },
}))

vi.mock('../utils/mailer', () => mockMailer)
vi.mock('../config/db',    () => ({ default: mockPrisma }))

import {
  sendOrderCreatedEmail,
  sendOrderPaidEmail,
  sendOrderCancelledEmail,
} from '../services/order_email.service'

const BASE_ORDER = {
  id:               'order-1',
  orderCode:        'ORD-20240101-AABBCC',
  userId:           'user-1',
  shippingName:     'Test User',
  shippingPhone:    '0900000001',
  shippingProvince: 'HCM',
  shippingDistrict: 'Q1',
  shippingWard:     'P1',
  shippingDetail:   '123 ABC',
  subtotal:         1000000,
  shippingFee:      0,
  discount:         0,
  total:            1000000,
  status:           'PENDING',
  paymentMethod:    'COD',
  paymentStatus:    'UNPAID',
  note:             null,
  cancelReason:     null,
  paidAt:           null,
  createdAt:        new Date(),
  updatedAt:        new Date(),
  items: [{
    id: 'item-1', orderId: 'order-1', variantId: 'var-1',
    productName: 'iPhone 15', sku: 'SKU-001', color: 'Đen', storage: '128GB', ram: null,
    unitPrice: 1000000, quantity: 1, subtotal: 1000000,
  }],
  user: { email: 'user@test.com', fullName: 'Test User' },
}

// Gọi test này sau khi unstub env (afterEach) vẫn phải idempotent
afterEach(() => {
  vi.unstubAllEnvs()
})

// Xoá lịch sử gọi giữa các test — mockResolvedValue đặt lúc tạo không bị mất
beforeEach(() => {
  vi.clearAllMocks()
})

describe('order_email.service — gate cấu hình', () => {
  it('EMAIL_ORDER_ENABLED=false → không gửi (mặc định bật chỉ khi unset)', async () => {
    vi.stubEnv('SMTP_HOST', 'smtp.test.local')
    vi.stubEnv('EMAIL_ORDER_ENABLED', 'false')
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)

    await sendOrderCreatedEmail('order-1')

    expect(mockMailer.sendMail).not.toHaveBeenCalled()
    // Bị chặn ở gate nên không tốn truy vấn DB
    expect(mockPrisma.order.findUnique).not.toHaveBeenCalled()
  })

  it('SMTP_HOST trống → không gửi, không throw', async () => {
    vi.stubEnv('SMTP_HOST', '')
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)

    await expect(sendOrderPaidEmail('order-1')).resolves.toBeUndefined()
    expect(mockMailer.sendMail).not.toHaveBeenCalled()
  })

  it('đơn không tồn tại / thiếu email người nhận → bỏ qua im lặng', async () => {
    vi.stubEnv('SMTP_HOST', 'smtp.test.local')
    mockPrisma.order.findUnique.mockResolvedValue(null)

    await expect(sendOrderCancelledEmail('order-404')).resolves.toBeUndefined()
    expect(mockMailer.sendMail).not.toHaveBeenCalled()
  })
})

describe('order_email.service — nội dung và điều kiện gửi', () => {
  // Gate mở: SMTP_HOST có giá trị, EMAIL_ORDER_ENABLED để mặc định (unset)
  beforeEach(() => {
    vi.stubEnv('SMTP_HOST', 'smtp.test.local')
    vi.stubEnv('FRONTEND_URL', 'http://localhost:5001,http://localhost:5002')
  })

  it('đơn mới: gửi đúng người nhận, chủ đề có mã đơn, link trỏ trang chi tiết đơn', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)

    await sendOrderCreatedEmail('order-1')

    expect(mockMailer.sendMail).toHaveBeenCalledTimes(1)
    const { to, subject, html } = mockMailer.sendMail.mock.calls[0][0]
    expect(to).toBe('user@test.com')
    expect(subject).toContain('ORD-20240101-AABBCC')
    // Route chi tiết đơn của web khách (AppRouter.tsx): /tai-khoan/don-hang/:orderId
    expect(html).toContain('http://localhost:5001/tai-khoan/don-hang/order-1')
    // Danh sách FRONTEND_URL chỉ lấy origin đầu tiên
    expect(html).not.toContain('localhost:5002')
  })

  it('đã thanh toán: chỉ gửi khi paymentStatus thật sự PAID', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ ...BASE_ORDER, paymentStatus: 'PAID', paidAt: new Date() })

    await sendOrderPaidEmail('order-1')

    expect(mockMailer.sendMail).toHaveBeenCalledTimes(1)
  })

  it('đơn chưa PAID → không gửi mail đã thanh toán', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER) // paymentStatus: UNPAID

    await sendOrderPaidEmail('order-1')

    expect(mockMailer.sendMail).not.toHaveBeenCalled()
  })

  it('đã hủy: chỉ gửi khi status thật sự CANCELLED', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      ...BASE_ORDER,
      status: 'CANCELLED',
      cancelReason: 'Khách đổi ý',
      paymentStatus: 'UNPAID',
    })

    await sendOrderCancelledEmail('order-1')

    expect(mockMailer.sendMail).toHaveBeenCalledTimes(1)
    const { subject, html } = mockMailer.sendMail.mock.calls[0][0]
    expect(subject).toContain('đã bị hủy')
    expect(html).toContain('Khách đổi ý')
    // Đơn chưa thanh toán → không được hứa hoàn tiền
    expect(html).not.toContain('hoàn tiền')
  })

  it('đơn hủy nhưng chưa CANCELLED → không gửi mail hủy', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER) // status: PENDING

    await sendOrderCancelledEmail('order-1')

    expect(mockMailer.sendMail).not.toHaveBeenCalled()
  })

  it('mailer reject → ném lỗi lên hook (hook chịu trách nhiệm .catch)', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)
    mockMailer.sendMail.mockRejectedValueOnce(new Error('SMTP timeout'))

    await expect(sendOrderCreatedEmail('order-1')).rejects.toThrow('SMTP timeout')
  })
})
