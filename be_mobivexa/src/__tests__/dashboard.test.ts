/** Dashboard thống kê admin: today, doanh thu 30 ngày (timezone VN), đơn theo trạng
 *  thái, top bán chạy, cảnh báo tồn kho — chốt theo hợp đồng FE. Mốc thời gian được
 *  đóng băng ở 2026-03-15 10:30 giờ VN để assert cửa sổ ngày chính xác tuyệt đối. */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  order: {
    findMany: vi.fn(),
    groupBy:  vi.fn(),
  },
  orderItem: { groupBy: vi.fn() },
  productVariant: { findMany: vi.fn() },
  user: { count: vi.fn() },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app = createApp()
const token    = (role: string) => `Bearer ${signAccessToken({ userId: 'u-1', email: 'u@test.com', role })}`
const ADMIN    = token('ADMIN')
const STAFF    = token('STAFF')
const CUSTOMER = token('CUSTOMER')

// Mốc giả: 2026-03-15 03:30 UTC = 10:30 giờ VN → "hôm nay" theo giờ VN là 2026-03-15
const FAKE_NOW        = new Date('2026-03-15T03:30:00.000Z')
const TODAY_START_VN  = new Date('2026-03-14T17:00:00.000Z') // 00:00 hôm nay giờ VN (2026-03-15)
const WINDOW_START_VN = new Date('2026-02-13T17:00:00.000Z') // 00:00 giờ VN của 2026-02-14 (29 ngày trước)

const GET = (auth?: string) => {
  const req = request(app).get('/api/admin/dashboard')
  return auth ? req.set('Authorization', auth) : req
}

beforeEach(() => {
  // Chỉ đóng băng Date, giữ timers thật để supertest hoạt động bình thường
  vi.useFakeTimers({ now: FAKE_NOW, toFake: ['Date'] })
  vi.clearAllMocks()
  // Mặc định: dữ liệu rỗng — từng test ghi đè phần mình quan tâm
  mockPrisma.user.count.mockResolvedValue(0)
  mockPrisma.order.findMany.mockResolvedValue([])
  mockPrisma.order.groupBy.mockResolvedValue([])
  mockPrisma.orderItem.groupBy.mockResolvedValue([])
  mockPrisma.productVariant.findMany.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Phân quyền: STAFF_ROLES như các adminRouter khác ─────────────────────────

describe('GET /api/admin/dashboard — phân quyền', () => {
  it('401 - chưa đăng nhập', async () => {
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('403 - customer không được xem', async () => {
    const res = await GET(CUSTOMER)
    expect(res.status).toBe(403)
  })

  it('200 - staff được xem', async () => {
    const res = await GET(STAFF)
    expect(res.status).toBe(200)
  })
})

// ─── Shape hợp đồng FE ────────────────────────────────────────────────────────

describe('GET /api/admin/dashboard — shape', () => {
  it('đủ 5 khối dữ liệu đúng thứ tự hợp đồng', async () => {
    const res = await GET(ADMIN)
    expect(res.status).toBe(200)
    expect(Object.keys(res.body)).toEqual(['today', 'revenue30d', 'ordersByStatus', 'topProducts', 'lowStock'])
    expect(Object.keys(res.body.today)).toEqual(['orders', 'revenue', 'newUsers'])
  })
})

// ─── today ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/dashboard — today', () => {
  it('chỉ tính đơn trong cửa sổ 30 ngày, newUsers mốc đầu ngày VN hôm nay', async () => {
    // Đơn hôm nay (VN) đã PAID + đơn ngoài cửa sổ phải bị bỏ qua
    mockPrisma.order.findMany.mockResolvedValue([
      { createdAt: new Date('2026-03-15T01:00:00.000Z'), total: 500_000, paymentStatus: 'PAID', status: 'CONFIRMED' }, // 08:00 VN hôm nay
      { createdAt: new Date('2026-02-01T02:00:00.000Z'), total: 9_999_000, paymentStatus: 'PAID', status: 'CONFIRMED' }, // ngoài 30 ngày
    ])
    mockPrisma.user.count.mockResolvedValue(3)

    const res = await GET(ADMIN)

    // Cửa sổ findMany = 00:00 VN của 29 ngày trước; count user = 00:00 VN hôm nay
    expect(mockPrisma.order.findMany).toHaveBeenCalledTimes(1)
    const findManyArg = mockPrisma.order.findMany.mock.calls[0][0]
    expect(findManyArg.where.createdAt.gte).toEqual(WINDOW_START_VN)
    expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: { createdAt: { gte: TODAY_START_VN } } })

    expect(res.body.today).toEqual({ orders: 1, revenue: 500_000, newUsers: 3 })
  })
})

// ─── revenue30d ───────────────────────────────────────────────────────────────

