import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  blogPost: {
    findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(),
    create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
  },
  blogCategory: {
    findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(),
    create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  },
  blogTag: {
    findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  },
  blogPostTag: { deleteMany: vi.fn(), createMany: vi.fn() },
  blogPostProduct: { deleteMany: vi.fn(), createMany: vi.fn() },
  blogRelatedPost: { deleteMany: vi.fn(), createMany: vi.fn() },
  blogPostFaq: { deleteMany: vi.fn(), createMany: vi.fn() },
  product: { findMany: vi.fn(), count: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))
vi.mock('../config/cloudinary', () => ({
  uploadEntityImage: vi.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/mobivexa-test/image/upload/x.jpg', publicId: 'blog/covers/x' }),
  destroyImage: vi.fn().mockResolvedValue(undefined),
}))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'
import { uploadEntityImage, destroyImage } from '../config/cloudinary'
import { blogSearchLimiter, authLimiter, couponPreviewLimiter } from '../middlewares/rate_limit.middleware'
import { Prisma } from '../generated/prisma/client'
import { htmlToText, sanitizeBlogHtml } from '../utils/blog_html'

const app = createApp()

const ADMIN_TOKEN    = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`
const STAFF_TOKEN     = `Bearer ${signAccessToken({ userId: 'staff-1', email: 'staff@test.com', role: 'STAFF' })}`
const CUSTOMER_TOKEN = `Bearer ${signAccessToken({ userId: 'user-1', email: 'user@test.com', role: 'CUSTOMER' })}`

const p2002 = () => new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'test' })
const p2003 = () => new Prisma.PrismaClientKnownRequestError('FK constraint', { code: 'P2003', clientVersion: 'test' })
const p2034 = () => new Prisma.PrismaClientKnownRequestError('Serialization conflict', { code: 'P2034', clientVersion: 'test' })
const p2025 = () => new Prisma.PrismaClientKnownRequestError('Record changed', { code: 'P2025', clientVersion: 'test' })

const mockNoDue = () => mockPrisma.$executeRaw.mockResolvedValueOnce(0)

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function scalarPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    title: 'Bài đủ điều kiện',
    slug: 'bai-du-dieu-kien',
    excerpt: null,
    contentHtml: '<p>Nội dung có chữ</p>',
    coverImageUrl: 'https://res.cloudinary.com/mobivexa-test/image/upload/cover.jpg',
    coverImagePublicId: 'blog/covers/cover',
    categoryId: 'cat-1',
    contentType: 'REVIEW',
    status: 'DRAFT',
    scheduledAt: null,
    publishedAt: null,
    authorId: 'admin-1',
    authorDisplayName: 'Admin Test',
    readingTimeMinutes: 3,
    isReadingTimeManual: false,
    seoTitle: null,
    seoDescription: null,
    seoKeywords: null,
    canonicalUrl: null,
    viewCount: 0,
    updatedById: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }
}

function adminDetailPost(overrides: Record<string, unknown> = {}) {
  return {
    ...scalarPost(),
    category: { id: 'cat-1', name: 'Đánh giá', slug: 'danh-gia' },
    author: { id: 'admin-1', fullName: 'Admin Test' },
    updatedBy: { id: 'admin-1', fullName: 'Admin Test' },
    tags: [],
    products: [],
    relatedPosts: [],
    faqs: [],
    ...overrides,
  }
}

function publicDetailPost(overrides: Record<string, unknown> = {}) {
  return {
    ...scalarPost({ status: 'PUBLISHED', publishedAt: new Date() }),
    category: { id: 'cat-1', name: 'Đánh giá', slug: 'danh-gia', isActive: true, parent: null },
    tags: [],
    faqs: [],
    relatedPosts: [],
    products: [],
    ...overrides,
  }
}

function postCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-x',
    title: 'Bài X',
    slug: 'bai-x',
    excerpt: null,
    coverImageUrl: 'https://res.cloudinary.com/mobivexa-test/image/upload/x.jpg',
    contentType: 'REVIEW',
    authorDisplayName: 'Đội ngũ Mobivexa',
    publishedAt: new Date(),
    readingTimeMinutes: 3,
    viewCount: 0,
    category: { id: 'cat-1', name: 'Đánh giá', slug: 'danh-gia', isActive: true },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.$transaction.mockImplementation((ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : (ops as (tx: unknown) => unknown)(mockPrisma),
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Vòng đời bài viết (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/blog/posts — tạo bài (TC-blog-001..005, 027)', () => {
  it('TC-blog-001 — 201, tạo bài chỉ với title, slug tự sinh, status DRAFT', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce(null) // slug chưa tồn tại
    mockPrisma.user.findUnique.mockResolvedValueOnce({ fullName: 'Admin Test' })
    mockPrisma.blogPost.create.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(adminDetailPost({ ...data, status: 'DRAFT' })),
    )

    const res = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: 'So sánh iPhone 17' })

    expect(res.status).toBe(201)
    expect(res.body.post.status).toBe('DRAFT')
    expect(res.body.post.slug).toBe('so-sanh-iphone-17')
  })

  it('TC-blog-002 — 201, lưu nháp chỉ title, mọi field khác trống không báo lỗi', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ fullName: 'Admin Test' })
    mockPrisma.blogPost.create.mockResolvedValueOnce(adminDetailPost())

    const res = await request(app)
      .post('/api/admin/blog/posts')
      .set('Authorization', ADMIN_TOKEN)
      .send({ title: 'Bài nháp', excerpt: '', contentHtml: '', categoryId: null })

    expect(res.status).toBe(201)
  })

  it('TC-blog-003 — 409 E-blog-001, slug trùng bài đang sống', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'other-post' })

    const res = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: 'X', slug: 'abc' })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/Slug/)
    expect(mockPrisma.blogPost.create).not.toHaveBeenCalled()
  })

  it('TC-blog-004 — 409, slug trùng slug của bài ĐÃ XOÁ MỀM (BR-blog-002)', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'deleted-post' })

    const res = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: 'X', slug: 'abc' })

    expect(res.status).toBe(409)
  })

  it('TC-blog-005 — slug tự sinh KHÔNG trùng slug đã dùng bởi bài xoá mềm, tự thêm hậu tố -1', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'deleted-post' }).mockResolvedValueOnce(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ fullName: 'Admin Test' })
    mockPrisma.blogPost.create.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) => Promise.resolve(adminDetailPost({ ...data })))

    const res = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: 'Abc' })

    expect(res.status).toBe(201)
    expect(res.body.post.slug).toBe('abc-1')
  })

  it('RVW-014 — tiêu đề không có ký tự Latin (chỉ ký tự đặc biệt) → slug fallback an toàn, KHÔNG rỗng/"-1"', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce(null) // 'bai-viet' chưa tồn tại
    mockPrisma.user.findUnique.mockResolvedValueOnce({ fullName: 'Admin Test' })
    mockPrisma.blogPost.create.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) => Promise.resolve(adminDetailPost({ ...data })))

    const res = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: '？？？' })

    expect(res.status).toBe(201)
    expect(res.body.post.slug).toBe('bai-viet')
    expect(res.body.post.slug).not.toBe('')
    expect(res.body.post.slug).not.toBe('-1')
  })

  it('TC-blog-027 — 2 request tạo bài cùng slug tường minh song song: 1 thắng 201, 1 nhận 409 (P2002)', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Admin Test' })
    mockPrisma.blogPost.create.mockResolvedValueOnce(adminDetailPost({ slug: 'trung' })).mockRejectedValueOnce(p2002())

    const res1 = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: 'X', slug: 'trung' })
    const res2 = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: 'Y', slug: 'trung' })

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(409)
  })

  it('TC-blog-039 — 400 E-blog-012, contentType không thuộc 14 giá trị (chặn ở validator, không chạm DB)', async () => {
    const res = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: 'X', contentType: 'KHONG_TON_TAI' })

    expect(res.status).toBe(400)
    expect(mockPrisma.blogPost.findUnique).not.toHaveBeenCalled()
  })
})

describe('PUT /api/admin/blog/posts/:id — sửa bài (TC-blog-006, 024, 025, 026, 049)', () => {
  it('TC-blog-006 — 200, sửa field ở bài PUBLISHED, KHÔNG đổi status', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'PUBLISHED', publishedAt: new Date() }))
    mockPrisma.blogPost.update.mockResolvedValueOnce(adminDetailPost({ status: 'PUBLISHED', excerpt: 'mới' }))

    const res = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ excerpt: 'mới' })

    expect(res.status).toBe(200)
    expect(res.body.post.status).toBe('PUBLISHED')
    expect(res.body.post.excerpt).toBe('mới')
  })

  it('TC-blog-024 — last-write-wins: 2 PUT liên tiếp, kết quả cuối thắng, không lỗi/lock', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValue(scalarPost())
    mockPrisma.blogPost.update.mockResolvedValueOnce(adminDetailPost({ excerpt: 'A' })).mockResolvedValueOnce(adminDetailPost({ excerpt: 'B' }))

    const res1 = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ excerpt: 'A' })
    const res2 = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ excerpt: 'B' })

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(res2.body.post.excerpt).toBe('B')
  })

  it('TC-blog-025 — 200, đổi categoryId của bài PUBLISHED, slug KHÔNG đổi', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'PUBLISHED', publishedAt: new Date() }))
    mockPrisma.blogCategory.findUnique.mockResolvedValueOnce({ id: 'cat-2' })
    mockPrisma.blogPost.update.mockResolvedValueOnce(adminDetailPost({ status: 'PUBLISHED', categoryId: 'cat-2', slug: 'bai-du-dieu-kien' }))

    const res = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ categoryId: 'cat-2' })

    expect(res.status).toBe(200)
    expect(res.body.post.slug).toBe('bai-du-dieu-kien')
  })

  it('TC-blog-026 — 200, STAFF sửa bài do ADMIN tạo (BR-blog-014), updatedById = STAFF', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ authorId: 'admin-A' }))
    mockPrisma.blogPost.update.mockImplementationOnce(({ data }: { data: { updatedBy?: { connect: { id: string } } } }) =>
      Promise.resolve(adminDetailPost({ author: { id: 'admin-A', fullName: 'Admin A' }, updatedBy: { id: data.updatedBy?.connect.id, fullName: 'Staff Test' } })),
    )

    const res = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', STAFF_TOKEN).send({ excerpt: 'sửa bởi staff' })

    expect(res.status).toBe(200)
    expect(res.body.post.updatedBy.id).toBe('staff-1')
    expect(res.body.post.author.id).toBe('admin-A')
  })

  it('TC-blog-049 — 400 E-blog-010, gắn chính bài đang sửa làm bài viết liên quan', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ id: 'post-1' }))

    const res = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ relatedPostIds: ['post-1'] })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/chính nó/)
  })

  it('404 — sửa bài không tồn tại/đã xoá mềm (E-blog-004)', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(null)

    const res = await request(app).put('/api/admin/blog/posts/khong-ton-tai').set('Authorization', ADMIN_TOKEN).send({ excerpt: 'x' })

    expect(res.status).toBe(404)
  })

  it('409 — trạng thái đổi đồng thời thì không ghi bản cập nhật từ snapshot cũ', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'DRAFT' }))
    mockPrisma.blogPost.update.mockRejectedValueOnce(p2025())

    const res = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ categoryId: null })

    expect(res.status).toBe(409)
    expect(mockPrisma.blogPost.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'post-1', status: 'DRAFT', deletedAt: null },
    }))
  })
})

describe('PATCH /api/admin/blog/posts/:id/status — đổi trạng thái (TC-blog-009..021)', () => {
  it('TC-blog-009 — 200, xuất bản ngay khi đủ điều kiện, publishedAt = now', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'DRAFT' }))
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 })
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'post-1', status: 'PUBLISHED', scheduledAt: null, publishedAt: new Date(), updatedAt: new Date() })

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'PUBLISHED' })

    expect(res.status).toBe(200)
    expect(res.body.post.status).toBe('PUBLISHED')
    expect(res.body.post.publishedAt).not.toBeNull()
    expect(mockPrisma.blogPost.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ updatedById: 'admin-1' }),
    }))
  })

  it('TC-blog-010 — 400 E-blog-002, thiếu ảnh đại diện, liệt kê đúng field thiếu', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'DRAFT', coverImageUrl: null }))

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'PUBLISHED' })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Ảnh đại diện')
    expect(res.body.message).not.toContain('Danh mục')
    expect(mockPrisma.blogPost.updateMany).not.toHaveBeenCalled()
  })

  it('TC-blog-010b — 400, thiếu ĐỒNG THỜI category + cover, liệt kê đủ cả 2 trong 1 lần', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'DRAFT', coverImageUrl: null, categoryId: null }))

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'PUBLISHED' })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Danh mục')
    expect(res.body.message).toContain('Ảnh đại diện')
  })

  it('TC-blog-011 — 200, hẹn lịch hợp lệ, status=SCHEDULED', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'DRAFT' }))
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 })
    const future = new Date(Date.now() + 2 * 86_400_000).toISOString()
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'post-1', status: 'SCHEDULED', scheduledAt: new Date(future), publishedAt: null, updatedAt: new Date() })

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'SCHEDULED', scheduledAt: future })

    expect(res.status).toBe(200)
    expect(res.body.post.status).toBe('SCHEDULED')
  })

  it('TC-blog-012 — 400 E-blog-003, hẹn lịch quá khứ (hôm qua)', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'DRAFT' }))
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'SCHEDULED', scheduledAt: yesterday })

    expect(res.status).toBe(400)
    expect(mockPrisma.blogPost.updateMany).not.toHaveBeenCalled()
  })

  it('TC-blog-013 — 200, scheduledAt = now-30s (trong dung sai 60s BR-blog-028)', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'DRAFT' }))
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 })
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'post-1', status: 'SCHEDULED', scheduledAt: new Date(), publishedAt: null, updatedAt: new Date() })
    const nearNow = new Date(Date.now() - 30_000).toISOString()

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'SCHEDULED', scheduledAt: nearNow })

    expect(res.status).toBe(200)
  })

  it('TC-blog-013b — 400 E-blog-003, scheduledAt = now-90s (ngoài dung sai)', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'DRAFT' }))
    const outOfTolerance = new Date(Date.now() - 90_000).toISOString()

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'SCHEDULED', scheduledAt: outOfTolerance })

    expect(res.status).toBe(400)
  })

  it('TC-blog-014 — 200, huỷ lịch trước giờ (SCHEDULED→DRAFT), scheduledAt=null', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'SCHEDULED', scheduledAt: new Date(Date.now() + 86_400_000) }))
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 })
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'post-1', status: 'DRAFT', scheduledAt: null, publishedAt: null, updatedAt: new Date() })

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'DRAFT' })

    expect(res.status).toBe(200)
    expect(res.body.post.scheduledAt).toBeNull()
  })

  it('TC-blog-017 — 200, gỡ bài PUBLISHED về DRAFT', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'PUBLISHED', publishedAt: new Date() }))
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 })
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'post-1', status: 'DRAFT', scheduledAt: null, publishedAt: new Date(), updatedAt: new Date() })

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'DRAFT' })

    expect(res.status).toBe(200)
    expect(res.body.post.status).toBe('DRAFT')
  })

  it('TC-blog-018 — 200, lưu trữ bài PUBLISHED (ARCHIVED)', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'PUBLISHED', publishedAt: new Date() }))
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 })
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'post-1', status: 'ARCHIVED', scheduledAt: null, publishedAt: new Date(), updatedAt: new Date() })

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'ARCHIVED' })

    expect(res.status).toBe(200)
    expect(res.body.post.status).toBe('ARCHIVED')
  })

  it('TC-blog-019 — 200, xuất bản lại bài ARCHIVED, publishedAt KHÔNG đổi (giữ lần công khai đầu tiên)', async () => {
    const firstPublishedAt = new Date('2026-01-01T00:00:00.000Z')
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'ARCHIVED', publishedAt: firstPublishedAt }))
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 })
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'post-1', status: 'PUBLISHED', scheduledAt: null, publishedAt: firstPublishedAt, updatedAt: new Date() })

    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'PUBLISHED' })

    expect(res.status).toBe(200)
    const updateCall = mockPrisma.blogPost.updateMany.mock.calls[0][0]
    expect(updateCall.data.publishedAt).toEqual(firstPublishedAt)
  })

  it.each([
    ['DRAFT', 'ARCHIVED'],
    ['SCHEDULED', 'PUBLISHED'],
    ['PUBLISHED', 'SCHEDULED'],
    ['ARCHIVED', 'SCHEDULED'],
    ['DRAFT', 'DRAFT'],
    ['PUBLISHED', 'PUBLISHED'],
    ['ARCHIVED', 'ARCHIVED'],
  ])('TC-blog-020 — 409, chuyển trạng thái không hợp lệ %s → %s', async (from, to) => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: from }))

    const res = await request(app)
      .patch('/api/admin/blog/posts/post-1/status')
      .set('Authorization', ADMIN_TOKEN)
      .send({ status: to, ...(to === 'SCHEDULED' ? { scheduledAt: new Date(Date.now() + 86_400_000).toISOString() } : {}) })

    expect(res.status).toBe(409)
    expect(mockPrisma.blogPost.updateMany).not.toHaveBeenCalled()
  })

  it('TC-blog-021 — 409, 2 request đổi trạng thái đồng thời: request sau bị updateMany count=0', async () => {
    mockPrisma.blogPost.findMany.mockResolvedValue([]) // mọi lần gọi publishDueScheduledPosts trong test này
    mockPrisma.blogPost.findFirst.mockResolvedValue(scalarPost({ status: 'DRAFT' }))
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'post-1', status: 'PUBLISHED', scheduledAt: null, publishedAt: new Date(), updatedAt: new Date() })

    const res1 = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'PUBLISHED' })
    const res2 = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'PUBLISHED' })

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(409)
  })

  it('400 — trạng thái không hợp lệ (sai enum, validator chặn trước khi chạm DB)', async () => {
    const res = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', ADMIN_TOKEN).send({ status: 'KHONG_TON_TAI' })
    expect(res.status).toBe(400)
    expect(mockPrisma.blogPost.findFirst).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/admin/blog/posts/:id — xoá mềm (TC-blog-022, 023)', () => {
  it('TC-blog-022 — 200, xoá mềm bài viết', async () => {
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 })

    const res = await request(app).delete('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/thành công/)
  })

  it('404 — xoá bài không tồn tại / xoá lần hai', async () => {
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await request(app).delete('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(404)
  })

  it('TC-blog-023 — 404 E-blog-013, khách vào URL bài đã xoá mềm', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(null)

    const res = await request(app).get('/api/blog/posts/bai-da-xoa')

    expect(res.status).toBe(404)
  })

  it('TC-blog-068 — 404, mở slug bài DRAFT trực tiếp (không qua preview)', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(null) // PUBLIC_POST_WHERE loại DRAFT

    const res = await request(app).get('/api/blog/posts/bai-nhap')

    expect(res.status).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Taxonomy: Category / Tag / Content Type
// ═══════════════════════════════════════════════════════════════════════════════

describe('Admin — Category bài viết (TC-blog-028..034)', () => {
  it('TC-blog-028 — 201, tạo category mới, slug tự sinh', async () => {
    mockPrisma.blogCategory.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    mockPrisma.blogCategory.create.mockResolvedValueOnce({ id: 'cat-new', name: 'Khuyến mãi', slug: 'khuyen-mai' })

    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Khuyến mãi' })

    expect(res.status).toBe(201)
    expect(res.body.category.slug).toBe('khuyen-mai')
  })

  it('TC-blog-029 — 400, tạo category con cấp 3 (cha đã có cha)', async () => {
    mockPrisma.blogCategory.findUnique
      .mockResolvedValueOnce(null) // tên chưa trùng
      .mockResolvedValueOnce(null) // slug chưa trùng
      .mockResolvedValueOnce({ id: 'cat-b', parentId: 'cat-a' }) // parent lookup trong transaction

    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Danh mục C', parentId: 'cat-b' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/tối đa 2 cấp/)
  })

  it('TC-blog-030 — 400, gán category làm cha của chính nó', async () => {
    mockPrisma.blogCategory.findUnique.mockResolvedValueOnce({ id: 'cat-x', name: 'X', parentId: null })

    const res = await request(app).put('/api/admin/blog/categories/cat-x').set('Authorization', ADMIN_TOKEN).send({ parentId: 'cat-x' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/chính nó/)
  })

  it('TC-blog-031 — 409 E-blog-007, xoá category còn bài tham chiếu, message có số lượng', async () => {
    mockPrisma.blogCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1', name: 'Khuyến mãi' })
    mockPrisma.blogPost.count.mockResolvedValueOnce(3)
    mockPrisma.blogCategory.count.mockResolvedValueOnce(0)

    const res = await request(app).delete('/api/admin/blog/categories/cat-1').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(409)
    expect(res.body.message).toContain('3')
  })

  it('TC-blog-032 — 409, xoá category còn category con', async () => {
    mockPrisma.blogCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' })
    mockPrisma.blogPost.count.mockResolvedValueOnce(0)
    mockPrisma.blogCategory.count.mockResolvedValueOnce(2)

    const res = await request(app).delete('/api/admin/blog/categories/cat-1').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/danh mục con/)
  })

  it('TC-blog-033 — 409 (không phải 500), race P2003 khi xoá category (QA-A-002)', async () => {
    mockPrisma.blogCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' })
    mockPrisma.blogPost.count.mockResolvedValueOnce(0)
    mockPrisma.blogCategory.count.mockResolvedValueOnce(0)
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 0 })
    mockPrisma.blogCategory.delete.mockRejectedValueOnce(p2003())

    const res = await request(app).delete('/api/admin/blog/categories/cat-1').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/vừa được gán/)
  })

  it('TC-blog-034 — 409 E-blog-008, tên category trùng', async () => {
    mockPrisma.blogCategory.findUnique.mockResolvedValueOnce({ id: 'existing' })

    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Khuyến mãi' })

    expect(res.status).toBe(409)
  })

  it('RVW-004a — 409, race P2002 khi tạo category (2 request cùng tên/slug lọt qua kiểm tra trước)', async () => {
    mockPrisma.blogCategory.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    mockPrisma.blogCategory.create.mockRejectedValueOnce(p2002())

    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Danh mục mới' })

    expect(res.status).toBe(409)
  })

  it('RVW-004b — 400, race P2003 khi tạo category (cha vừa bị xoá giữa lúc kiểm và lúc ghi)', async () => {
    mockPrisma.blogCategory.findUnique
      .mockResolvedValueOnce(null) // tên chưa trùng
      .mockResolvedValueOnce(null) // slug chưa trùng
      .mockResolvedValueOnce({ id: 'cat-p', parentId: null }) // parent hợp lệ trong transaction
    mockPrisma.blogCategory.create.mockRejectedValueOnce(p2003())

    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Danh mục con', parentId: 'cat-p' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cha không tồn tại/)
  })

  it('RVW-004c — 409, race P2002 khi sửa category', async () => {
    mockPrisma.blogCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1', name: 'Old' }).mockResolvedValueOnce(null)
    mockPrisma.blogCategory.update.mockRejectedValueOnce(p2002())

    const res = await request(app).put('/api/admin/blog/categories/cat-1').set('Authorization', ADMIN_TOKEN).send({ name: 'New Name' })

    expect(res.status).toBe(409)
  })

  it('409 — transaction Serializable chặn race tạo cây category cấp 3', async () => {
    mockPrisma.blogCategory.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    mockPrisma.$transaction.mockRejectedValueOnce(p2034())

    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Danh mục con', parentId: 'cat-parent' })

    expect(res.status).toBe(409)
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
  })
})

describe('Admin — Tag bài viết (TC-blog-035..037)', () => {
  it('TC-blog-035 — 200, xoá tag đang gắn N bài — không lỗi (cascade DB)', async () => {
    mockPrisma.blogTag.findUnique.mockResolvedValueOnce({ id: 'tag-1' })

    const res = await request(app).delete('/api/admin/blog/tags/tag-1').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })

  it('TC-blog-036 — autocomplete tag theo search trả đúng số khớp', async () => {
    mockPrisma.blogTag.findMany.mockResolvedValueOnce([
      { id: 't1', name: 'iPhone', slug: 'iphone', _count: { posts: 1 } },
      { id: 't2', name: 'iOS', slug: 'ios', _count: { posts: 1 } },
    ])

    const res = await request(app).get('/api/admin/blog/tags?search=i').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.tags.length).toBe(2)
  })

  it('TC-blog-037 — 409 E-blog-008, tên tag trùng', async () => {
    mockPrisma.blogTag.findUnique.mockResolvedValueOnce({ id: 'existing' })

    const res = await request(app).post('/api/admin/blog/tags').set('Authorization', ADMIN_TOKEN).send({ name: '5G' })

    expect(res.status).toBe(409)
  })

  it('RVW-004d — 409, race P2002 khi tạo tag', async () => {
    mockPrisma.blogTag.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    mockPrisma.blogTag.create.mockRejectedValueOnce(p2002())

    const res = await request(app).post('/api/admin/blog/tags').set('Authorization', ADMIN_TOKEN).send({ name: 'Tag mới' })

    expect(res.status).toBe(409)
  })

  it('RVW-004e — 409, race P2002 khi sửa tag', async () => {
    mockPrisma.blogTag.findUnique.mockResolvedValueOnce({ id: 'tag-1', name: 'Old' }).mockResolvedValueOnce(null)
    mockPrisma.blogTag.update.mockRejectedValueOnce(p2002())

    const res = await request(app).put('/api/admin/blog/tags/tag-1').set('Authorization', ADMIN_TOKEN).send({ name: 'New Tag' })

    expect(res.status).toBe(409)
  })
})

describe('RVW-005 — validator category/tag kiểm kiểu mọi field (400, không 500)', () => {
  it('category: slug sai kiểu (số) → 400', async () => {
    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Danh mục X', slug: 5 })
    expect(res.status).toBe(400)
  })

  it('category: description sai kiểu (số) → 400', async () => {
    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Danh mục X', description: 5 })
    expect(res.status).toBe(400)
  })

  it('category: parentId sai kiểu (số) → 400', async () => {
    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Danh mục X', parentId: 5 })
    expect(res.status).toBe(400)
  })

  it('category: sortOrder không phải số nguyên ("abc") → 400', async () => {
    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Danh mục X', sortOrder: 'abc' })
    expect(res.status).toBe(400)
  })

  it('category: sortOrder số thực (1.5) → 400', async () => {
    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Danh mục X', sortOrder: 1.5 })
    expect(res.status).toBe(400)
  })

  it('category: isActive sai kiểu (số) → 400', async () => {
    const res = await request(app).post('/api/admin/blog/categories').set('Authorization', ADMIN_TOKEN).send({ name: 'Danh mục X', isActive: 5 })
    expect(res.status).toBe(400)
  })

  it('tag: slug sai kiểu (số) → 400', async () => {
    const res = await request(app).post('/api/admin/blog/tags').set('Authorization', ADMIN_TOKEN).send({ name: 'Tag X', slug: 5 })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/admin/blog/posts — RVW-001 query key lặp', () => {
  it('categoryId/authorId lặp key không 500, lấy phần tử đầu', async () => {
    mockNoDue()
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([])
    mockPrisma.blogPost.count.mockResolvedValueOnce(0)

    const res = await request(app).get('/api/admin/blog/posts?categoryId=c1&categoryId=c2&authorId=u1&authorId=u2').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    const listCall = mockPrisma.blogPost.findMany.mock.calls[0][0]
    expect(listCall.where.categoryId).toBe('c1')
    expect(listCall.where.authorId).toBe('u1')
  })
})

describe('GET /api/admin/blog/tags — RVW-001 search lặp key', () => {
  it('search lặp key không 500 (không rơi PrismaClientValidationError)', async () => {
    mockPrisma.blogTag.findMany.mockResolvedValueOnce([])

    const res = await request(app).get('/api/admin/blog/tags?search=a&search=b').set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    const call = mockPrisma.blogTag.findMany.mock.calls[0][0]
    expect(call.where.name.contains).toBe('a')
  })
})

describe('GET /api/blog/content-types (TC-blog-038)', () => {
  it('TC-blog-038 — 200, đúng 14 giá trị + nhãn theo DEC-blog-01', async () => {
    const res = await request(app).get('/api/blog/content-types')

    expect(res.status).toBe(200)
    expect(res.body.contentTypes.length).toBe(14)
    expect(res.body.contentTypes.find((c: { value: string }) => c.value === 'COMPARISON')).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SEO metadata, ảnh, liên quan, FAQ
// ═══════════════════════════════════════════════════════════════════════════════

describe('SEO tính toán (TC-blog-041..044)', () => {
  it('TC-blog-041 — SEO Title rỗng → fallback title bài', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(publicDetailPost({ title: 'Tiêu đề gốc', seoTitle: null }))

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.status).toBe(200)
    expect(res.body.post.seo.title).toBe('Tiêu đề gốc')
  })

  it('TC-blog-042 — SEO Description + excerpt rỗng → cắt 160 ký tự từ content, không HTML', async () => {
    const longText = 'Từ '.repeat(100).trim()
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(publicDetailPost({ seoDescription: null, excerpt: null, contentHtml: `<p>${longText}</p>` }))

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.status).toBe(200)
    expect(res.body.post.seo.description.length).toBeLessThanOrEqual(160)
    expect(res.body.post.seo.description).not.toContain('<')
  })

  it('RVW-003 — SEO description fallback: entity đã giải mã, không dính chữ giữa các đoạn', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(
      publicDetailPost({ seoDescription: null, excerpt: null, contentHtml: '<h2>Cấu hình &amp; camera</h2><p>Chi tiết bên dưới.</p>' }),
    )

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.body.post.seo.description).toContain('Cấu hình & camera Chi tiết bên dưới.')
    expect(res.body.post.seo.description).not.toContain('&amp;')
    expect(res.body.post.seo.description).not.toContain('camera.Chi') // không dính chữ giữa 2 đoạn
  })

  it('TC-blog-043 — Canonical rỗng → mặc định SITE_URL/tin-tuc/{slug}', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(publicDetailPost({ slug: 'bai-du-dieu-kien', canonicalUrl: null }))

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.body.post.seo.canonicalUrl).toBe('http://localhost:5001/tin-tuc/bai-du-dieu-kien')
  })

  it('TC-blog-044 — Canonical override (cross-post) dùng đúng giá trị nhập', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(publicDetailPost({ canonicalUrl: 'https://nguon.vn/bai-goc' }))

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.body.post.seo.canonicalUrl).toBe('https://nguon.vn/bai-goc')
  })
})

describe('Ảnh đại diện & nội dung (TC-blog-045..048)', () => {
  it('TC-blog-045 — 400, upload cover > 5MB (MulterError LIMIT_FILE_SIZE)', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 1)
    const res = await request(app)
      .put('/api/admin/blog/posts/post-1/cover')
      .set('Authorization', ADMIN_TOKEN)
      .attach('image', big, { filename: 'big.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/dung lượng/)
  }, 15_000)

  it('TC-blog-046 — 400, upload cover sai định dạng (.gif)', async () => {
    const res = await request(app)
      .put('/api/admin/blog/posts/post-1/cover')
      .set('Authorization', ADMIN_TOKEN)
      .attach('image', Buffer.from('gif89a'), { filename: 'x.gif', contentType: 'image/gif' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/JPG, PNG, WebP/)
  })

  it('TC-blog-047 — lỗi Cloudinary giữa chừng: trả lỗi, KHÔNG destroy ảnh cũ', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ coverImagePublicId: 'blog/covers/old' }))
    vi.mocked(uploadEntityImage).mockRejectedValueOnce(new Error('cloudinary down'))

    const res = await request(app)
      .put('/api/admin/blog/posts/post-1/cover')
      .set('Authorization', ADMIN_TOKEN)
      .attach('image', Buffer.from('fakejpg'), { filename: 'ok.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(destroyImage).not.toHaveBeenCalled()
    expect(mockPrisma.blogPost.update).not.toHaveBeenCalled()
  })

  it('TC-blog-048 — 201, ảnh nội dung upload thành công trả {url,publicId}', async () => {
    const res = await request(app)
      .post('/api/admin/blog/images')
      .set('Authorization', ADMIN_TOKEN)
      .attach('image', Buffer.from('fakejpg'), { filename: 'ok.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(201)
    expect(res.body.url).toBeDefined()
    expect(res.body.publicId).toBeDefined()
  })

  it('409 — không xoá cover nếu bài được xuất bản đồng thời', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ status: 'DRAFT' }))
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await request(app).delete('/api/admin/blog/posts/post-1/cover').set('Authorization', STAFF_TOKEN)

    expect(res.status).toBe(409)
    expect(mockPrisma.blogPost.updateMany).toHaveBeenCalledWith({
      where: { id: 'post-1', deletedAt: null, status: { in: ['DRAFT', 'ARCHIVED'] } },
      data: { coverImageUrl: null, coverImagePublicId: null, updatedById: 'staff-1' },
    })
    expect(destroyImage).not.toHaveBeenCalled()
  })

  it('upload cover ghi nhận đúng người cập nhật', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost())
    mockPrisma.blogPost.update.mockResolvedValueOnce({ id: 'post-1', coverImageUrl: 'new', updatedAt: new Date() })

    const res = await request(app)
      .put('/api/admin/blog/posts/post-1/cover')
      .set('Authorization', STAFF_TOKEN)
      .attach('image', Buffer.from('fakejpg'), { filename: 'ok.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(200)
    expect(mockPrisma.blogPost.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ updatedById: 'staff-1' }),
    }))
  })
})

describe('Bài viết liên quan & sản phẩm liên quan (TC-blog-050, 052..055)', () => {
  it('TC-blog-050 — relatedPosts trả đúng thứ tự curated (sortOrder), không theo thứ tự DB trả về', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(
      publicDetailPost({ categoryId: 'cat-1', relatedPosts: [{ relatedPostId: 'B' }, { relatedPostId: 'A' }, { relatedPostId: 'C' }] }),
    )
    // findMany trả về THỨ TỰ XÁO TRỘN để chứng minh service tự sắp lại theo curated order
    mockPrisma.blogPost.findMany
      .mockResolvedValueOnce([postCard({ id: 'C', slug: 'c' }), postCard({ id: 'A', slug: 'a' }), postCard({ id: 'B', slug: 'b' })])
      .mockResolvedValueOnce([]) // đã đủ 3, không cần auto bổ sung thêm (nhưng vẫn <6 nên vẫn gọi) — không có thêm bài nào

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.status).toBe(200)
    expect(res.body.post.relatedPosts.map((p: { id: string }) => p.id)).toEqual(['B', 'A', 'C'])
  })

  it('TC-blog-052 — bài liên quan đã curate nay chuyển DRAFT → tự lọc bỏ khỏi hiển thị công khai', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(publicDetailPost({ categoryId: 'cat-1', relatedPosts: [{ relatedPostId: 'B' }] }))
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]) // B không còn PUBLISHED nên bị lọc; không có bài khác bổ sung

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.body.post.relatedPosts).toEqual([])
  })

  it('TC-blog-053 — chưa đủ 6 curate → tự bổ sung cùng category cho đủ tối đa 6', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(
      publicDetailPost({ categoryId: 'cat-1', relatedPosts: [{ relatedPostId: 'B' }, { relatedPostId: 'C' }] }),
    )
    mockPrisma.blogPost.findMany
      .mockResolvedValueOnce([postCard({ id: 'B', slug: 'b' }), postCard({ id: 'C', slug: 'c' })])
      .mockResolvedValueOnce([postCard({ id: 'D' }), postCard({ id: 'E' }), postCard({ id: 'F' }), postCard({ id: 'G' })])

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.body.post.relatedPosts.length).toBe(6)
    expect(res.body.post.relatedPosts[0].id).toBe('B')
  })

  it('TC-blog-054 — sản phẩm đang bán xuất hiện trong relatedProducts, dẫn đúng slug PDP', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(
      publicDetailPost({
        categoryId: null,
        products: [
          {
            sortOrder: 0,
            product: {
              id: 'p1', name: 'iPhone 17 Pro Max 256GB', slug: 'iphone-17-pro-max-256gb', isActive: true,
              images: [{ url: 'https://cdn/p1.jpg' }],
              variants: [{ salePrice: new Prisma.Decimal(34990000), originalPrice: new Prisma.Decimal(36990000) }],
            },
          },
        ],
      }),
    )

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.body.post.relatedProducts[0].slug).toBe('iphone-17-pro-max-256gb')
    expect(res.body.post.relatedProducts[0].salePrice).toBe('34990000')
  })

  it('TC-blog-055 — sản phẩm ngừng bán bị ẩn khỏi relatedProducts công khai (liên kết vẫn còn dữ liệu)', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(
      publicDetailPost({
        categoryId: null,
        products: [{ sortOrder: 0, product: { id: 'p1', name: 'X', slug: 'x', isActive: false, images: [], variants: [] } }],
      }),
    )

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.body.post.relatedProducts).toEqual([])
  })

  it('Admin detail — sản phẩm ngừng bán vẫn hiển thị kèm cờ isActive=false (AdminPostDetail)', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(
      adminDetailPost({ products: [{ sortOrder: 0, product: { id: 'p1', name: 'X', slug: 'x', isActive: false, images: [] } }] }),
    )

    const res = await request(app).get('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN)

    expect(res.body.post.products[0].isActive).toBe(false)
  })
})

describe('Validation boundary — tag/product/related/faq (TC-blog-051, 056, 057)', () => {
  it('TC-blog-051 — 400, quá 6 bài viết liên quan', async () => {
    const ids = Array.from({ length: 7 }, (_, i) => `post-${i}`)
    const res = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ relatedPostIds: ids })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Tối đa 6/)
  })

  it('TC-blog-056a — 400, quá 20 tag', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => `tag-${i}`)
    const res = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ tagIds: ids })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Tối đa 20/)
  })

  it('TC-blog-056b — 400, quá 20 sản phẩm liên quan', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => `prod-${i}`)
    const res = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ productIds: ids })
    expect(res.status).toBe(400)
  })

  it('TC-blog-057 — 400 E-blog-011, quá 15 FAQ', async () => {
    const faqs = Array.from({ length: 16 }, (_, i) => ({ question: `Câu ${i}`, answer: `Trả lời ${i}` }))
    const res = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ faqs })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Tối đa 15/)
  })
})

describe('Thời gian đọc (TC-blog-058)', () => {
  it('TC-blog-058a — tạo bài nội dung rất ngắn → readingTimeMinutes tối thiểu 1, không phải 0', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ fullName: 'Admin Test' })
    mockPrisma.blogPost.create.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) => Promise.resolve(adminDetailPost({ ...data })))

    const res = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: 'Bài ngắn', contentHtml: '<p>Vài chữ</p>' })

    expect(res.body.post.readingTimeMinutes).toBeGreaterThanOrEqual(1)
  })

  it('TC-blog-058b — sửa bài, ghi đè readingTimeMinutes thủ công → isReadingTimeManual=true', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ isReadingTimeManual: false }))
    mockPrisma.blogPost.update.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) => Promise.resolve(adminDetailPost({ ...data })))

    const res = await request(app).put('/api/admin/blog/posts/post-1').set('Authorization', ADMIN_TOKEN).send({ readingTimeMinutes: 10 })

    expect(res.body.post.readingTimeMinutes).toBe(10)
    expect(res.body.post.isReadingTimeManual).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Client công khai
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/blog/posts — danh sách công khai (TC-blog-059..062, 070, 015, 016)', () => {
  it('TC-blog-059 — 12 bài/trang khi có ≥13 bài, totalPages=2', async () => {
    mockNoDue()
    mockPrisma.blogPost.findMany.mockResolvedValueOnce(Array.from({ length: 12 }, (_, i) => postCard({ id: `p${i}` })))
    mockPrisma.blogPost.count.mockResolvedValueOnce(13)

    const res = await request(app).get('/api/blog/posts?page=1')

    expect(res.status).toBe(200)
    expect(res.body.posts.length).toBe(12)
    expect(res.body.pagination.totalPages).toBe(2)
  })

  it('TC-blog-060 — lọc theo category gồm cả bài của category con', async () => {
    mockNoDue()
    mockPrisma.blogCategory.findFirst.mockResolvedValueOnce({ id: 'cat-cha', name: 'Cha', slug: 'cha-slug', description: null, parent: null, children: [] })
    mockPrisma.blogCategory.findMany.mockResolvedValueOnce([{ id: 'cat-con' }])
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([postCard(), postCard(), postCard()])
    mockPrisma.blogPost.count.mockResolvedValueOnce(3)

    const res = await request(app).get('/api/blog/posts?category=cha-slug')

    expect(res.status).toBe(200)
    expect(res.body.posts.length).toBe(3)
    expect(res.body.category.slug).toBe('cha-slug')
    // RVW-002: children trả về CHỈ được lọc isActive:true — danh mục con đã tắt không
    // được lộ trong menu/breadcrumb dù bài của nó vẫn hiện (childIds không lọc active).
    const categoryCall = mockPrisma.blogCategory.findFirst.mock.calls[0][0]
    expect(categoryCall.include.children.where).toEqual({ isActive: true })
  })

  it('RVW-001 — query key lặp (?category=a&category=b) không 500, lấy phần tử đầu', async () => {
    mockNoDue()
    mockPrisma.blogCategory.findFirst.mockResolvedValueOnce({ id: 'cat-a', name: 'A', slug: 'a', description: null, parent: null, children: [] })
    mockPrisma.blogCategory.findMany.mockResolvedValueOnce([])
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([])
    mockPrisma.blogPost.count.mockResolvedValueOnce(0)

    const res = await request(app).get('/api/blog/posts?category=a&category=b')

    expect(res.status).not.toBe(500)
    expect(res.status).toBe(200)
    const categoryCall = mockPrisma.blogCategory.findFirst.mock.calls[0][0]
    expect(categoryCall.where.slug).toBe('a')
  })

  it('TC-blog-061 — lọc theo tag', async () => {
    mockNoDue()
    mockPrisma.blogTag.findUnique.mockResolvedValueOnce({ id: 'tag-5g', name: '5G', slug: '5g' })
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([postCard()])
    mockPrisma.blogPost.count.mockResolvedValueOnce(1)

    const res = await request(app).get('/api/blog/posts?tag=5g')

    expect(res.status).toBe(200)
    expect(res.body.tag.slug).toBe('5g')
  })

  it('TC-blog-062 — 404 E-blog-013, category không tồn tại hoặc inactive', async () => {
    mockNoDue()
    mockPrisma.blogCategory.findFirst.mockResolvedValueOnce(null)

    const res = await request(app).get('/api/blog/posts?category=khong-ton-tai')

    expect(res.status).toBe(404)
  })

  it('TC-blog-070 — category rỗng bài → 200, posts:[], total:0 (không lỗi)', async () => {
    mockNoDue()
    mockPrisma.blogCategory.findFirst.mockResolvedValueOnce({ id: 'cat-moi', name: 'Mới', slug: 'moi', description: null, parent: null, children: [] })
    mockPrisma.blogCategory.findMany.mockResolvedValueOnce([])
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([])
    mockPrisma.blogPost.count.mockResolvedValueOnce(0)

    const res = await request(app).get('/api/blog/posts?category=moi')

    expect(res.status).toBe(200)
    expect(res.body.posts).toEqual([])
    expect(res.body.pagination.total).toBe(0)
  })

  it('TC-blog-015 — bài SCHEDULED đã tới giờ tự thăng hạng khi đọc danh sách công khai', async () => {
    mockPrisma.$executeRaw.mockResolvedValueOnce(1)
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([postCard({ id: 'due-1' })])
    mockPrisma.blogPost.count.mockResolvedValueOnce(1)

    const res = await request(app).get('/api/blog/posts')

    expect(res.status).toBe(200)
    expect(res.body.posts.some((p: { id: string }) => p.id === 'due-1')).toBe(true)
    const [sql, now] = mockPrisma.$executeRaw.mock.calls[0]
    expect((sql as TemplateStringsArray).join(' ')).toMatch(/UPDATE blog_posts[\s\S]*"scheduledAt" <=/)
    expect(now).toBeInstanceOf(Date)
  })

  it('TC-blog-016 — publishedAt sau thăng hạng = giờ hẹn, không phải giờ đọc', async () => {
    mockPrisma.$executeRaw.mockResolvedValueOnce(1)
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([])
    mockPrisma.blogPost.count.mockResolvedValueOnce(0)

    await request(app).get('/api/blog/posts')

    const sql = mockPrisma.$executeRaw.mock.calls[0][0] as TemplateStringsArray
    expect(sql.join(' ')).toMatch(/"publishedAt" = COALESCE\("publishedAt", "scheduledAt"\)/)
  })
})

describe('GET /api/blog/search — tìm kiếm (TC-blog-063, 065)', () => {
  it('TC-blog-063 — trả bài khớp title/excerpt/tag, hydrate đúng dữ liệu', async () => {
    mockNoDue()
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'p1', total: 25 }])
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([postCard({ id: 'p1' })])

    const res = await request(app).get('/api/blog/search').query({ q: 'iphone 17', page: 2, limit: 12 })

    expect(res.status).toBe(200)
    expect(res.body.posts.length).toBe(1)
    expect(res.body.q).toBe('iphone 17')
    expect(res.body.pagination.total).toBe(25)
    const [sql, _tsQuery, limit, offset] = mockPrisma.$queryRaw.mock.calls[0]
    expect((sql as TemplateStringsArray).join(' ')).toMatch(/LIMIT[\s\S]*OFFSET[\s\S]*COUNT\(\*\)/)
    expect(limit).toBe(12)
    expect(offset).toBe(12)
    // RVW-011: bước hydrate phải dùng lại PUBLIC_POST_WHERE — bài vừa bị gỡ/xoá giữa
    // câu raw SQL và câu hydrate không được lọt vào kết quả.
    const hydrateCall = mockPrisma.blogPost.findMany.mock.calls[0][0]
    expect(hydrateCall.where.status).toBe('PUBLISHED')
    expect(hydrateCall.where.deletedAt).toBeNull()
  })

  it('TC-blog-065 — q chỉ toàn ký tự đặc biệt → 200 posts:[] (không lỗi, không gọi $queryRaw)', async () => {
    mockNoDue()

    const res = await request(app).get('/api/blog/search').query({ q: '***' })

    expect(res.status).toBe(200)
    expect(res.body.posts).toEqual([])
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('400 — thiếu từ khoá tìm kiếm', async () => {
    const res = await request(app).get('/api/blog/search')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/blog/posts/:slug — chi tiết công khai (TC-blog-066, 069)', () => {
  it('TC-blog-066 — trả đủ field trang chi tiết', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(
      publicDetailPost({ title: 'Bài đầy đủ', coverImageUrl: 'https://cdn/x.jpg', authorDisplayName: 'Đội ngũ Mobivexa', readingTimeMinutes: 5 }),
    )

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.status).toBe(200)
    const post = res.body.post
    expect(post.title).toBe('Bài đầy đủ')
    expect(post.coverImageUrl).toBe('https://cdn/x.jpg')
    expect(post.authorName).toBe('Đội ngũ Mobivexa')
    expect(post.readingTimeMinutes).toBe(5)
    expect(post.category.slug).toBe('danh-gia')
    expect(post.contentHtml).toBeDefined()
  })

  it('TC-blog-069 — không có bài liên quan hợp lệ nào → relatedPosts: [] (ẩn khối, không lỗi)', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(publicDetailPost({ categoryId: null, relatedPosts: [] }))

    const res = await request(app).get('/api/blog/posts/bai-du-dieu-kien')

    expect(res.body.post.relatedPosts).toEqual([])
    // categoryId null + curated rỗng → không query thêm danh sách bài liên quan
    expect(mockPrisma.blogPost.findMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/blog/posts/:slug/view — tăng lượt xem (TC-blog-071)', () => {
  it('TC-blog-071 — 204, tăng viewCount bằng SQL nguyên tử', async () => {
    mockNoDue()
    mockPrisma.$executeRaw.mockResolvedValueOnce(1)

    const res = await request(app).post('/api/blog/posts/bai-du-dieu-kien/view')

    expect(res.status).toBe(204)
  })

  it('404 — tăng lượt xem bài không tồn tại/không công khai', async () => {
    mockNoDue()
    mockPrisma.$executeRaw.mockResolvedValueOnce(0)

    const res = await request(app).post('/api/blog/posts/khong-ton-tai/view')

    expect(res.status).toBe(404)
  })
})

describe('Preview (TC-blog-007, 079, 080)', () => {
  it('TC-blog-007 — preview bài DRAFT: 200, không tăng viewCount', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce({ id: 'post-1' })

    const tokenRes = await request(app).post('/api/admin/blog/posts/post-1/preview-token').set('Authorization', ADMIN_TOKEN)
    expect(tokenRes.status).toBe(200)
    expect(tokenRes.body.token).toBeDefined()

    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(publicDetailPost({ status: 'DRAFT', publishedAt: null, categoryId: null, category: null }))

    const previewRes = await request(app).get(`/api/blog/preview/${tokenRes.body.token}`)

    expect(previewRes.status).toBe(200)
    expect(previewRes.body.preview.status).toBe('DRAFT')
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1)
    expect((mockPrisma.$executeRaw.mock.calls[0][0] as TemplateStringsArray).join(' ')).not.toContain('"viewCount" + 1')
  })

  it('TC-blog-079 — preview token hợp lệ cho bài SCHEDULED trả đúng status', async () => {
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce({ id: 'post-1' })
    const tokenRes = await request(app).post('/api/admin/blog/posts/post-1/preview-token').set('Authorization', ADMIN_TOKEN)

    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(publicDetailPost({ status: 'SCHEDULED', publishedAt: null, categoryId: null, category: null }))

    const previewRes = await request(app).get(`/api/blog/preview/${tokenRes.body.token}`)

    expect(previewRes.body.preview.status).toBe('SCHEDULED')
  })

  it('TC-blog-080a — 404, token rác (garbage)', async () => {
    const res = await request(app).get('/api/blog/preview/khong-phai-jwt')
    expect(res.status).toBe(404)
  })

  it('TC-blog-080b — 404, dùng access token thường làm preview token (sai khoá ký)', async () => {
    const res = await request(app).get(`/api/blog/preview/${ADMIN_TOKEN.replace('Bearer ', '')}`)
    expect(res.status).toBe(404)
  })

  it('TC-blog-080c — 404, token đã hết hạn', async () => {
    const secret = crypto.createHmac('sha256', 'test-access-secret-minimum-32-characters!!').update('blog-preview').digest()
    const expired = jwt.sign({ sub: 'post-1', typ: 'blog-preview' }, secret, { algorithm: 'HS256', expiresIn: -1 })

    const res = await request(app).get(`/api/blog/preview/${expired}`)
    expect(res.status).toBe(404)
  })

  it('TC-blog-080d — 404, sai typ payload', async () => {
    const secret = crypto.createHmac('sha256', 'test-access-secret-minimum-32-characters!!').update('blog-preview').digest()
    const wrongTyp = jwt.sign({ sub: 'post-1', typ: 'other' }, secret, { algorithm: 'HS256', expiresIn: '1h' })

    const res = await request(app).get(`/api/blog/preview/${wrongTyp}`)
    expect(res.status).toBe(404)
  })

  it('TC-blog-080e — 404 "Không tìm thấy bài viết", token hợp lệ nhưng bài đã xoá mềm', async () => {
    const secret = crypto.createHmac('sha256', 'test-access-secret-minimum-32-characters!!').update('blog-preview').digest()
    const valid = jwt.sign({ sub: 'post-1', typ: 'blog-preview' }, secret, { algorithm: 'HS256', expiresIn: '1h' })
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(null)

    const res = await request(app).get(`/api/blog/preview/${valid}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/Không tìm thấy bài viết/)
  })
})

