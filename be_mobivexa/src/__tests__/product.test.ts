import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  product: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
    count:      vi.fn(),
  },
  productVariant: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
    count:      vi.fn(),
    aggregate:  vi.fn(),
  },
  productImage: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    findFirst:  vi.fn(),
    createMany: vi.fn(),
    update:     vi.fn(),
    updateMany: vi.fn(),
    delete:     vi.fn(),
    count:      vi.fn(),
  },
  productTag: {
    deleteMany:  vi.fn(),
    createMany:  vi.fn(),
  },
  productSpec: {
    findMany:   vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  category: { findUnique: vi.fn() },
  brand:    { findUnique: vi.fn() },
  tag:      { count: vi.fn() },
  $queryRaw:    vi.fn(),
  $transaction: vi.fn().mockImplementation((ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : (ops as (tx: unknown) => Promise<unknown>)(mockPrisma)
  ),
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))
vi.mock('../config/cloudinary', () => ({
  uploadEntityImage: vi.fn().mockResolvedValue({ url: 'https://cdn/product.jpg', publicId: 'products/img' }),
  destroyImage: vi.fn().mockResolvedValue(undefined),
}))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const app = createApp()

const ADMIN_TOKEN = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`
const USER_TOKEN  = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`

const BASE_VARIANT = {
  id: 'var-1',
  productId: 'prod-1',
  sku: 'SKU-001',
  color: 'Black',
  storage: '128GB',
  ram: '8GB',
  originalPrice: 20000000,
  salePrice: 18000000,
  stock: 10,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const BASE_PRODUCT = {
  id: 'prod-1',
  name: 'iPhone 15',
  slug: 'iphone-15',
  description: null,
  categoryId: 'cat-1',
  brandId: 'brand-1',
  isActive: true,
  isFeatured: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { id: 'cat-1', name: 'Điện thoại', slug: 'dien-thoai' },
  brand:    { id: 'brand-1', name: 'Apple', slug: 'apple' },
  variants: [BASE_VARIANT],
  images:   [],
  productTags: [],
}

const VALID_VARIANT_BODY = {
  sku: 'SKU-001',
  originalPrice: 20000000,
  salePrice: 18000000,
}

// ─── Public ───────────────────────────────────────────────────────────────────

describe('GET /api/products', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về danh sách sản phẩm có phân trang', async () => {
    mockPrisma.product.findMany.mockResolvedValue([BASE_PRODUCT])
    mockPrisma.product.count.mockResolvedValue(1)

    const res = await request(app).get('/api/products')

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.pagination).toMatchObject({ page: 1, total: 1 })
  })

  it('200 - tìm kiếm trả về rỗng khi không có kết quả', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]) // FTS không tìm thấy

    const res = await request(app).get('/api/products?search=khong+tim+thay')

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(0)
  })

  it('200 - trả về rỗng khi search là ký tự không hợp lệ', async () => {
    const res = await request(app).get('/api/products?search=!!!---')

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(0)
  })

  it('200 - lọc khoảng giá đẩy đúng gte/lte xuống prisma', async () => {
    mockPrisma.product.findMany.mockResolvedValue([BASE_PRODUCT])
    mockPrisma.product.count.mockResolvedValue(1)

    const res = await request(app).get('/api/products?minPrice=3000000&maxPrice=7000000')

    expect(res.status).toBe(200)
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          variants: { some: { salePrice: { gte: 3000000, lte: 7000000 } } },
        }),
      })
    )
  })

  it('200 - minPrice rỗng thì bỏ qua lọc giá, không lọc theo 0', async () => {
    mockPrisma.product.findMany.mockResolvedValue([BASE_PRODUCT])
    mockPrisma.product.count.mockResolvedValue(1)

    const res = await request(app).get('/api/products?minPrice=')

    expect(res.status).toBe(200)
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ variants: expect.anything() }),
      })
    )
  })

  // Các case dưới đây trước khi có validate đều rơi thẳng xuống Prisma Decimal
  // và trả 500 "Lỗi server" — sai loại lỗi cho một tham số client gõ sai
  it('400 - minPrice không phải số', async () => {
    const res = await request(app).get('/api/products?minPrice=abc')

    expect(res.status).toBe(400)
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled()
  })

  it('400 - minPrice tràn số (1e999 thành Infinity)', async () => {
    const res = await request(app).get('/api/products?minPrice=1e999')

    expect(res.status).toBe(400)
  })

  it('400 - minPrice âm', async () => {
    const res = await request(app).get('/api/products?minPrice=-5')

    expect(res.status).toBe(400)
  })

  it('400 - maxPrice không phải số', async () => {
    const res = await request(app).get('/api/products?maxPrice=abc')

    expect(res.status).toBe(400)
  })

  it('400 - minPrice lớn hơn maxPrice', async () => {
    const res = await request(app).get('/api/products?minPrice=9000000&maxPrice=1000')

    expect(res.status).toBe(400)
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/products/featured', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về sản phẩm nổi bật', async () => {
    mockPrisma.product.findMany.mockResolvedValue([{ ...BASE_PRODUCT, isFeatured: true }])

    const res = await request(app).get('/api/products/featured')

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
  })
})

