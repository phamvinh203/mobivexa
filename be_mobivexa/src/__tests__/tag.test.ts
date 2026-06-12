import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  tag: {
    findMany:   vi.fn(),
    findUnique: vi.fn(),
    create:     vi.fn(),
    delete:     vi.fn(),
  },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app         = createApp()
const ADMIN_TOKEN = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`
const USER_TOKEN  = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`

const BASE_TAG = { id: 'tag-1', name: 'iOS', slug: 'ios', createdAt: new Date(), updatedAt: new Date() }

// ─── Public ───────────────────────────────────────────────────────────────────

describe('GET /api/tags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về danh sách tag', async () => {
    mockPrisma.tag.findMany.mockResolvedValue([BASE_TAG])

    const res = await request(app).get('/api/tags')

    expect(res.status).toBe(200)
  })
})

// ─── Admin ────────────────────────────────────────────────────────────────────

describe('POST /api/admin/tags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - tạo tag thành công', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(null) // tên chưa tồn tại; slug chưa tồn tại
    mockPrisma.tag.create.mockResolvedValue(BASE_TAG)

    const res = await request(app)
      .post('/api/admin/tags')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'iOS' })

    expect(res.status).toBe(201)
  })

  it('400 - thiếu tên tag', async () => {
    const res = await request(app)
      .post('/api/admin/tags')
      .set('Authorization', ADMIN_TOKEN)
      .send({})

    expect(res.status).toBe(400)
  })

  it('409 - tag đã tồn tại', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(BASE_TAG)

    const res = await request(app)
      .post('/api/admin/tags')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'iOS' })

    expect(res.status).toBe(409)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/admin/tags').send({ name: 'iOS' })
    expect(res.status).toBe(401)
  })

  it('403 - role CUSTOMER không có quyền', async () => {
    const res = await request(app)
      .post('/api/admin/tags')
      .set('Authorization', USER_TOKEN)
      .send({ name: 'iOS' })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/tags/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - xóa tag thành công', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(BASE_TAG)
    mockPrisma.tag.delete.mockResolvedValue({})

    const res = await request(app)
      .delete('/api/admin/tags/tag-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })

  it('404 - tag không tồn tại', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/admin/tags/khong-ton-tai')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(404)
  })

  it('401 - không có token', async () => {
    const res = await request(app).delete('/api/admin/tags/tag-1')
    expect(res.status).toBe(401)
  })
})
