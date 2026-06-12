import prisma from '../config/db'
import { Prisma } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { generateUniqueSlug, slugTaken } from '../utils/slug'
import { uploadEntityImage, destroyImage } from '../config/cloudinary'
import type {
  CreateProductBody,
  UpdateProductBody,
  VariantInput,
  UpdateVariantBody,
  ProductListQuery,
  InventoryQuery,
} from '../types/product.type'

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 50

// ─── Pagination helpers ───────────────────────────────────────────────────────

function parsePage(raw: unknown) {
  return Math.max(1, Number(raw) || 1)
}

function parseLimit(raw: unknown, defaultVal: number, max: number) {
  return Math.min(max, Math.max(1, Number(raw) || defaultVal))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const findBySlug = (slug: string) => prisma.product.findUnique({ where: { slug }, select: { id: true } })

async function findProductOrThrow(id: string) {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) throw new AppError(404, 'Sản phẩm không tồn tại')
  return product
}

async function assertCategoryExists(categoryId: string) {
  const found = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
  if (!found) throw new AppError(400, 'Danh mục không tồn tại')
}

async function assertBrandExists(brandId: string) {
  const found = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } })
  if (!found) throw new AppError(400, 'Thương hiệu không tồn tại')
}

async function assertTagsExist(tagIds: string[]) {
  if (tagIds.length === 0) return
  const count = await prisma.tag.count({ where: { id: { in: tagIds } } })
  if (count !== new Set(tagIds).size) throw new AppError(400, 'Có tag không tồn tại')
}

// SKU phải unique toàn hệ thống — chặn trùng trong payload lẫn trong DB
async function assertSkusAvailable(skus: string[], excludeVariantId?: string) {
  const unique = new Set(skus)
  if (unique.size !== skus.length) throw new AppError(409, 'SKU bị trùng trong danh sách phiên bản')

  const existing = await prisma.productVariant.findMany({
    where: { sku: { in: skus }, id: excludeVariantId ? { not: excludeVariantId } : undefined },
    select: { sku: true },
  })
  if (existing.length > 0) throw new AppError(409, `SKU đã tồn tại: ${existing.map((v) => v.sku).join(', ')}`)
}

function variantCreateData(v: VariantInput) {
  return {
    sku: v.sku.trim(),
    color: v.color,
    storage: v.storage,
    ram: v.ram,
    originalPrice: v.originalPrice,
    salePrice: v.salePrice,
    stock: v.stock ?? 0,
    isActive: v.isActive ?? true,
  }
}

const PRODUCT_DETAIL_INCLUDE = {
  category: true,
  brand: true,
  variants: { orderBy: { salePrice: 'asc' } },
  productTags: { include: { tag: true } },
  images: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude

// ─── Public ─────────────────────────────────────────────────────────────────

export async function listProducts(query: ProductListQuery) {
  const page = parsePage(query.page)
  const limit = parseLimit(query.limit, DEFAULT_LIMIT, MAX_LIMIT)

  const where: Prisma.ProductWhereInput = { isActive: true }

  if (query.category) where.category = { slug: query.category }
  if (query.brand) where.brand = { slug: query.brand }
  if (query.tag) where.productTags = { some: { tag: { slug: query.tag } } }
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' }

  // Lọc theo khoảng giá: sản phẩm có ít nhất 1 variant nằm trong khoảng
  const priceFilter: Prisma.DecimalFilter = {}
  if (query.minPrice) priceFilter.gte = Number(query.minPrice)
  if (query.maxPrice) priceFilter.lte = Number(query.maxPrice)
  if (priceFilter.gte !== undefined || priceFilter.lte !== undefined) {
    where.variants = { some: { salePrice: priceFilter } }
  }

  const orderBy = resolveSort(query.sort)

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        variants: { where: { isActive: true }, orderBy: { salePrice: 'asc' } },
        images: { where: { isCover: true }, take: 1 },
      },
    }),
    prisma.product.count({ where }),
  ])

  return {
    products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

function resolveSort(sort?: string): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case 'oldest':
      return { createdAt: 'asc' }
    case 'name_asc':
      return { name: 'asc' }
    case 'name_desc':
      return { name: 'desc' }
    default:
      return { createdAt: 'desc' } // newest
  }
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: PRODUCT_DETAIL_INCLUDE,
  })
  if (!product || !product.isActive) throw new AppError(404, 'Sản phẩm không tồn tại')
  return product
}

export function getFeaturedProducts(limit = 8) {
  return prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      variants: { where: { isActive: true }, orderBy: { salePrice: 'asc' } },
      images: { where: { isCover: true }, take: 1 },
    },
  })
}