describe('GET /api/products/:slug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về chi tiết sản phẩm', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(BASE_PRODUCT)

    const res = await request(app).get('/api/products/iphone-15')

    expect(res.status).toBe(200)
    expect(res.body.product.slug).toBe('iphone-15')
  })

  it('404 - sản phẩm không tồn tại', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/products/khong-ton-tai')

    expect(res.status).toBe(404)
  })

  it('404 - sản phẩm inactive không hiển thị cho public', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ ...BASE_PRODUCT, isActive: false })

    const res = await request(app).get('/api/products/iphone-15')

    expect(res.status).toBe(404)
  })
})

// ─── Admin: Product CRUD ──────────────────────────────────────────────────────

describe('POST /api/admin/products', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - tạo sản phẩm thành công', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' })
    mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1' })
    mockPrisma.tag.count.mockResolvedValue(0)
    mockPrisma.productVariant.findMany.mockResolvedValue([]) // SKU chưa tồn tại
    mockPrisma.product.findUnique.mockResolvedValue(null)   // slug chưa tồn tại
    mockPrisma.product.create.mockResolvedValue(BASE_PRODUCT)

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', ADMIN_TOKEN)
      .send({
        name: 'iPhone 15',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        variants: [VALID_VARIANT_BODY],
      })

    expect(res.status).toBe(201)
    expect(res.body.product.name).toBe('iPhone 15')
  })

  it('400 - thiếu tên sản phẩm', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', ADMIN_TOKEN)
      .send({ categoryId: 'cat-1', brandId: 'brand-1', variants: [VALID_VARIANT_BODY] })

    expect(res.status).toBe(400)
  })

  it('400 - thiếu categoryId', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'iPhone 15', brandId: 'brand-1', variants: [VALID_VARIANT_BODY] })

    expect(res.status).toBe(400)
  })

  it('400 - thiếu brandId', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'iPhone 15', categoryId: 'cat-1', variants: [VALID_VARIANT_BODY] })

    expect(res.status).toBe(400)
  })

  it('400 - không có variants', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'iPhone 15', categoryId: 'cat-1', brandId: 'brand-1', variants: [] })

    expect(res.status).toBe(400)
  })

  it('400 - variant có giá bán > giá gốc', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', ADMIN_TOKEN)
      .send({
        name: 'iPhone 15',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        variants: [{ sku: 'SKU-001', originalPrice: 10000000, salePrice: 15000000 }],
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/giá bán/i)
  })

  it('409 - SKU đã tồn tại trong DB', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' })
    mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1' })
    mockPrisma.tag.count.mockResolvedValue(0)
    mockPrisma.productVariant.findMany.mockResolvedValue([{ sku: 'SKU-001' }]) // SKU đã tồn tại

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'iPhone 15', categoryId: 'cat-1', brandId: 'brand-1', variants: [VALID_VARIANT_BODY] })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/SKU/)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/admin/products').send({ name: 'iPhone 15' })
    expect(res.status).toBe(401)
  })

  it('403 - role CUSTOMER không có quyền', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', USER_TOKEN)
      .send({ name: 'iPhone 15', categoryId: 'cat-1', brandId: 'brand-1', variants: [VALID_VARIANT_BODY] })
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/admin/products/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - cập nhật tên sản phẩm', async () => {
    mockPrisma.product.findUnique
      .mockResolvedValueOnce({ id: 'prod-1', isActive: true, isFeatured: false }) // findProductOrThrow
      .mockResolvedValueOnce(null) // generateUniqueSlug: slug chưa tồn tại

    mockPrisma.product.update.mockResolvedValue({ ...BASE_PRODUCT, name: 'iPhone 15 Pro' })

    const res = await request(app)
      .put('/api/admin/products/prod-1')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'iPhone 15 Pro' })

    expect(res.status).toBe(200)
    expect(res.body.product.name).toBe('iPhone 15 Pro')
  })

  it('404 - sản phẩm không tồn tại', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .put('/api/admin/products/khong-ton-tai')
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Test' })

    expect(res.status).toBe(404)
  })

  it('401 - không có token', async () => {
    const res = await request(app).put('/api/admin/products/prod-1').send({ name: 'Test' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/admin/products/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - xóa sản phẩm thành công', async () => {
    mockPrisma.productImage.findMany.mockResolvedValue([])
    mockPrisma.product.findUnique.mockResolvedValue({ slug: 'iphone-15' })
    mockPrisma.product.delete.mockResolvedValue({})

    const res = await request(app)
      .delete('/api/admin/products/prod-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/thành công/)
  })

  it('401 - không có token', async () => {
    const res = await request(app).delete('/api/admin/products/prod-1')
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/admin/products/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - toggle trạng thái', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: true, isFeatured: false })
    mockPrisma.product.update.mockResolvedValue({ slug: 'iphone-15' })

    const res = await request(app)
      .patch('/api/admin/products/prod-1/status')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })

  it('401 - không có token', async () => {
    const res = await request(app).patch('/api/admin/products/prod-1/status')
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/admin/products/:id/featured', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - toggle nổi bật', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: true, isFeatured: false })
    mockPrisma.product.update.mockResolvedValue({ slug: 'iphone-15' })

    const res = await request(app)
      .patch('/api/admin/products/prod-1/featured')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
  })
})

