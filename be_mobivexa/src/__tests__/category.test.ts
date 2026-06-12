import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  category: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
    count:      vi.fn(),
  },
  product: { count: vi.fn() },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))
vi.mock('../config/cloudinary', () => ({
  uploadEntityImage: vi.fn().mockResolvedValue({ url: 'https://cdn/img.jpg', publicId: 'categories/img' }),
  destroyImage: vi.fn().mockResolvedValue(undefined),
}))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const app = createApp()

const ADMIN_TOKEN = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`
const USER_TOKEN  = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`

const BASE_CATEGORY = {
  id: 'cat-1',
  name: 'Điện thoại',
  slug: 'dien-thoai',
  description: null,
  parentId: null,
  sortOrder: 0,
  isActive: true,
  imageUrl: null,
  imagePublicId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ─── Public ───────────────────────────────────────────────────────────────────

describe('GET /api/categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về danh sách danh mục active', async () => {
    mockPrisma.category.findMany.mockResolvedValue([BASE_CATEGORY])

    const res = await request(app).get('/api/categories')

    expect(res.status).toBe(200)
    expect(res.body.categories ?? res.body).toBeDefined()
  })

  it('200 - trả về mảng rỗng khi không có danh mục', async () => {
    mockPrisma.category.findMany.mockResolvedValue([])

    const res = await request(app).get('/api/categories')

    expect(res.status).toBe(200)
  })
})

describe('GET /api/categories/:slug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về category kèm danh mục con', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ ...BASE_CATEGORY, children: [] })

    const res = await request(app).get('/api/categories/dien-thoai')

    expect(res.status).toBe(200)
    expect(res.body.category.slug).toBe('dien-thoai')
  })

  it('404 - slug không tồn tại', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/categories/khong-ton-tai')

    expect(res.status).toBe(404)
  })
})

// ─── Admin ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - admin lấy toàn bộ danh mục (kể cả inactive)', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      BASE_CATEGORY,
      { ...BASE_CATEGORY, id: 'cat-2', isActive: false },
    ])

    const res = await request(app).get('/api/admin/categories').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/admin/categories')
    expect(res.status).toBe(401)
  })

  it('403 - role CUSTOMER không có quyền', async () => {
    const res = await request(app).get('/api/admin/categories').set('Authorization', USER_TOKEN)
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - tạo danh mục root thành công', async () => {
    // generateUniqueSlug → findBySlug → null (slug chưa tồn tại)
    mockPrisma.category.findUnique.mockResolvedValue(null)
    mockPrisma.category.create.mockResolvedValue(BASE_CATEGORY)

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Điện thoại' })

    expect(res.status).toBe(201)
    expect(res.body.message).toMatch(/thành công/)
  })

  it('201 - tạo danh mục con với parentId hợp lệ', async () => {
    mockPrisma.category.findUnique
      .mockResolvedValueOnce({ id: 'cat-1' }) // assertParentExists
      .mockResolvedValueOnce(null)            // generateUniqueSlug: slug chưa tồn tại

    mockPrisma.category.create.mockResolvedValue({ ...BASE_CATEGORY, parentId: 'cat-1' })

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Android', parentId: 'cat-1' })

    expect(res.status).toBe(201)
  })

  it('400 - thiếu tên danh mục', async () => {
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', ADMIN_TOKEN)
      .send({})

    expect(res.status).toBe(400)
  })

  it('400 - tên danh mục quá ngắn', async () => {
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'A' })

    expect(res.status).toBe(400)
  })

  it('400 - parentId không tồn tại', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null) // assertParentExists: không tìm thấy

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Danh mục con', parentId: 'invalid-id' })

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/admin/categories').send({ name: 'Test' })
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/admin/categories/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - cập nhật tên danh mục thành công', async () => {
    mockPrisma.category.findUnique
      .mockResolvedValueOnce(BASE_CATEGORY) // findCategoryOrThrow
      .mockResolvedValueOnce(null)          // generateUniqueSlug: slug chưa tồn tại

    mockPrisma.category.update.mockResolvedValue({ ...BASE_CATEGORY, name: 'Laptop' })

    const res = await request(app)
      .put('/api/admin/categories/cat-1')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Laptop' })

    expect(res.status).toBe(200)
    expect(res.body.category.name).toBe('Laptop')
  })

  it('404 - danh mục không tồn tại', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .put('/api/admin/categories/khong-ton-tai')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Laptop' })

    expect(res.status).toBe(404)
  })

  it('400 - parentId là chính nó', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(BASE_CATEGORY)

    const res = await request(app)
      .put('/api/admin/categories/cat-1')
      .set('Authorization', ADMIN_TOKEN)
      .send({ parentId: 'cat-1' })

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app).put('/api/admin/categories/cat-1').send({ name: 'X' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/admin/categories/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - xóa danh mục thành công', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(BASE_CATEGORY)
    mockPrisma.category.count.mockResolvedValue(0)
    mockPrisma.product.count.mockResolvedValue(0)
    mockPrisma.category.delete.mockResolvedValue({})

    const res = await request(app)
      .delete('/api/admin/categories/cat-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/thành công/)
  })

  it('409 - còn danh mục con', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(BASE_CATEGORY)
    mockPrisma.category.count.mockResolvedValue(2) // có con
    mockPrisma.product.count.mockResolvedValue(0)

    const res = await request(app)
      .delete('/api/admin/categories/cat-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/danh mục con/)
  })

  it('409 - còn sản phẩm thuộc danh mục', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(BASE_CATEGORY)
    mockPrisma.category.count.mockResolvedValue(0)
    mockPrisma.product.count.mockResolvedValue(5) // có sản phẩm

    const res = await request(app)
      .delete('/api/admin/categories/cat-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/sản phẩm/)
  })

  it('404 - danh mục không tồn tại', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/admin/categories/khong-ton-tai')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(404)
  })

  it('401 - không có token', async () => {
    const res = await request(app).delete('/api/admin/categories/cat-1')
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/admin/categories/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - toggle trạng thái active → inactive', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(BASE_CATEGORY)
    mockPrisma.category.update.mockResolvedValue({ ...BASE_CATEGORY, isActive: false })

    const res = await request(app)
      .patch('/api/admin/categories/cat-1/status')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.category.isActive).toBe(false)
  })

  it('401 - không có token', async () => {
    const res = await request(app).patch('/api/admin/categories/cat-1/status')
    expect(res.status).toBe(401)
  })
})