// ─── Admin: Product ───────────────────────────────────────────────────────────

export async function createProduct(body: CreateProductBody, files?: Express.Multer.File[]) {
  const { name, slug, description, categoryId, brandId, isActive, isFeatured, tagIds = [], variants } = body

  await Promise.all([
    assertCategoryExists(categoryId),
    assertBrandExists(brandId),
    assertTagsExist(tagIds),
    assertSkusAvailable(variants.map((v) => v.sku.trim())),
  ])

  const finalSlug = await generateUniqueSlug(slug || name, slugTaken(findBySlug))

  const uploadedImages = files?.length
    ? await Promise.all(files.map((f) => uploadEntityImage(f.buffer, 'products')))
    : []

  return prisma.product.create({
    data: {
      name: name.trim(),
      slug: finalSlug,
      description,
      categoryId,
      brandId,
      isActive: isActive != null ? String(isActive) !== 'false' : true,
      isFeatured: isFeatured != null ? String(isFeatured) !== 'false' : false,
      variants: { create: variants.map(variantCreateData) },
      productTags: tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      images: uploadedImages.length
        ? { create: uploadedImages.map((img, i) => ({ url: img.url, publicId: img.publicId, isCover: i === 0, sortOrder: i })) }
        : undefined,
    },
    include: PRODUCT_DETAIL_INCLUDE,
  })
}

export async function updateProduct(id: string, body: UpdateProductBody, files?: Express.Multer.File[]) {
  await findProductOrThrow(id)
  const { name, slug, description, categoryId, brandId, isActive, isFeatured, tagIds } = body

  const checks: Promise<void>[] = []
  if (categoryId !== undefined) checks.push(assertCategoryExists(categoryId))
  if (brandId !== undefined) checks.push(assertBrandExists(brandId))
  if (tagIds !== undefined) checks.push(assertTagsExist(tagIds))
  await Promise.all(checks)

  const data: Prisma.ProductUpdateInput = {}
  if (name !== undefined) data.name = name.trim()
  if (slug !== undefined) data.slug = await generateUniqueSlug(slug, slugTaken(findBySlug, id))
  if (description !== undefined) data.description = description
  if (categoryId !== undefined) data.category = { connect: { id: categoryId } }
  if (brandId !== undefined) data.brand = { connect: { id: brandId } }
  if (isActive !== undefined) data.isActive = String(isActive) !== 'false'
  if (isFeatured !== undefined) data.isFeatured = String(isFeatured) !== 'false'

  if (files?.length) {
    const uploadedImages = await Promise.all(files.map((f) => uploadEntityImage(f.buffer, 'products')))
    // Đếm ảnh hiện tại để tính sortOrder tiếp theo
    const existingCount = await prisma.productImage.count({ where: { productId: id } })
    data.images = {
      create: uploadedImages.map((img, i) => ({ url: img.url, publicId: img.publicId, isCover: false, sortOrder: existingCount + i })),
    }
  }

  if (tagIds !== undefined) {
    return prisma.$transaction(async (tx) => {
      await tx.productTag.deleteMany({ where: { productId: id } })
      if (tagIds.length) {
        await tx.productTag.createMany({ data: tagIds.map((tagId) => ({ productId: id, tagId })) })
      }
      return tx.product.update({ where: { id }, data, include: PRODUCT_DETAIL_INCLUDE })
    })
  }

  return prisma.product.update({ where: { id }, data, include: PRODUCT_DETAIL_INCLUDE })
}

export async function deleteProduct(id: string) {
  const images = await prisma.productImage.findMany({ where: { productId: id }, select: { publicId: true } })
  await prisma.product.delete({ where: { id } })
  images.forEach((img) => void destroyImage(img.publicId))
}

// ─── Admin: Product Images ────────────────────────────────────────────────────

export async function addProductImages(productId: string, files: Express.Multer.File[]) {
  await findProductOrThrow(productId)

  const existingCount = await prisma.productImage.count({ where: { productId } })
  const uploaded = await Promise.all(files.map((f) => uploadEntityImage(f.buffer, 'products')))

  return prisma.productImage.createMany({
    data: uploaded.map((img, i) => ({
      productId,
      url: img.url,
      publicId: img.publicId,
      isCover: existingCount === 0 && i === 0, // ảnh đầu tiên của sản phẩm tự thành cover
      sortOrder: existingCount + i,
    })),
  })
}

export async function deleteProductImage(productId: string, imageId: string) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } })
  if (!image || image.productId !== productId) throw new AppError(404, 'Ảnh không tồn tại')

  await prisma.productImage.delete({ where: { id: imageId } })
  void destroyImage(image.publicId)

  // Nếu xóa ảnh cover, tự động set ảnh đầu tiên còn lại làm cover
  if (image.isCover) {
    const next = await prisma.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: 'asc' } })
    if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isCover: true } })
  }
}