describe('Sitemap & RSS (TC-blog-074..078)', () => {
  it('TC-blog-074 — sitemap liệt kê đủ URL kèm lastmod', async () => {
    mockNoDue()
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([
      { slug: 'bai-1', updatedAt: new Date(), canonicalUrl: null },
      { slug: 'bai-2', updatedAt: new Date(), canonicalUrl: null },
    ])
    mockPrisma.blogCategory.findMany.mockResolvedValueOnce([{ slug: 'danh-gia' }])

    const res = await request(app).get('/api/blog/sitemap.xml')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/xml/)
    expect(res.text).toContain('/tin-tuc/bai-1')
    expect(res.text).toContain('/tin-tuc/bai-2')
    expect(res.text).toContain('<lastmod>')
  })

  it('TC-blog-075 — loại bài canonicalUrl trỏ site khác khỏi sitemap (BR-blog-029)', async () => {
    mockNoDue()
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([
      { slug: 'bai-that', updatedAt: new Date(), canonicalUrl: null },
      { slug: 'bai-cross-post', updatedAt: new Date(), canonicalUrl: 'https://other-site.com/bai-goc' },
    ])
    mockPrisma.blogCategory.findMany.mockResolvedValueOnce([])

    const res = await request(app).get('/api/blog/sitemap.xml')

    expect(res.text).toContain('bai-that')
    expect(res.text).not.toContain('bai-cross-post')
  })

  it('503 — sitemap khi FRONTEND_URL không hợp lệ (SITE_URL null) — kiểm bằng resolveSiteUrl', async () => {
    const { resolveSiteUrl } = await import('../services/blog.service')
    expect(resolveSiteUrl('')).toBeNull()
    expect(resolveSiteUrl(',,')).toBeNull()
    expect(resolveSiteUrl('khong-hop-le')).toBeNull()
  })

  it('TC-blog-076 — RSS hợp lệ, giới hạn take=20 khi gọi DB', async () => {
    mockNoDue()
    mockPrisma.blogPost.findMany.mockResolvedValueOnce(
      Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`, title: `Bài ${i}`, slug: `bai-${i}`, excerpt: null, contentHtml: '<p>nd</p>',
        seoTitle: null, seoDescription: null, canonicalUrl: null, publishedAt: new Date(),
        category: { name: 'Đánh giá' },
      })),
    )

    const res = await request(app).get('/api/blog/rss.xml')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/rss/)
    expect((res.text.match(/<item>/g) ?? []).length).toBe(20)
    const call = mockPrisma.blogPost.findMany.mock.calls[0][0]
    expect(call.take).toBe(20)
  })

  it('TC-blog-077 — sitemap/RSS cũng chạy promote-on-read (thăng hạng trước khi đọc)', async () => {
    mockPrisma.$executeRaw.mockResolvedValueOnce(0)
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([])
    mockPrisma.blogCategory.findMany.mockResolvedValueOnce([])

    await request(app).get('/api/blog/sitemap.xml')

    const sql = mockPrisma.$executeRaw.mock.calls[0][0] as TemplateStringsArray
    expect(sql.join(' ')).toContain("status = 'SCHEDULED'")
  })

  it('TC-blog-078 — escapeXml: title chứa & < > " \' không phá cấu trúc XML', async () => {
    mockNoDue()
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([
      {
        id: 'p1', title: `Test & <b>"bôi đậm"</b>'`, slug: 'bai-dac-biet', excerpt: null, contentHtml: '<p>nd</p>',
        seoTitle: null, seoDescription: null, canonicalUrl: null, publishedAt: new Date(),
        category: { name: 'Đánh giá' },
      },
    ])

    const res = await request(app).get('/api/blog/rss.xml')

    expect(res.text).not.toMatch(/<title>[^&]*&[^a]/) // '&' trần không được lọt ra ngoài entity
    expect(res.text).toContain('&amp;')
    expect(res.text).toContain('&lt;b&gt;')
  })

  it('RVW-003 — RSS description KHÔNG escape 2 lần khi fallback đi qua htmlToText', async () => {
    mockNoDue()
    mockPrisma.blogPost.findMany.mockResolvedValueOnce([
      {
        id: 'p1', title: 'Bài test', slug: 'bai-test', excerpt: null, contentHtml: '<p>A &amp; B</p><p>C</p>',
        seoTitle: null, seoDescription: null, canonicalUrl: null, publishedAt: new Date(),
        category: { name: 'Đánh giá' },
      },
    ])

    const res = await request(app).get('/api/blog/rss.xml')

    expect(res.text).toContain('<description>A &amp; B C</description>')
    expect(res.text).not.toContain('&amp;amp;')
  })
})