// ─── Admin: Product specs ─────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id/specs', () => {
  beforeEach(() => vi.clearAllMocks())

  const SPECS = [
    { label: 'CPU (Bộ vi xử lý)', value: 'Apple A18 Pro' },
    { label: 'Màn hình', value: '6.9 inch Super Retina XDR' },
  ]

  it('200 - thay cả bảng, sortOrder lấy theo thứ tự trong mảng', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: true, isFeatured: false })
    mockPrisma.productSpec.findMany.mockResolvedValue(
      SPECS.map((s, i) => ({ id: `spec-${i}`, productId: 'prod-1', ...s, sortOrder: i }))
    )

    const res = await request(app)
      .put('/api/admin/products/prod-1/specs')
      .set('Authorization', ADMIN_TOKEN)
      .send({ specs: SPECS })

    expect(res.status).toBe(200)
    expect(res.body.specs).toHaveLength(2)
    // Xoá sạch trước rồi mới ghi lại — đây là điểm mấu chốt của "thay cả bảng"
    expect(mockPrisma.productSpec.deleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-1' } })
    expect(mockPrisma.productSpec.createMany).toHaveBeenCalledWith({
      data: [
        { productId: 'prod-1', label: 'CPU (Bộ vi xử lý)', value: 'Apple A18 Pro', sortOrder: 0 },
        { productId: 'prod-1', label: 'Màn hình', value: '6.9 inch Super Retina XDR', sortOrder: 1 },
      ],
    })
  })

  it('200 - mảng rỗng thì xoá sạch, không gọi createMany', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: true, isFeatured: false })
    mockPrisma.productSpec.findMany.mockResolvedValue([])

    const res = await request(app)
      .put('/api/admin/products/prod-1/specs')
      .set('Authorization', ADMIN_TOKEN)
      .send({ specs: [] })

    expect(res.status).toBe(200)
    expect(mockPrisma.productSpec.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.productSpec.createMany).not.toHaveBeenCalled()
  })

  it('404 - sản phẩm không tồn tại', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .put('/api/admin/products/khong-co/specs')
      .set('Authorization', ADMIN_TOKEN)
      .send({ specs: SPECS })

    expect(res.status).toBe(404)
    expect(mockPrisma.productSpec.deleteMany).not.toHaveBeenCalled()
  })

  it('400 - label rỗng', async () => {
    const res = await request(app)
      .put('/api/admin/products/prod-1/specs')
      .set('Authorization', ADMIN_TOKEN)
      .send({ specs: [{ label: '   ', value: 'Apple A18 Pro' }] })

    expect(res.status).toBe(400)
    expect(mockPrisma.productSpec.deleteMany).not.toHaveBeenCalled()
  })

  it('400 - specs không phải mảng', async () => {
    const res = await request(app)
      .put('/api/admin/products/prod-1/specs')
      .set('Authorization', ADMIN_TOKEN)
      .send({ specs: 'CPU: Apple A18 Pro' })

    expect(res.status).toBe(400)
  })

  it('400 - vượt quá 60 dòng', async () => {
    const tooMany = Array.from({ length: 61 }, (_, i) => ({ label: `Thông số ${i}`, value: 'x' }))

    const res = await request(app)
      .put('/api/admin/products/prod-1/specs')
      .set('Authorization', ADMIN_TOKEN)
      .send({ specs: tooMany })

    expect(res.status).toBe(400)
  })

  it('401 - chưa đăng nhập', async () => {
    const res = await request(app).put('/api/admin/products/prod-1/specs').send({ specs: SPECS })

    expect(res.status).toBe(401)
  })

  it('403 - tài khoản khách không được sửa', async () => {
    const res = await request(app)
      .put('/api/admin/products/prod-1/specs')
      .set('Authorization', USER_TOKEN)
      .send({ specs: SPECS })

    expect(res.status).toBe(403)
  })
})