export async function setProductImageCover(productId: string, imageId: string) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } })
  if (!image || image.productId !== productId) throw new AppError(404, 'Ảnh không tồn tại')

  // Bỏ cover tất cả ảnh cũ rồi set ảnh mới
  await prisma.$transaction([
    prisma.productImage.updateMany({ where: { productId }, data: { isCover: false } }),
    prisma.productImage.update({ where: { id: imageId }, data: { isCover: true } }),
  ])

  return prisma.productImage.findMany({ where: { productId }, orderBy: { sortOrder: 'asc' } })
}

export async function toggleProductStatus(id: string) {
  const product = await findProductOrThrow(id)
  return prisma.product.update({ where: { id }, data: { isActive: !product.isActive } })
}

export async function toggleProductFeatured(id: string) {
  const product = await findProductOrThrow(id)
  return prisma.product.update({ where: { id }, data: { isFeatured: !product.isFeatured } })
}

// ─── Admin: Variant ─────────────────────────────────────────────────────────

async function findOwnedVariant(productId: string, variantId: string) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } })
  if (!variant || variant.productId !== productId) throw new AppError(404, 'Phiên bản không tồn tại')
  return variant
}

export async function addVariant(productId: string, body: VariantInput) {
  await findProductOrThrow(productId)
  await assertSkusAvailable([body.sku.trim()])

  return prisma.productVariant.create({
    data: { ...variantCreateData(body), productId },
  })
}

export async function updateVariant(productId: string, variantId: string, body: UpdateVariantBody) {
  await findOwnedVariant(productId, variantId)

  const data: Prisma.ProductVariantUpdateInput = {}
  if (body.sku !== undefined) {
    await assertSkusAvailable([body.sku.trim()], variantId)
    data.sku = body.sku.trim()
  }
  if (body.color !== undefined) data.color = body.color
  if (body.storage !== undefined) data.storage = body.storage
  if (body.ram !== undefined) data.ram = body.ram
  if (body.originalPrice !== undefined) data.originalPrice = body.originalPrice
  if (body.salePrice !== undefined) data.salePrice = body.salePrice
  if (body.stock !== undefined) data.stock = body.stock
  if (body.isActive !== undefined) data.isActive = body.isActive

  return prisma.productVariant.update({ where: { id: variantId }, data })
}

export async function deleteVariant(productId: string, variantId: string) {
  await findOwnedVariant(productId, variantId)

  const count = await prisma.productVariant.count({ where: { productId } })
  if (count <= 1) throw new AppError(409, 'Sản phẩm phải có ít nhất một phiên bản')

  await prisma.productVariant.delete({ where: { id: variantId } })
}

// ─── Admin: Inventory report ─────────────────────────────────────────────────

const DEFAULT_INV_LIMIT = 20
const MAX_INV_LIMIT = 100
const DEFAULT_LOW_THRESHOLD = 5

export async function getInventory(query: InventoryQuery) {
  const page      = parsePage(query.page)
  const limit     = parseLimit(query.limit, DEFAULT_INV_LIMIT, MAX_INV_LIMIT)
  const threshold = Math.max(1, Number(query.lowThreshold) || DEFAULT_LOW_THRESHOLD)

  const where: Prisma.ProductVariantWhereInput = {}

  if (query.search) {
    where.product = { name: { contains: query.search, mode: 'insensitive' } }
  }

  switch (query.stockStatus) {
    case 'out_of_stock': where.stock = { equals: 0 };            break
    case 'low_stock':    where.stock = { gt: 0, lte: threshold }; break
    case 'in_stock':     where.stock = { gt: threshold };         break
  }

  const [variants, total, summary, outOfStock, lowStock] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      orderBy: { stock: 'asc' },
      skip:  (page - 1) * limit,
      take:  limit,
      select: {
        id: true, sku: true, color: true, storage: true, ram: true,
        stock: true, isActive: true, salePrice: true,
        product: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.productVariant.count({ where }),
    prisma.productVariant.aggregate({
      _count: { id: true },
      _sum:   { stock: true },
    }),
    prisma.productVariant.count({ where: { stock: { equals: 0 } } }),
    prisma.productVariant.count({ where: { stock: { gt: 0, lte: threshold } } }),
  ])

  return {
    variants,
    summary: {
      totalVariants: summary._count.id,
      totalStock:    summary._sum.stock ?? 0,
      outOfStock,
      lowStock,
      inStock:       summary._count.id - outOfStock - lowStock,
    },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}