describe('RVW-003 — htmlToText: decode entity + khoảng trắng ranh giới khối', () => {
  it('giải mã entity và chèn khoảng trắng giữa </p><p>, không dính chữ', () => {
    expect(htmlToText('<p>A &amp; B</p><p>C</p>')).toBe('A & B C')
  })

  it('chèn khoảng trắng ở </h2>, </li>, <br>', () => {
    expect(htmlToText('<h2>Cấu hình</h2><p>Bàn phím</p>')).toBe('Cấu hình Bàn phím')
    expect(htmlToText('<ul><li>Một</li><li>Hai</li></ul>')).toBe('Một Hai')
    expect(htmlToText('Dòng 1<br>Dòng 2')).toBe('Dòng 1 Dòng 2')
  })

  it('giải mã &lt; &gt; &quot; đúng thứ tự, không giải mã ngược thành thẻ', () => {
    expect(htmlToText('<p>&lt;script&gt;</p>')).toBe('<script>')
  })
})

describe('RVW-008 — ảnh nội dung: chặn bypass bằng ".." và Cloudinary image/fetch', () => {
  it('ảnh hợp lệ đúng /image/upload/ được giữ', () => {
    const html = sanitizeBlogHtml('<img src="https://res.cloudinary.com/mobivexa-test/image/upload/blog/content/x.jpg">')
    expect(html).toContain('<img')
  })

  it('bị loại khi path chứa ".." (chuẩn hoá URL đổi sang domain/thư mục khác)', () => {
    const html = sanitizeBlogHtml('<img src="https://res.cloudinary.com/mobivexa-test/../evil/x.png">')
    expect(html).not.toContain('<img')
  })

  it('bị loại khi dùng delivery type image/fetch (proxy ảnh ngoài)', () => {
    const html = sanitizeBlogHtml('<img src="https://res.cloudinary.com/mobivexa-test/image/fetch/https://evil.com/a.png">')
    expect(html).not.toContain('<img')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Bảo mật & phân quyền
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phân quyền admin blog (TC-blog-082..085)', () => {
  it('TC-blog-082 — 401, chưa đăng nhập gọi admin blog', async () => {
    const res = await request(app).get('/api/admin/blog/posts')
    expect(res.status).toBe(401)
  })

  it('TC-blog-083 — 403 E-blog-005, CUSTOMER gọi admin blog', async () => {
    const res = await request(app).post('/api/admin/blog/posts').set('Authorization', CUSTOMER_TOKEN).send({ title: 'X' })
    expect(res.status).toBe(403)
  })

  it('TC-blog-084 — 201, STAFF thao tác đầy đủ như ADMIN (tạo bài)', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ fullName: 'Staff Test' })
    mockPrisma.blogPost.create.mockResolvedValueOnce(adminDetailPost())

    const res = await request(app).post('/api/admin/blog/posts').set('Authorization', STAFF_TOKEN).send({ title: 'Bài của staff' })

    expect(res.status).toBe(201)
  })

  it('TC-blog-085 — 200, STAFF B đổi trạng thái VÀ xoá mềm bài do ADMIN A tạo (BR-blog-014, không phải IDOR)', async () => {
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(scalarPost({ authorId: 'admin-A', status: 'DRAFT' }))
    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 })
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'post-1', status: 'PUBLISHED', scheduledAt: null, publishedAt: new Date(), updatedAt: new Date() })

    const statusRes = await request(app).patch('/api/admin/blog/posts/post-1/status').set('Authorization', STAFF_TOKEN).send({ status: 'PUBLISHED' })
    expect(statusRes.status).toBe(200)

    mockPrisma.blogPost.updateMany.mockResolvedValueOnce({ count: 1 })
    const deleteRes = await request(app).delete('/api/admin/blog/posts/post-1').set('Authorization', STAFF_TOKEN)
    expect(deleteRes.status).toBe(200)
  })
})

