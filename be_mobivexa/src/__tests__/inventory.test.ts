import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  productVariant: {
    findMany:   vi.fn(),
    count:      vi.fn(),
    aggregate:  vi.fn(),
    updateMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
}))

vi.mock('../config/db',    () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app = createApp()

const ADMIN_TOKEN = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`
const STAFF_TOKEN = `Bearer ${signAccessToken({ userId: 'staff-1', email: 'staff@test.com', role: 'STAFF' })}`
const USER_TOKEN  = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`

const BASE_VARIANT = {
  id:        'var-1',
  sku:       'SKU-001',
  color:     null,
  storage:   null,
  ram:       null,
  stock:     5,
  isActive:  true,
  price:     1500000,
  salePrice: 1200000,
  product:   { id: 'prod-1', name: 'iPhone 15', slug: 'iphone-15' },
}

function setupInventoryMocks() {
  mockPrisma.productVariant.findMany.mockResolvedValue([BASE_VARIANT])
  mockPrisma.productVariant.count.mockResolvedValue(1)
  mockPrisma.productVariant.aggregate.mockResolvedValue({
    _count: { id: 1 },
    _sum:   { stock: 5 },
  })
}

// ─── GET /api/admin/inventory ─────────────────────────────────────────────────

describe('GET /api/admin/inventory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - admin lấy danh sách tồn kho', async () => {
    setupInventoryMocks()

    const res = await request(app).get('/api/admin/inventory').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.variants).toHaveLength(1)
    expect(res.body.summary).toBeDefined()
    expect(res.body.summary.totalVariants).toBe(1)
  })

  it('200 - lọc theo stockStatus=low', async () => {
    setupInventoryMocks()

    const res = await request(app)
      .get('/api/admin/inventory?stockStatus=low')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })

  it('200 - STAFF cũng có quyền xem tồn kho', async () => {
    setupInventoryMocks()

    const res = await request(app).get('/api/admin/inventory').set('Authorization', STAFF_TOKEN)

    expect(res.status).toBe(200)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/admin/inventory')
    expect(res.status).toBe(401)
  })

  it('403 - CUSTOMER không có quyền', async () => {
    const res = await request(app).get('/api/admin/inventory').set('Authorization', USER_TOKEN)
    expect(res.status).toBe(403)
  })
})
