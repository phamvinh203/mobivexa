import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  brand: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
  },
  product: { count: vi.fn() },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))
vi.mock('../config/cloudinary', () => ({
  uploadEntityImage: vi.fn().mockResolvedValue({ url: 'https://cdn/logo.jpg', publicId: 'brands/logo' }),
  destroyImage: vi.fn().mockResolvedValue(undefined),
}))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const app = createApp()

const ADMIN_TOKEN  = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`
const USER_TOKEN   = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`

const BASE_BRAND = {
  id: 'brand-1',
  name: 'Apple',
  slug: 'apple',
  description: 'Thương hiệu Apple',
  logoUrl: null,
  logoPublicId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ─── Public ───────────────────────────────────────────────────────────────────

describe('GET /api/brands', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về danh sách thương hiệu active', async () => {
    mockPrisma.brand.findMany.mockResolvedValue([BASE_BRAND])

    const res = await request(app).get('/api/brands')

    expect(res.status).toBe(200)
    expect(res.body.brands).toHaveLength(1)
    expect(res.body.brands[0].name).toBe('Apple')
  })

  it('200 - trả về mảng rỗng khi không có brand', async () => {
    mockPrisma.brand.findMany.mockResolvedValue([])

    const res = await request(app).get('/api/brands')

    expect(res.status).toBe(200)
    expect(res.body.brands).toHaveLength(0)
  })
})

describe('GET /api/brands/:slug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về brand theo slug', async () => {
    mockPrisma.brand.findUnique.mockResolvedValue(BASE_BRAND)

    const res = await request(app).get('/api/brands/apple')

    expect(res.status).toBe(200)
    expect(res.body.brand.slug).toBe('apple')
  })

  it('404 - slug không tồn tại', async () => {
    mockPrisma.brand.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/brands/khong-ton-tai')

    expect(res.status).toBe(404)
  })
})

// ─── Admin ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/brands', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - admin lấy toàn bộ brand (kể cả inactive)', async () => {
    mockPrisma.brand.findMany.mockResolvedValue([BASE_BRAND, { ...BASE_BRAND, id: 'brand-2', isActive: false }])

    const res = await request(app).get('/api/admin/brands').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.brands).toHaveLength(2)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/admin/brands')
    expect(res.status).toBe(401)
  })

  it('403 - role CUSTOMER không có quyền', async () => {
    const res = await request(app).get('/api/admin/brands').set('Authorization', USER_TOKEN)
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/brands', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - tạo brand thành công', async () => {
    // assertNameAvailable → null (chưa tồn tại), generateUniqueSlug → null (slug chưa tồn tại)
    mockPrisma.brand.findUnique.mockResolvedValue(null)
    mockPrisma.brand.create.mockResolvedValue(BASE_BRAND)

    const res = await request(app)
      .post('/api/admin/brands')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Apple' })

    expect(res.status).toBe(201)
    expect(res.body.message).toMatch(/thành công/)
    expect(res.body.brand.name).toBe('Apple')
  })

  it('400 - thiếu tên thương hiệu', async () => {
    const res = await request(app)
      .post('/api/admin/brands')
      .set('Authorization', ADMIN_TOKEN)
      .send({})

    expect(res.status).toBe(400)
  })

  it('400 - tên thương hiệu quá ngắn (< 2 ký tự)', async () => {
    const res = await request(app)
      .post('/api/admin/brands')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'A' })

    expect(res.status).toBe(400)
  })

  it('409 - tên thương hiệu đã tồn tại', async () => {
    mockPrisma.brand.findUnique.mockResolvedValue(BASE_BRAND) // assertNameAvailable tìm thấy

    const res = await request(app)
      .post('/api/admin/brands')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Apple' })

    expect(res.status).toBe(409)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/admin/brands').send({ name: 'Apple' })
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/admin/brands/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - cập nhật tên brand thành công', async () => {
    mockPrisma.brand.findUnique
      .mockResolvedValueOnce(BASE_BRAND)  // findBrandOrThrow
      .mockResolvedValueOnce(null)        // assertNameAvailable: tên chưa dùng

    mockPrisma.brand.update.mockResolvedValue({ ...BASE_BRAND, name: 'Samsung' })

    const res = await request(app)
      .put('/api/admin/brands/brand-1')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Samsung' })

    expect(res.status).toBe(200)
    expect(res.body.brand.name).toBe('Samsung')
  })

  it('404 - brand không tồn tại', async () => {
    mockPrisma.brand.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .put('/api/admin/brands/khong-ton-tai')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Samsung' })

    expect(res.status).toBe(404)
  })

  it('401 - không có token', async () => {
    const res = await request(app).put('/api/admin/brands/brand-1').send({ name: 'Samsung' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/admin/brands/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - xóa brand thành công', async () => {
    mockPrisma.brand.findUnique.mockResolvedValue(BASE_BRAND)
    mockPrisma.product.count.mockResolvedValue(0)
    mockPrisma.brand.delete.mockResolvedValue({})

    const res = await request(app)
      .delete('/api/admin/brands/brand-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/thành công/)
  })

  it('409 - brand còn chứa sản phẩm', async () => {
    mockPrisma.brand.findUnique.mockResolvedValue(BASE_BRAND)
    mockPrisma.product.count.mockResolvedValue(3)

    const res = await request(app)
      .delete('/api/admin/brands/brand-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(409)
  })

  it('404 - brand không tồn tại', async () => {
    mockPrisma.brand.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/admin/brands/khong-ton-tai')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(404)
  })

  it('401 - không có token', async () => {
    const res = await request(app).delete('/api/admin/brands/brand-1')
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/admin/brands/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - toggle trạng thái active → inactive', async () => {
    mockPrisma.brand.findUnique.mockResolvedValue(BASE_BRAND)
    mockPrisma.brand.update.mockResolvedValue({ ...BASE_BRAND, isActive: false })

    const res = await request(app)
      .patch('/api/admin/brands/brand-1/status')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.brand.isActive).toBe(false)
  })

  it('401 - không có token', async () => {
    const res = await request(app).patch('/api/admin/brands/brand-1/status')
    expect(res.status).toBe(401)
  })
})
