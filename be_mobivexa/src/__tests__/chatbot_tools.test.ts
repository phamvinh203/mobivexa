import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  product:  { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  category: { findMany: vi.fn() },
  brand:    { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { executeTool, CHAT_TOOL_DECLARATIONS } from '../services/chatbot_tools'

const VARIANT = {
  id: 'var-1',
  color: 'Đen',
  storage: '256GB',
  ram: '8GB',
  salePrice: 9990000,
  originalPrice: 11990000,
  stock: 5,
  isActive: true,
}

const PRODUCT_ROW = {
  id: 'prod-1',
  name: 'iPhone 15',
  slug: 'iphone-15',
  isActive: true,
  category: { id: 'cat-1', name: 'Điện thoại', slug: 'dien-thoai' },
  brand:    { id: 'brand-1', name: 'Apple', slug: 'apple' },
  variants: [VARIANT],
  images:   [{ url: 'https://cdn/iphone.jpg', isCover: true }],
}

beforeEach(() => vi.clearAllMocks())

// ─── Khai báo tool ────────────────────────────────────────────────────────────

describe('CHAT_TOOL_DECLARATIONS', () => {
  it('khai báo đúng bốn tool chỉ đọc', () => {
    const names = CHAT_TOOL_DECLARATIONS.map((t) => t.name).sort()
    expect(names).toEqual(['getProductDetail', 'listBrands', 'listCategories', 'searchProducts'])
  })
})

// ─── searchProducts ───────────────────────────────────────────────────────────

describe('executeTool: searchProducts', () => {
  it('chỉ tìm trong sản phẩm đang bán', async () => {
    mockPrisma.product.findMany.mockResolvedValue([PRODUCT_ROW])
    mockPrisma.product.count.mockResolvedValue(1)

    await executeTool('searchProducts', { categorySlug: 'dien-thoai' })

    const where = mockPrisma.product.findMany.mock.calls[0][0].where
    expect(where.isActive).toBe(true)
  })

  it('trả card sản phẩm kèm giá của biến thể rẻ nhất', async () => {
    mockPrisma.product.findMany.mockResolvedValue([PRODUCT_ROW])
    mockPrisma.product.count.mockResolvedValue(1)

    const result = await executeTool('searchProducts', { categorySlug: 'dien-thoai' })

    expect(result.products).toEqual([
      {
        id: 'prod-1',
        name: 'iPhone 15',
        slug: 'iphone-15',
        salePrice: '9990000',
        originalPrice: '11990000',
        imageUrl: 'https://cdn/iphone.jpg',
      },
    ])
  })

  it('chặn limit vượt quá 8', async () => {
    mockPrisma.product.findMany.mockResolvedValue([])
    mockPrisma.product.count.mockResolvedValue(0)

    await executeTool('searchProducts', { limit: 50 })

    expect(mockPrisma.product.findMany.mock.calls[0][0].take).toBeLessThanOrEqual(8)
  })

  it('khoảng giá ngược trả về error thay vì ném lỗi', async () => {
    const result = await executeTool('searchProducts', { priceMin: 20000000, priceMax: 1000000 })

    expect(result.data).toHaveProperty('error')
    expect(result.products).toEqual([])
  })
})

// ─── getProductDetail ─────────────────────────────────────────────────────────

describe('executeTool: getProductDetail', () => {
  it('cắt thẻ HTML khỏi mô tả', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      ...PRODUCT_ROW,
      description: '<p>Máy <b>rất</b> tốt</p>',
      specs: [{ label: 'CPU', value: 'A17' }],
      productTags: [],
    })

    const result = await executeTool('getProductDetail', { slug: 'iphone-15' })

    expect(JSON.stringify(result.data)).not.toContain('<p>')
    expect(JSON.stringify(result.data)).toContain('Máy rất tốt')
  })

  it('bỏ qua biến thể đã ngừng bán', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      ...PRODUCT_ROW,
      description: null,
      specs: [],
      productTags: [],
      variants: [VARIANT, { ...VARIANT, id: 'var-2', color: 'Trắng', isActive: false }],
    })

    const result = await executeTool('getProductDetail', { slug: 'iphone-15' })

    expect(JSON.stringify(result.data)).not.toContain('Trắng')
  })

  it('sản phẩm không tồn tại trả về error, không ném lỗi', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null)

    const result = await executeTool('getProductDetail', { slug: 'khong-co' })

    expect(result.data).toHaveProperty('error')
  })
})

// ─── Tool lạ ──────────────────────────────────────────────────────────────────

describe('executeTool: tên tool lạ', () => {
  it('trả về error thay vì ném lỗi', async () => {
    const result = await executeTool('deleteAllProducts', {})

    expect(result.data).toHaveProperty('error')
  })
})