describe('GET /api/admin/dashboard — revenue30d', () => {
  it('đủ 30 bucket kể cả ngày trống, bucket cuối là hôm nay', async () => {
    const res = await GET(ADMIN)

    expect(res.body.revenue30d).toHaveLength(30)
    expect(res.body.revenue30d[0]).toEqual({ date: '2026-02-14', revenue: 0, orders: 0 })
    expect(res.body.revenue30d[15]).toEqual({ date: '2026-03-01', revenue: 0, orders: 0 }) // ngày trống giữa chuỗi
    expect(res.body.revenue30d[29]).toEqual({ date: '2026-03-15', revenue: 0, orders: 0 }) // hôm nay
  })

  it('đơn PAID + CANCELLED không tính doanh thu nhưng vẫn đếm là đơn', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      // Hôm nay: PAID+CONFIRMED tính tiền | PAID+CANCELLED KHÔNG tính tiền | UNPAID không tính tiền
      { createdAt: new Date('2026-03-15T01:00:00.000Z'), total: 300_000, paymentStatus: 'PAID',   status: 'CONFIRMED' },
      { createdAt: new Date('2026-03-15T02:00:00.000Z'), total: 200_000, paymentStatus: 'PAID',   status: 'CANCELLED' },
      { createdAt: new Date('2026-03-15T02:30:00.000Z'), total: 100_000, paymentStatus: 'UNPAID', status: 'PENDING'   },
      // Hôm qua (VN): PAID+DELIVERED tính tiền
      { createdAt: new Date('2026-03-14T10:00:00.000Z'), total: 50_000,  paymentStatus: 'PAID',   status: 'DELIVERED' },
    ])

    const res = await GET(ADMIN)

    expect(res.body.revenue30d[29]).toEqual({ date: '2026-03-15', revenue: 300_000, orders: 3 })
    expect(res.body.revenue30d[28]).toEqual({ date: '2026-03-14', revenue: 50_000, orders: 1 })
    // today rút từ bucket cuối nên khớp biểu đồ
    expect(res.body.today.orders).toBe(3)
    expect(res.body.today.revenue).toBe(300_000)
  })
})

// ─── ordersByStatus ───────────────────────────────────────────────────────────

describe('GET /api/admin/dashboard — ordersByStatus', () => {
  it('đủ 5 trạng thái, trạng thái thiếu được nối count 0 cho donut FE', async () => {
    mockPrisma.order.groupBy.mockResolvedValue([
      { status: 'PENDING',   _count: 2 },
      { status: 'CANCELLED', _count: 1 },
    ])

    const res = await GET(ADMIN)

    expect(res.body.ordersByStatus).toEqual([
      { status: 'PENDING',   count: 2 },
      { status: 'CONFIRMED', count: 0 },
      { status: 'SHIPPING',  count: 0 },
      { status: 'DELIVERED', count: 0 },
      { status: 'CANCELLED', count: 1 },
    ])
    // Group mọi thời gian — không có mốc ngày trong where
    expect(mockPrisma.order.groupBy).toHaveBeenCalledTimes(1)
    expect(mockPrisma.order.groupBy.mock.calls[0][0].where).toBeUndefined()
  })
})

// ─── topProducts ──────────────────────────────────────────────────────────────

describe('GET /api/admin/dashboard — topProducts', () => {
  it('chỉ tính đơn PAID & không hủy, map variantId về product, giữ thứ tự DB', async () => {
    mockPrisma.orderItem.groupBy.mockResolvedValue([
      { variantId: 'v-2', _sum: { quantity: 3,  subtotal: 24_000_000 } },
      { variantId: 'v-1', _sum: { quantity: 10, subtotal: 150_000_000 } },
    ])
    // DB trả findMany không đảm bảo thứ tự — map theo variantId, thứ tự bán chạy giữ từ orderBy groupBy
    mockPrisma.productVariant.findMany.mockResolvedValue([
      { id: 'v-1', product: { id: 'p-1', name: 'Laptop A', slug: 'laptop-a' } },
      { id: 'v-2', product: { id: 'p-2', name: 'Phone B',  slug: 'phone-b' } },
    ])

    const res = await GET(ADMIN)

    // where lọc đúng bộ chỉ tiêu doanh thu (PAID + != CANCELLED)
    const groupByArg = mockPrisma.orderItem.groupBy.mock.calls[0][0]
    expect(groupByArg.where.order).toEqual({ paymentStatus: 'PAID', status: { not: 'CANCELLED' } })

    expect(res.body.topProducts).toEqual([
      { productId: 'p-2', name: 'Phone B',  slug: 'phone-b', sold: 3,  revenue: 24_000_000 },
      { productId: 'p-1', name: 'Laptop A', slug: 'laptop-a', sold: 10, revenue: 150_000_000 },
    ])
  })

  it('nhóm biến thể đã bị xóa (không map được product) bị loại khỏi kết quả', async () => {
    mockPrisma.orderItem.groupBy.mockResolvedValue([
      { variantId: 'v-gone', _sum: { quantity: 5, subtotal: 1_000_000 } },
      { variantId: 'v-1',    _sum: { quantity: 2, subtotal: 900_000 } },
    ])
    mockPrisma.productVariant.findMany.mockResolvedValue([
      { id: 'v-1', product: { id: 'p-1', name: 'Laptop A', slug: 'laptop-a' } },
    ])

    const res = await GET(ADMIN)

    expect(res.body.topProducts).toEqual([
      { productId: 'p-1', name: 'Laptop A', slug: 'laptop-a', sold: 2, revenue: 900_000 },
    ])
  })
})

// ─── lowStock ─────────────────────────────────────────────────────────────────

describe('GET /api/admin/dashboard — lowStock', () => {
  it('lọc stock <= 10 thuộc product isActive, sắp stock tăng dần, tối đa 5', async () => {
    mockPrisma.productVariant.findMany.mockResolvedValue([
      { id: 'v-9', sku: 'SKU-9', stock: 2, product: { name: 'IP16 Pro' } },
      { id: 'v-7', sku: 'SKU-7', stock: 10, product: { name: 'IP16' } },
    ])

    const res = await GET(ADMIN)

    const findManyArg = mockPrisma.productVariant.findMany.mock.calls[0][0]
    expect(findManyArg.where).toEqual({ stock: { lte: 10 }, product: { isActive: true } })
    expect(findManyArg.orderBy).toEqual({ stock: 'asc' })
    expect(findManyArg.take).toBe(5)

    expect(res.body.lowStock).toEqual([
      { variantId: 'v-9', productName: 'IP16 Pro', sku: 'SKU-9', stock: 2 },
      { variantId: 'v-7', productName: 'IP16',     sku: 'SKU-7', stock: 10 },
    ])
  })
})
