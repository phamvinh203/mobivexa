import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  favorite: {
    findMany:   vi.fn(),
    count:      vi.fn(),
    create:     vi.fn(),
    deleteMany: vi.fn(),
  },
  product: {
    findUnique: vi.fn(),
  },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { Prisma } from '../generated/prisma/client'
import { signAccessToken } from '../utils/token_manager'

const app        = createApp()
const USER_TOKEN = `Bearer ${signAccessToken({ userId: 'user-1', email: 'user@test.com', role: 'CUSTOMER' })}`

const ACTIVE_PRODUCT = { id: 'prod-1', isActive: true }

const FAVORITE_ROW = {
  createdAt: new Date(),
  product: {
    id: 'prod-1',
    name: 'iPhone 15',
    slug: 'iphone-15',
    brand:    { id: 'brand-1', name: 'Apple', slug: 'apple' },
    variants: [{ id: 'var-1', salePrice: 1000000, originalPrice: 1200000, stock: 5 }],
    images:   [{ url: 'https://cdn/iphone.jpg' }],
  },
}

const duplicateKeyError = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })

// ─── GET /api/favorites ───────────────────────────────────────────────────────

describe('GET /api/favorites', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - danh sách yêu thích kèm phân trang', async () => {
    mockPrisma.favorite.findMany.mockResolvedValue([FAVORITE_ROW])
    mockPrisma.favorite.count.mockResolvedValue(1)

    const res = await request(app).get('/api/favorites').set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.favorites).toHaveLength(1)
    expect(res.body.pagination.total).toBe(1)
  })

  // Sản phẩm bị admin ẩn thì biến khỏi danh sách, nhưng bản ghi vẫn nằm trong DB
  // — bật bán lại là hiện lại, khách không mất mục đã thích.
  it('200 - chỉ lấy sản phẩm đang bán', async () => {
    mockPrisma.favorite.findMany.mockResolvedValue([])
    mockPrisma.favorite.count.mockResolvedValue(0)

    await request(app).get('/api/favorites').set('Authorization', USER_TOKEN)

    const where = mockPrisma.favorite.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ userId: 'user-1', product: { isActive: true } })
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/favorites')
    expect(res.status).toBe(401)
  })
})

// ─── GET /api/favorites/ids ───────────────────────────────────────────────────

describe('GET /api/favorites/ids', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả mảng productId phẳng', async () => {
    mockPrisma.favorite.findMany.mockResolvedValue([{ productId: 'prod-1' }, { productId: 'prod-2' }])

    const res = await request(app).get('/api/favorites/ids').set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.productIds).toEqual(['prod-1', 'prod-2'])
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/favorites/ids')
    expect(res.status).toBe(401)
  })
})

// ─── POST /api/favorites ──────────────────────────────────────────────────────

describe('POST /api/favorites', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - thêm sản phẩm vào yêu thích', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(ACTIVE_PRODUCT)
    mockPrisma.favorite.create.mockResolvedValue({ userId: 'user-1', productId: 'prod-1' })

    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', USER_TOKEN)
      .send({ productId: 'prod-1' })

    expect(res.status).toBe(201)
    expect(res.body.favorited).toBe(true)
  })

  // Idempotent: bấm tim hai lần (double-tap trên mobile, mạng chậm) không được
  // ném lỗi — trạng thái cuối vẫn là "đã thích".
  it('200 - thích lại sản phẩm đã thích, không lỗi', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(ACTIVE_PRODUCT)
    mockPrisma.favorite.create.mockRejectedValue(duplicateKeyError())

    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', USER_TOKEN)
      .send({ productId: 'prod-1' })

    expect(res.status).toBe(200)
    expect(res.body.favorited).toBe(true)
  })

  it('404 - sản phẩm không tồn tại', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', USER_TOKEN)
      .send({ productId: 'khong-co' })

    expect(res.status).toBe(404)
    expect(mockPrisma.favorite.create).not.toHaveBeenCalled()
  })

  it('404 - sản phẩm đã ngừng bán', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: false })

    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', USER_TOKEN)
      .send({ productId: 'prod-1' })

    expect(res.status).toBe(404)
    expect(mockPrisma.favorite.create).not.toHaveBeenCalled()
  })

  it('400 - thiếu productId', async () => {
    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', USER_TOKEN)
      .send({})

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/favorites').send({ productId: 'prod-1' })
    expect(res.status).toBe(401)
  })
})

// ─── DELETE /api/favorites/:productId ─────────────────────────────────────────

describe('DELETE /api/favorites/:productId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - bỏ thích sản phẩm', async () => {
    mockPrisma.favorite.deleteMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .delete('/api/favorites/prod-1')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.favorited).toBe(false)
  })

  // Idempotent như POST: bỏ thích cái chưa từng thích vẫn là 200, vì trạng thái
  // client mong muốn ("không thích") đã đạt được.
  it('200 - bỏ thích sản phẩm chưa thích, không lỗi', async () => {
    mockPrisma.favorite.deleteMany.mockResolvedValue({ count: 0 })

    const res = await request(app)
      .delete('/api/favorites/prod-1')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.favorited).toBe(false)
  })

  it('401 - không có token', async () => {
    const res = await request(app).delete('/api/favorites/prod-1')
    expect(res.status).toBe(401)
  })
})