describe('Sanitize HTML — chống XSS (TC-blog-086..088)', () => {
  it('TC-blog-086 — loại bỏ thẻ <script>, giữ nội dung hợp lệ', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ fullName: 'Admin' })
    mockPrisma.blogPost.create.mockImplementationOnce(({ data }: { data: { contentHtml: string } }) => Promise.resolve(adminDetailPost({ ...data })))

    const res = await request(app)
      .post('/api/admin/blog/posts')
      .set('Authorization', ADMIN_TOKEN)
      .send({ title: 'X', contentHtml: '<p>ok</p><script>alert(1)</script>' })

    expect(res.body.post.contentHtml).not.toContain('<script')
    expect(res.body.post.contentHtml).toContain('<p>ok</p>')
  })

  it('TC-blog-087 — loại onerror/onclick inline event, javascript: href', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ fullName: 'Admin' })
    mockPrisma.blogPost.create.mockImplementationOnce(({ data }: { data: { contentHtml: string } }) => Promise.resolve(adminDetailPost({ ...data })))

    const res = await request(app)
      .post('/api/admin/blog/posts')
      .set('Authorization', ADMIN_TOKEN)
      .send({ title: 'X', contentHtml: `<img src="https://res.cloudinary.com/mobivexa-test/x.jpg" onerror="alert(1)"><a href="javascript:alert(1)">click</a>` })

    expect(res.body.post.contentHtml).not.toContain('onerror')
    expect(res.body.post.contentHtml).not.toContain('javascript:')
  })

  it('TC-blog-088 — ảnh ngoài domain Cloudinary hệ thống bị loại cả thẻ', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ fullName: 'Admin' })
    mockPrisma.blogPost.create.mockImplementationOnce(({ data }: { data: { contentHtml: string } }) => Promise.resolve(adminDetailPost({ ...data })))

    const res = await request(app)
      .post('/api/admin/blog/posts')
      .set('Authorization', ADMIN_TOKEN)
      .send({ title: 'X', contentHtml: '<p>ok</p><img src="https://evil.com/x.png">' })

    expect(res.body.post.contentHtml).not.toContain('evil.com')
    expect(res.body.post.contentHtml).not.toContain('<img')
  })

  it('Ảnh Cloudinary hệ thống hợp lệ được giữ lại', async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ fullName: 'Admin' })
    mockPrisma.blogPost.create.mockImplementationOnce(({ data }: { data: { contentHtml: string } }) => Promise.resolve(adminDetailPost({ ...data })))

    const res = await request(app)
      .post('/api/admin/blog/posts')
      .set('Authorization', ADMIN_TOKEN)
      .send({ title: 'X', contentHtml: '<p>ok</p><img src="https://res.cloudinary.com/mobivexa-test/image/upload/blog/content/x.jpg" alt="a">' })

    expect(res.body.post.contentHtml).toContain('<img')
    expect(res.body.post.contentHtml).toContain('res.cloudinary.com/mobivexa-test')
  })
})

