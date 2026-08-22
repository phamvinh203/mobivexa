import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  product:       { findUnique: vi.fn() },
  orderItem:     { findMany: vi.fn(), findFirst: vi.fn() },
  productVariant:{ findUnique: vi.fn() },
  review: {
    aggregate:  vi.fn(),
    groupBy:    vi.fn(),
    findMany:   vi.fn(),
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    count:      vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
  },
  reviewPhoto:   { count: vi.fn() },
  reviewHelpful: {
    findUnique: vi.fn(),
    create:     vi.fn(),
    delete:     vi.fn(),
  },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))
vi.mock('../config/cloudinary', () => ({
  uploadEntityImage: vi.fn().mockResolvedValue({ url: 'https://cdn/img.jpg', publicId: 'reviews/img' }),
  destroyImage:      vi.fn().mockResolvedValue(undefined),
}))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app = createApp()

const USER_TOKEN  = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`
const ADMIN_TOKEN = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`

const BASE_PRODUCT = { id: 'prod-1', slug: 'iphone-15' }

const BASE_REVIEW = {
  id:           'review-1',
  userId:       'user-1',
  productId:    'prod-1',
  orderItemId:  'item-1',
  variantId:    'var-1',
  rating:       5,
  content:      'Sản phẩm rất tốt',
  status:       'APPROVED',
  replyContent: null,
  repliedAt:    null,
  createdAt:    new Date(),
  updatedAt:    new Date(),
  photos:       [],
}

// ─── Public: GET /api/products/:slug/reviews/summary ─────────────────────────

describe('GET /api/products/:slug/reviews/summary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về tổng hợp đánh giá', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(BASE_PRODUCT)
    mockPrisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { id: 10 } })
    mockPrisma.review.groupBy.mockResolvedValue([{ rating: 5, _count: { id: 7 } }, { rating: 4, _count: { id: 3 } }])
    mockPrisma.reviewPhoto.count.mockResolvedValue(5)

    const res = await request(app).get('/api/products/iphone-15/reviews/summary')

    expect(res.status).toBe(200)
    expect(res.body.averageRating).toBe(4.5)
    expect(res.body.totalCount).toBe(10)
  })

  it('404 - sản phẩm không tồn tại', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/products/khong-ton-tai/reviews/summary')

    expect(res.status).toBe(404)
  })
})

// ─── Public: GET /api/products/:slug/reviews ─────────────────────────────────

describe('GET /api/products/:slug/reviews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về danh sách đánh giá', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(BASE_PRODUCT)
    mockPrisma.review.findMany.mockResolvedValue([BASE_REVIEW])
    mockPrisma.review.count.mockResolvedValue(1)

    const res = await request(app).get('/api/products/iphone-15/reviews')

    expect(res.status).toBe(200)
    expect(res.body.reviews).toHaveLength(1)
  })
})

// ─── User: GET /api/users/me/reviews/pending ─────────────────────────────────

describe('GET /api/users/me/reviews/pending', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về danh sách đơn chờ đánh giá', async () => {
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { id: 'item-1', productName: 'iPhone 15', sku: 'SKU-001', quantity: 1, unitPrice: 1000000, order: { id: 'order-1', orderCode: 'ORD-001', updatedAt: new Date() } },
    ])

    const res = await request(app).get('/api/users/me/reviews/pending').set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.orderItems ?? res.body).toBeDefined()
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/users/me/reviews/pending')
    expect(res.status).toBe(401)
  })
})

// ─── User: GET /api/users/me/reviews ─────────────────────────────────────────

describe('GET /api/users/me/reviews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về các đánh giá của tôi', async () => {
    mockPrisma.review.findMany.mockResolvedValue([BASE_REVIEW])
    mockPrisma.review.count.mockResolvedValue(1)

    const res = await request(app).get('/api/users/me/reviews').set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.reviews).toHaveLength(1)
  })
})

// ─── User: POST /api/order-items/:id/review ───────────────────────────────────

