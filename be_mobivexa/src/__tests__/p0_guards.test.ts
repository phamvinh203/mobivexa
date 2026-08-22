/** Chốt lại các lỗ hổng P0 tìm ra khi review: PUT variant không có validator, tồn kho
 *  bị ghi đè mất phần chênh (lost update), và cây danh mục cho phép tạo chu trình. */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  category: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn(), delete: vi.fn(), create: vi.fn() },
  product: { findUnique: vi.fn(), count: vi.fn() },
  productVariant: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))
vi.mock('../config/cloudinary', () => ({
  uploadEntityImage: vi.fn().mockResolvedValue({ url: 'https://cdn/i.jpg', publicId: 'p/i' }),
  destroyImage: vi.fn().mockResolvedValue(undefined),
}))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app = createApp()
const ADMIN = `Bearer ${signAccessToken({ userId: 'a1', email: 'a@t.com', role: 'ADMIN' })}`

const VARIANT = {
  id: 'v-1', productId: 'p-1', sku: 'SKU-1', color: 'Đen', storage: '128GB', ram: null,
  imageUrl: null, originalPrice: 25_000_000, salePrice: 24_000_000, stock: 10, isActive: true,
}

// ─── PUT variant: giá phải được kiểm tra ─────────────────────────────────────
describe('PUT /api/admin/products/:id/variants/:variantId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.productVariant.findUnique.mockResolvedValue(VARIANT)
    mockPrisma.productVariant.findMany.mockResolvedValue([])
    mockPrisma.productVariant.update.mockImplementation(({ data }: never) => Promise.resolve({ ...VARIANT, ...(data as object) }))
  })

  const put = (body: object) =>
    request(app).put('/api/admin/products/p-1/variants/v-1').set('Authorization', ADMIN).send(body)

  it('400 - giá gốc âm', async () => {
    const res = await put({ originalPrice: -1000 })
    expect(res.status).toBe(400)
  })

  it('400 - giá gốc bằng 0', async () => {
    const res = await put({ originalPrice: 0 })
    expect(res.status).toBe(400)
  })

  it('400 - giá bán âm', async () => {
    const res = await put({ salePrice: -1 })
    expect(res.status).toBe(400)
  })

  it('400 - giá bán lớn hơn giá gốc trong cùng request', async () => {
    const res = await put({ originalPrice: 1_000_000, salePrice: 2_000_000 })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/giá gốc/i)
  })

  it('400 - giá bán mới vượt giá gốc đang lưu (chỉ gửi salePrice)', async () => {
    const res = await put({ salePrice: 99_000_000 }) // giá gốc đang lưu là 25tr
    expect(res.status).toBe(400)
  })

  it('400 - SKU rỗng', async () => {
    const res = await put({ sku: '   ' })
    expect(res.status).toBe(400)
  })

  it('200 - cập nhật hợp lệ vẫn đi qua', async () => {
    const res = await put({ originalPrice: 30_000_000, salePrice: 28_000_000 })
    expect(res.status).toBe(200)
  })

  it('200 - cập nhật từng phần không đụng tới giá', async () => {
    const res = await put({ color: 'Trắng' })
    expect(res.status).toBe(200)
  })
})

// ─── PATCH stock: chống lost update ──────────────────────────────────────────
describe('PATCH /api/admin/products/:id/variants/:variantId/stock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.productVariant.findUnique.mockResolvedValue(VARIANT) // stock hiện tại = 10
    mockPrisma.productVariant.update.mockImplementation(({ data }: never) => Promise.resolve({ ...VARIANT, ...(data as object) }))
  })

  const patch = (body: object) =>
    request(app).patch('/api/admin/products/p-1/variants/v-1/stock').set('Authorization', ADMIN).send(body)

  it('409 - tồn kho đã đổi so với lúc admin mở form', async () => {
    const res = await patch({ stock: 12, expectedStock: 8 }) // admin thấy 8, thực tế đã là 10
    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/10/)
    expect(mockPrisma.productVariant.update).not.toHaveBeenCalled()
  })

  it('200 - expectedStock khớp thì ghi bình thường', async () => {
    const res = await patch({ stock: 12, expectedStock: 10 })
    expect(res.status).toBe(200)
    expect(mockPrisma.productVariant.update).toHaveBeenCalled()
  })

  it('200 - không gửi expectedStock thì giữ hành vi cũ', async () => {
    const res = await patch({ stock: 12 })
    expect(res.status).toBe(200)
  })
})

