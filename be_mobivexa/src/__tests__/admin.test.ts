import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    count:      vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
  },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app = createApp()

const ADMIN_TOKEN = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`
const STAFF_TOKEN = `Bearer ${signAccessToken({ userId: 'staff-1', email: 'staff@test.com', role: 'STAFF' })}`
const USER_TOKEN  = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`

const BASE_USER = {
  id:        'user-2',
  email:     'customer@test.com',
  fullName:  'Test User',
  role:      'CUSTOMER',
  isActive:  true,
  avatarUrl: null,
  phone:     null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  beforeEach(() => vi.clearAllMocks())

  // Express 5 trả MẢNG khi query lặp key, nên `.trim()` ném TypeError → 500.
  it('200 - search lặp key vẫn chạy, không phải 500', async () => {
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.count.mockResolvedValue(0)

    const res = await request(app)
      .get('/api/admin/users?search=a&search=b')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })

  it('200 - admin lấy danh sách người dùng', async () => {
    mockPrisma.user.findMany.mockResolvedValue([BASE_USER])
    mockPrisma.user.count.mockResolvedValue(1)

    const res = await request(app).get('/api/admin/users').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.users).toHaveLength(1)
  })

  it('403 - STAFF không có quyền truy cập', async () => {
    const res = await request(app).get('/api/admin/users').set('Authorization', STAFF_TOKEN)
    expect(res.status).toBe(403)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/admin/users')
    expect(res.status).toBe(401)
  })
})

// ─── GET /api/admin/users/:id ─────────────────────────────────────────────────

describe('GET /api/admin/users/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - lấy chi tiết người dùng', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...BASE_USER, _count: { addresses: 2, refreshTokens: 1 } })

    const res = await request(app).get('/api/admin/users/user-2').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })

  it('404 - người dùng không tồn tại', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/admin/users/not-found').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(404)
  })
})

// ─── PATCH /api/admin/users/:id/role ─────────────────────────────────────────

describe('PATCH /api/admin/users/:id/role', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - đổi role thành công', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' })
    mockPrisma.user.update.mockResolvedValue({ ...BASE_USER, role: 'STAFF', _count: { addresses: 0, refreshTokens: 0 } })

    const res = await request(app)
      .patch('/api/admin/users/user-2/role')
      .set('Authorization', ADMIN_TOKEN)
      .send({ role: 'STAFF' })

    expect(res.status).toBe(200)
  })

  it('400 - không thể đổi role của chính mình', async () => {
    const res = await request(app)
      .patch('/api/admin/users/admin-1/role')
      .set('Authorization', ADMIN_TOKEN)
      .send({ role: 'STAFF' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/chính mình/)
  })

  it('400 - role không hợp lệ', async () => {
    const res = await request(app)
      .patch('/api/admin/users/user-2/role')
      .set('Authorization', ADMIN_TOKEN)
      .send({ role: 'SUPERADMIN' })

    expect(res.status).toBe(400)
  })

  it('404 - người dùng không tồn tại', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/admin/users/not-found/role')
      .set('Authorization', ADMIN_TOKEN)
      .send({ role: 'STAFF' })

    expect(res.status).toBe(404)
  })
})

// ─── PATCH /api/admin/users/:id/status ───────────────────────────────────────

describe('PATCH /api/admin/users/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - khóa tài khoản người dùng', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', isActive: true })
    mockPrisma.user.update.mockResolvedValue({ ...BASE_USER, isActive: false, _count: { addresses: 0, refreshTokens: 0 } })

    const res = await request(app)
      .patch('/api/admin/users/user-2/status')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })

  it('400 - không thể khóa tài khoản của chính mình', async () => {
    const res = await request(app)
      .patch('/api/admin/users/admin-1/status')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/chính mình/)
  })

  it('404 - người dùng không tồn tại', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/admin/users/not-found/status')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(404)
  })
})

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────

describe('DELETE /api/admin/users/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - xóa người dùng thành công', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' })
    mockPrisma.user.delete.mockResolvedValue({})

    const res = await request(app)
      .delete('/api/admin/users/user-2')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })

  it('400 - không thể xóa tài khoản của chính mình', async () => {
    const res = await request(app)
      .delete('/api/admin/users/admin-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/chính mình/)
  })

  it('404 - người dùng không tồn tại', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/admin/users/not-found')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(404)
  })

  it('403 - CUSTOMER không có quyền xóa', async () => {
    const res = await request(app)
      .delete('/api/admin/users/user-2')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(403)
  })
})