describe('POST /api/order-items/:id/review', () => {
  beforeEach(() => vi.clearAllMocks())

  // Dòng hàng đã giao, chưa đánh giá — điều kiện để createReview đi hết luồng.
  const arrangeReviewableItem = () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1', variantId: 'var-1',
      order:  { id: 'order-1' },
      review: null,
    })
    mockPrisma.productVariant.findUnique.mockResolvedValue({ productId: 'prod-1' })
    mockPrisma.review.create.mockResolvedValue(BASE_REVIEW)
  }

  it('201 - tạo đánh giá thành công', async () => {
    arrangeReviewableItem()

    const res = await request(app)
      .post('/api/order-items/item-1/review')
      .set('Authorization', USER_TOKEN)
      .send({ rating: 5, content: 'Sản phẩm tốt lắm' })

    expect(res.status).toBe(201)
  })

  // Client thật gửi multipart (route có upload ảnh) nên rating tới server là
  // chuỗi "5". Không ép về số thì Prisma ném "Expected Int, provided String".
  it('201 - gửi multipart: rating chuỗi được ép về số trước khi vào Prisma', async () => {
    arrangeReviewableItem()

    const res = await request(app)
      .post('/api/order-items/item-1/review')
      .set('Authorization', USER_TOKEN)
      .field('rating', '5')
      .field('content', 'Sản phẩm tốt lắm')

    expect(res.status).toBe(201)
    expect(mockPrisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rating: 5 }) })
    )
  })

  it('400 - thiếu rating', async () => {
    const res = await request(app)
      .post('/api/order-items/item-1/review')
      .set('Authorization', USER_TOKEN)
      .send({ content: 'Sản phẩm tốt' })

    expect(res.status).toBe(400)
  })

  it('400 - thiếu content', async () => {
    const res = await request(app)
      .post('/api/order-items/item-1/review')
      .set('Authorization', USER_TOKEN)
      .send({ rating: 5 })

    expect(res.status).toBe(400)
  })

  it('404 - order item không thuộc đơn DELIVERED', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/order-items/not-found/review')
      .set('Authorization', USER_TOKEN)
      .send({ rating: 5, content: 'Sản phẩm tốt lắm' })

    expect(res.status).toBe(404)
  })

  it('409 - đã đánh giá sản phẩm này rồi', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1', variantId: 'var-1',
      order:  { id: 'order-1' },
      review: { id: 'review-existing' },
    })

    const res = await request(app)
      .post('/api/order-items/item-1/review')
      .set('Authorization', USER_TOKEN)
      .send({ rating: 5, content: 'Sản phẩm tốt lắm' })

    expect(res.status).toBe(409)
  })

  it('401 - không có token', async () => {
    const res = await request(app)
      .post('/api/order-items/item-1/review')
      .send({ rating: 5, content: 'OK' })

    expect(res.status).toBe(401)
  })
})

// ─── User: PUT /api/reviews/:id ───────────────────────────────────────────────

describe('PUT /api/reviews/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - chỉnh sửa đánh giá thành công', async () => {
    mockPrisma.review.findFirst.mockResolvedValue({ ...BASE_REVIEW, photos: [] })
    mockPrisma.review.update.mockResolvedValue({ ...BASE_REVIEW, content: 'Đã cập nhật', photos: [] })

    const res = await request(app)
      .put('/api/reviews/review-1')
      .set('Authorization', USER_TOKEN)
      .send({ content: 'Đã cập nhật', rating: 4 })

    expect(res.status).toBe(200)
  })

  it('200 - gửi multipart: rating chuỗi được ép về số trước khi vào Prisma', async () => {
    mockPrisma.review.findFirst.mockResolvedValue(BASE_REVIEW)
    mockPrisma.review.update.mockResolvedValue(BASE_REVIEW)

    const res = await request(app)
      .put('/api/reviews/review-1')
      .set('Authorization', USER_TOKEN)
      .field('rating', '4')

    expect(res.status).toBe(200)
    expect(mockPrisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rating: 4 }) })
    )
  })

  it('404 - đánh giá không thuộc về user', async () => {
    mockPrisma.review.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .put('/api/reviews/not-mine')
      .set('Authorization', USER_TOKEN)
      .send({ content: 'Nội dung đánh giá đủ dài' })

    expect(res.status).toBe(404)
  })
})

// ─── User: DELETE /api/reviews/:id ───────────────────────────────────────────