// ─── Admin: Variant ───────────────────────────────────────────────────────────

describe('POST /api/admin/products/:id/variants', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - thêm variant thành công', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: true, isFeatured: false })
    mockPrisma.productVariant.findMany.mockResolvedValue([]) // SKU chưa tồn tại
    mockPrisma.productVariant.create.mockResolvedValue(BASE_VARIANT)

    const res = await request(app)
      .post('/api/admin/products/prod-1/variants')
      .set('Authorization', ADMIN_TOKEN)
      .send(VALID_VARIANT_BODY)

    expect(res.status).toBe(201)
    expect(res.body.variant.sku).toBe('SKU-001')
  })

  it('400 - SKU rỗng', async () => {
    const res = await request(app)
      .post('/api/admin/products/prod-1/variants')
      .set('Authorization', ADMIN_TOKEN)
      .send({ sku: '', originalPrice: 10000000, salePrice: 9000000 })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/SKU/)
  })

  it('400 - giá bán > giá gốc', async () => {
    const res = await request(app)
      .post('/api/admin/products/prod-1/variants')
      .set('Authorization', ADMIN_TOKEN)
      .send({ sku: 'SKU-NEW', originalPrice: 10000000, salePrice: 12000000 })

    expect(res.status).toBe(400)
  })

  // VND không có đơn vị nhỏ hơn đồng. Giá lẻ làm subtotal lẻ, và subtotal lẻ
  // khiến mã giảm phủ 100% để lại vài hào — đơn kẹt UNPAID vì VietQR không xin
  // được số đó còn SePay không khớp nổi.
  it('400 - giá không phải số nguyên', async () => {
    const res = await request(app)
      .post('/api/admin/products/prod-1/variants')
      .set('Authorization', ADMIN_TOKEN)
      .send({ sku: 'SKU-NEW', originalPrice: 10000000, salePrice: 9000000.5 })

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/admin/products/prod-1/variants').send(VALID_VARIANT_BODY)
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/admin/products/:id/variants/:variantId/stock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - cập nhật tồn kho thành công', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(BASE_VARIANT)
    mockPrisma.productVariant.update.mockResolvedValue({ ...BASE_VARIANT, stock: 20 })

    const res = await request(app)
      .patch('/api/admin/products/prod-1/variants/var-1/stock')
      .set('Authorization', ADMIN_TOKEN)
      .send({ stock: 20 })

    expect(res.status).toBe(200)
  })

  it('400 - stock không phải số nguyên', async () => {
    const res = await request(app)
      .patch('/api/admin/products/prod-1/variants/var-1/stock')
      .set('Authorization', ADMIN_TOKEN)
      .send({ stock: 'abc' })

    expect(res.status).toBe(400)
  })

  it('400 - stock âm', async () => {
    const res = await request(app)
      .patch('/api/admin/products/prod-1/variants/var-1/stock')
      .set('Authorization', ADMIN_TOKEN)
      .send({ stock: -1 })

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app)
      .patch('/api/admin/products/prod-1/variants/var-1/stock')
      .send({ stock: 10 })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/admin/products/:id/variants/:variantId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - xóa variant thành công (còn variant khác)', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(BASE_VARIANT)
    mockPrisma.productVariant.count.mockResolvedValue(3) // còn 2 variant khác
    mockPrisma.productVariant.delete.mockResolvedValue({})

    const res = await request(app)
      .delete('/api/admin/products/prod-1/variants/var-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/thành công/)
  })

  it('409 - xóa variant cuối cùng', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(BASE_VARIANT)
    mockPrisma.productVariant.count.mockResolvedValue(1) // chỉ còn 1

    const res = await request(app)
      .delete('/api/admin/products/prod-1/variants/var-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/ít nhất một/)
  })

  it('404 - variant không thuộc sản phẩm', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({ ...BASE_VARIANT, productId: 'other-prod' })
    mockPrisma.productVariant.count.mockResolvedValue(3)

    const res = await request(app)
      .delete('/api/admin/products/prod-1/variants/var-1')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(404)
  })

  it('401 - không có token', async () => {
    const res = await request(app).delete('/api/admin/products/prod-1/variants/var-1')
    expect(res.status).toBe(401)
  })
})