// ─── Cây danh mục: chặn chu trình ────────────────────────────────────────────
describe('PUT /api/admin/categories/:id - chu trình cha/con', () => {
  beforeEach(() => vi.clearAllMocks())

  it('400 - không cho chuyển vào danh mục con của chính nó', async () => {
    // Cây: A -> B -> C. Gán A.parent = C sẽ tạo chu trình.
    const rows: Record<string, { id: string; parentId: string | null }> = {
      A: { id: 'A', parentId: null },
      B: { id: 'B', parentId: 'A' },
      C: { id: 'C', parentId: 'B' },
    }
    mockPrisma.category.findUnique.mockImplementation(({ where }: never) =>
      Promise.resolve(rows[(where as { id: string }).id] ?? null),
    )

    const res = await request(app)
      .put('/api/admin/categories/A')
      .set('Authorization', ADMIN)
      .send({ parentId: 'C' })

    expect(res.status).toBe(400)
    expect(mockPrisma.category.update).not.toHaveBeenCalled()
  })

  it('200 - chuyển sang một nhánh khác vẫn hợp lệ', async () => {
    const rows: Record<string, { id: string; parentId: string | null }> = {
      A: { id: 'A', parentId: null },
      D: { id: 'D', parentId: null },
    }
    mockPrisma.category.findUnique.mockImplementation(({ where }: never) =>
      Promise.resolve(rows[(where as { id: string }).id] ?? null),
    )
    mockPrisma.category.update.mockResolvedValue({ id: 'A', parentId: 'D' })

    const res = await request(app)
      .put('/api/admin/categories/A')
      .set('Authorization', ADMIN)
      .send({ parentId: 'D' })

    expect(res.status).toBe(200)
  })
})

// ─── Xoá giá trị: chuỗi rỗng phải tới được backend và có nghĩa "xoá" ─────────
describe('PUT /api/admin/categories/:id - xoá giá trị', () => {
  const CAT = {
    id: 'c1', name: 'Điện thoại', slug: 'dien-thoai', description: 'mô tả cũ',
    parentId: 'p1', sortOrder: 0, isActive: true, imageUrl: null, imagePublicId: null,
    createdAt: new Date(), updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.category.findUnique.mockImplementation(({ where }: never) => {
      const w = where as { id?: string; slug?: string }
      if (w.slug !== undefined) return Promise.resolve(null) // slug chưa ai dùng
      return Promise.resolve(w.id === 'c1' ? CAT : null)
    })
    mockPrisma.category.update.mockImplementation(({ data }: never) =>
      Promise.resolve({ ...CAT, ...(data as object) }),
    )
  })

  const dataSentToPrisma = () =>
    (mockPrisma.category.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data

  it('mô tả rỗng được lưu thành null', async () => {
    const res = await request(app).put('/api/admin/categories/c1').set('Authorization', ADMIN).send({ description: '' })
    expect(res.status).toBe(200)
    expect(dataSentToPrisma().description).toBeNull()
  })

  it('parentId rỗng đưa danh mục về gốc', async () => {
    const res = await request(app).put('/api/admin/categories/c1').set('Authorization', ADMIN).send({ parentId: '' })
    expect(res.status).toBe(200)
    expect(dataSentToPrisma().parentId).toBeNull()
  })

  it('slug rỗng thì sinh lại từ tên mới thay vì thành chuỗi rỗng', async () => {
    const res = await request(app)
      .put('/api/admin/categories/c1')
      .set('Authorization', ADMIN)
      .send({ slug: '', name: 'Máy tính bảng' })
    expect(res.status).toBe(200)
    expect(dataSentToPrisma().slug).toBe('may-tinh-bang')
  })
})