describe('DELETE /api/reviews/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('204 - xóa đánh giá thành công', async () => {
    mockPrisma.review.findFirst.mockResolvedValue({ ...BASE_REVIEW, photos: [] })
    mockPrisma.review.delete.mockResolvedValue({})

    const res = await request(app)
      .delete('/api/reviews/review-1')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(204)
  })

  it('404 - đánh giá không tồn tại', async () => {
    mockPrisma.review.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/reviews/not-found')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(404)
  })
})

// ─── User: POST /api/reviews/:id/helpful ─────────────────────────────────────

describe('POST /api/reviews/:id/helpful', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - đánh dấu helpful (chưa vote)', async () => {
    mockPrisma.review.findUnique
      .mockResolvedValueOnce({ id: 'review-1', status: 'APPROVED' })     // kiểm tra tồn tại
      .mockResolvedValueOnce({ _count: { helpful: 1 } })                  // lấy count mới
    mockPrisma.reviewHelpful.findUnique.mockResolvedValue(null)           // chưa vote
    mockPrisma.reviewHelpful.create.mockResolvedValue({})

    const res = await request(app)
      .post('/api/reviews/review-1/helpful')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.helpful).toBe(true)
  })

  it('200 - bỏ helpful (đã vote rồi)', async () => {
    mockPrisma.review.findUnique
      .mockResolvedValueOnce({ id: 'review-1', status: 'APPROVED' })
      .mockResolvedValueOnce({ _count: { helpful: 0 } })
    mockPrisma.reviewHelpful.findUnique.mockResolvedValue({ userId: 'user-1', reviewId: 'review-1' })
    mockPrisma.reviewHelpful.delete.mockResolvedValue({})

    const res = await request(app)
      .post('/api/reviews/review-1/helpful')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.helpful).toBe(false)
  })

  it('404 - đánh giá không tồn tại', async () => {
    mockPrisma.review.findUnique.mockResolvedValue(null)
    mockPrisma.reviewHelpful.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/reviews/not-found/helpful')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(404)
  })
})

// ─── Admin: GET /api/admin/reviews ───────────────────────────────────────────

describe('GET /api/admin/reviews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - admin lấy tất cả đánh giá', async () => {
    mockPrisma.review.findMany.mockResolvedValue([BASE_REVIEW])
    mockPrisma.review.count.mockResolvedValue(1)

    const res = await request(app).get('/api/admin/reviews').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.reviews).toHaveLength(1)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/admin/reviews')
    expect(res.status).toBe(401)
  })
})

// ─── Admin: POST /api/admin/reviews/:id/reply ─────────────────────────────────

describe('POST /api/admin/reviews/:id/reply', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - admin phản hồi đánh giá', async () => {
    mockPrisma.review.update.mockResolvedValue({ id: 'review-1', replyContent: 'Cảm ơn bạn!', repliedAt: new Date() })

    const res = await request(app)
      .post('/api/admin/reviews/review-1/reply')
      .set('Authorization', ADMIN_TOKEN)
      .send({ content: 'Cảm ơn bạn!' })

    expect(res.status).toBe(200)
  })

  it('400 - thiếu content', async () => {
    const res = await request(app)
      .post('/api/admin/reviews/review-1/reply')
      .set('Authorization', ADMIN_TOKEN)
      .send({})

    expect(res.status).toBe(400)
  })

  it('403 - CUSTOMER không có quyền', async () => {
    const res = await request(app)
      .post('/api/admin/reviews/review-1/reply')
      .set('Authorization', USER_TOKEN)
      .send({ content: 'Test' })

    expect(res.status).toBe(403)
  })
})

// ─── Admin: DELETE /api/admin/reviews/:id ─────────────────────────────────────

describe('DELETE /api/admin/reviews/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('204 - admin xóa đánh giá', async () => {
    mockPrisma.review.findUnique.mockResolvedValue({ ...BASE_REVIEW, photos: [] })
    mockPrisma.review.delete.mockResolvedValue({})

    const res = await request(app)
      .delete('/api/admin/reviews/review-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(204)
  })

  it('404 - đánh giá không tồn tại', async () => {
    mockPrisma.review.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/admin/reviews/not-found')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(404)
  })
})
