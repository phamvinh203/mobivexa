import prisma from '../config/db'
import { uploadEntityImage, destroyImage } from '../config/cloudinary'
import { AppError } from '../helpers/app_error'
import { generateUniqueSlug, slugTaken } from '../utils/slug'
import type { CreateBrandBody, UpdateBrandBody } from '../types/brand.type'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const findBySlug = (slug: string) => prisma.brand.findUnique({ where: { slug }, select: { id: true } })

async function findBrandOrThrow(id: string) {
  const brand = await prisma.brand.findUnique({ where: { id } })
  if (!brand) throw new AppError(404, 'Thương hiệu không tồn tại')
  return brand
}

async function assertNameAvailable(name: string, excludeId?: string) {
  const found = await prisma.brand.findUnique({ where: { name }, select: { id: true } })
  if (found && found.id !== excludeId) throw new AppError(409, 'Tên thương hiệu đã tồn tại')
}

// ─── Public ─────────────────────────────────────────────────────────────────

export function getBrands(includeInactive = false) {
  return prisma.brand.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
  })
}

export async function getBrandBySlug(slug: string) {
  const brand = await prisma.brand.findUnique({ where: { slug } })
  if (!brand) throw new AppError(404, 'Thương hiệu không tồn tại')
  return brand
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function createBrand(body: CreateBrandBody, file?: Express.Multer.File) {
  const { name, slug, description, isActive } = body
  const trimmedName = name.trim()

  await assertNameAvailable(trimmedName)
  const finalSlug = await generateUniqueSlug(slug || trimmedName, slugTaken(findBySlug))

  let logo: { url: string; publicId: string } | null = null
  if (file) logo = await uploadEntityImage(file.buffer, 'brands')

  return prisma.brand.create({
    data: {
      name: trimmedName,
      slug: finalSlug,
      description,
      isActive: isActive != null ? String(isActive) !== 'false' : true,
      logoUrl: logo?.url,
      logoPublicId: logo?.publicId,
    },
  })
}

export async function updateBrand(id: string, body: UpdateBrandBody, file?: Express.Multer.File) {
  const brand = await findBrandOrThrow(id)
  const { name, slug, description, isActive } = body

  const data: Record<string, unknown> = {}
  if (name !== undefined) {
    const trimmedName = name.trim()
    await assertNameAvailable(trimmedName, id)
    data.name = trimmedName
  }
  if (slug !== undefined) data.slug = await generateUniqueSlug(slug, slugTaken(findBySlug, id))
  if (description !== undefined) data.description = description
  if (isActive !== undefined) data.isActive = String(isActive) !== 'false'

  if (file) {
    const logo = await uploadEntityImage(file.buffer, 'brands')
    data.logoUrl = logo.url
    data.logoPublicId = logo.publicId
    // Dọn ảnh cũ ở nền — không chặn response
    if (brand.logoPublicId) void destroyImage(brand.logoPublicId)
  }

  return prisma.brand.update({ where: { id }, data })
}

export async function deleteBrand(id: string) {
  const brand = await findBrandOrThrow(id)

  const productCount = await prisma.product.count({ where: { brandId: id } })
  if (productCount > 0) throw new AppError(409, 'Không thể xóa: thương hiệu còn chứa sản phẩm')

  await prisma.brand.delete({ where: { id } })
  if (brand.logoPublicId) void destroyImage(brand.logoPublicId)
}

export async function toggleBrandStatus(id: string) {
  const brand = await findBrandOrThrow(id)
  return prisma.brand.update({
    where: { id },
    data: { isActive: !brand.isActive },
  })
}
