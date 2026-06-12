import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  cart: {
    upsert:     vi.fn(),
    findUnique: vi.fn(),
  },
  cartItem: {
    findUnique: vi.fn(),
    findFirst:  vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
    deleteMany: vi.fn(),
    count:      vi.fn(),
  },
  productVariant: {
    findUnique: vi.fn(),
  },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app        = createApp()
const USER_TOKEN = `Bearer ${signAccessToken({ userId: 'user-1', email: 'user@test.com', role: 'CUSTOMER' })}`

const CART    = { id: 'cart-1', userId: 'user-1' }
const VARIANT = { id: 'var-1', isActive: true, stock: 10 }
const ITEM    = { id: 'item-1', cartId: 'cart-1', variantId: 'var-1', quantity: 2 }

// ─── GET /api/cart ────────────────────────────────────────────────────────────

describe('GET /api/cart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - lấy giỏ hàng (upsert nếu chưa có)', async () => {
    mockPrisma.cart.upsert.mockResolvedValue({ ...CART, items: [] })

    const res = await request(app).get('/api/cart').set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/cart')
    expect(res.status).toBe(401)
  })
})

// ─── POST /api/cart/items ─────────────────────────────────────────────────────

describe('POST /api/cart/items', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - thêm sản phẩm mới vào giỏ', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(VARIANT)
    mockPrisma.cart.upsert.mockResolvedValue(CART)
    mockPrisma.cartItem.findUnique.mockResolvedValue(null) // chưa có item
    mockPrisma.cartItem.create.mockResolvedValue(ITEM)
    mockPrisma.cartItem.count.mockResolvedValue(1)

    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', USER_TOKEN)
      .send({ variantId: 'var-1', quantity: 2 })

    expect(res.status).toBe(201)
  })

  it('201 - tăng số lượng khi sản phẩm đã có trong giỏ', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(VARIANT)
    mockPrisma.cart.upsert.mockResolvedValue(CART)
    mockPrisma.cartItem.findUnique.mockResolvedValue({ ...ITEM, quantity: 2 })
    mockPrisma.cartItem.update.mockResolvedValue({ ...ITEM, quantity: 4 })
    mockPrisma.cartItem.count.mockResolvedValue(1)

    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', USER_TOKEN)
      .send({ variantId: 'var-1', quantity: 2 })

    expect(res.status).toBe(201)
  })

  it('400 - số lượng vượt quá tồn kho', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({ ...VARIANT, stock: 1 })
    mockPrisma.cart.upsert.mockResolvedValue(CART)

    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', USER_TOKEN)
      .send({ variantId: 'var-1', quantity: 5 })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/không đủ hàng/)
  })

  it('404 - variant không tồn tại hoặc ngừng bán', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(null)
    mockPrisma.cart.upsert.mockResolvedValue(CART)

    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', USER_TOKEN)
      .send({ variantId: 'not-found', quantity: 1 })

    expect(res.status).toBe(404)
  })

  it('400 - thiếu variantId', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', USER_TOKEN)
      .send({ quantity: 1 })

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/cart/items').send({ variantId: 'var-1', quantity: 1 })
    expect(res.status).toBe(401)
  })
})

// ─── PUT /api/cart/items/:itemId ──────────────────────────────────────────────

describe('PUT /api/cart/items/:itemId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - cập nhật số lượng thành công', async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(CART)
    mockPrisma.cartItem.findFirst.mockResolvedValue(ITEM)
    mockPrisma.productVariant.findUnique.mockResolvedValue({ stock: 10 })
    mockPrisma.cartItem.update.mockResolvedValue({ ...ITEM, quantity: 3 })
    mockPrisma.cartItem.count.mockResolvedValue(1)

    const res = await request(app)
      .put('/api/cart/items/item-1')
      .set('Authorization', USER_TOKEN)
      .send({ quantity: 3 })

    expect(res.status).toBe(200)
  })

  it('400 - số lượng vượt tồn kho', async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(CART)
    mockPrisma.cartItem.findFirst.mockResolvedValue(ITEM)
    mockPrisma.productVariant.findUnique.mockResolvedValue({ stock: 2 })

    const res = await request(app)
      .put('/api/cart/items/item-1')
      .set('Authorization', USER_TOKEN)
      .send({ quantity: 10 })

    expect(res.status).toBe(400)
  })

  it('404 - item không thuộc giỏ hàng', async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(CART)
    mockPrisma.cartItem.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .put('/api/cart/items/not-mine')
      .set('Authorization', USER_TOKEN)
      .send({ quantity: 1 })

    expect(res.status).toBe(404)
  })
})

// ─── DELETE /api/cart/items/:itemId ──────────────────────────────────────────

describe('DELETE /api/cart/items/:itemId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - xóa item khỏi giỏ', async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(CART)
    mockPrisma.cartItem.findFirst.mockResolvedValue(ITEM)
    mockPrisma.cartItem.delete.mockResolvedValue({})
    mockPrisma.cartItem.count.mockResolvedValue(0)

    const res = await request(app)
      .delete('/api/cart/items/item-1')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
  })

  it('404 - giỏ hàng chưa tồn tại', async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/cart/items/item-1')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(404)
  })
})

// ─── DELETE /api/cart ─────────────────────────────────────────────────────────

describe('DELETE /api/cart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - xóa toàn bộ giỏ hàng', async () => {
    mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 3 })

    const res = await request(app).delete('/api/cart').set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
  })

  it('401 - không có token', async () => {
    const res = await request(app).delete('/api/cart')
    expect(res.status).toBe(401)
  })
})