describe('Giới hạn body request (TC-blog-090, 091, 094)', () => {
  it('TC-blog-090 — 413, body JSON > 2MB tới /api/admin/blog/posts', async () => {
    const big = 'a'.repeat(2_600_000)
    const res = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: 'X', contentHtml: big })

    expect(res.status).toBe(413)
    expect(res.body.message).toMatch(/2MB/)
  }, 15_000)

  it('TC-blog-091 — regression: route KHÔNG phải blog vẫn giữ giới hạn 100KB cũ (413/lỗi, không nới lỏng)', async () => {
    const big = 'a'.repeat(150_000)
    const res = await request(app).post('/api/admin/tags').set('Authorization', ADMIN_TOKEN).send({ name: big })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).not.toBe(200)
  }, 15_000)

  it('TC-blog-094 — errorHandler: AppError/MulterError/entity.too.large không lẫn nhánh nhau', async () => {
    // Nhánh AppError (404 nghiệp vụ)
    mockNoDue()
    mockPrisma.blogPost.findFirst.mockResolvedValueOnce(null)
    const appErrorRes = await request(app).get('/api/blog/posts/khong-ton-tai')
    expect(appErrorRes.status).toBe(404)
    expect(appErrorRes.body.message).toBeDefined()

    // Nhánh MulterError (400, LIMIT_FILE_SIZE)
    const big = Buffer.alloc(6 * 1024 * 1024, 1)
    const multerRes = await request(app)
      .put('/api/admin/blog/posts/post-1/cover')
      .set('Authorization', ADMIN_TOKEN)
      .attach('image', big, { filename: 'big.jpg', contentType: 'image/jpeg' })
    expect(multerRes.status).toBe(400)

    // Nhánh entity.too.large (413)
    const hugeBody = 'a'.repeat(2_600_000)
    const tooLargeRes = await request(app).post('/api/admin/blog/posts').set('Authorization', ADMIN_TOKEN).send({ title: 'X', contentHtml: hugeBody })
    expect(tooLargeRes.status).toBe(413)
  }, 20_000)
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Hồi quy hạ tầng dùng chung
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hồi quy hạ tầng dùng chung (TC-blog-096..098)', () => {
  it('TC-blog-096 — blogSearchLimiter là instance riêng, không dùng chung với limiter khác', () => {
    expect(blogSearchLimiter).not.toBe(authLimiter)
    expect(blogSearchLimiter).not.toBe(couponPreviewLimiter)
  })

  it('TC-blog-097 — route mount mới không đụng route cũ; route cũ vẫn hoạt động', async () => {
    mockPrisma.blogCategory.findMany.mockResolvedValueOnce([])

    const blogRes = await request(app).get('/api/blog/categories')
    expect(blogRes.status).toBe(200)

    const notFound = await request(app).get('/api/blog')
    expect(notFound.status).toBe(404)

    const adminNotFound = await request(app).get('/api/admin/blog')
    expect([401, 404]).toContain(adminNotFound.status)
  })

  it('TC-blog-098 — CORS: origin hợp lệ được phép, origin lạ không có header ACAO tương ứng', async () => {
    mockPrisma.blogCategory.findMany.mockResolvedValueOnce([])
    const okRes = await request(app).get('/api/blog/categories').set('Origin', 'http://localhost:3000')
    expect(okRes.headers['access-control-allow-origin']).toBe('http://localhost:3000')

    mockPrisma.blogCategory.findMany.mockResolvedValueOnce([])
    const badRes = await request(app).get('/api/blog/categories').set('Origin', 'http://evil.com')
    expect(badRes.headers['access-control-allow-origin']).toBeUndefined()
  })
})
