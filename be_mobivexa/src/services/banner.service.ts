import prisma from '../config/db'
import { uploadEntityImage, destroyImage } from '../config/cloudinary'
import { AppError } from '../helpers/app_error'
import type { BannerPosition, CreateBannerBody, UpdateBannerBody } from '../types/banner.type'

async function findBannerOrThrow(id: string) {
  const banner = await prisma.banner.findUnique({ where: { id } })
  if (!banner) throw new AppError(404, 'Banner không tồn tại')
  return banner
}

// ─── Public ──────────────────────────────────────────────────────────────────

export function getBanners(position?: BannerPosition) {
  return prisma.banner.findMany({
    where: {
      isActive: true,
      ...(position ? { position } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export function getBannersAdmin(position?: BannerPosition) {
  return prisma.banner.findMany({
    where: position ? { position } : {},
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
}

export async function createBanner(body: CreateBannerBody, file: Express.Multer.File) {
  const { alt, href, description, position, isActive, sortOrder } = body
  const image = await uploadEntityImage(file.buffer, 'banners')

  return prisma.banner.create({
    data: {
      imageUrl: image.url,
      imagePublicId: image.publicId,
      alt: alt.trim(),
      href: href?.trim() ?? '/products',
      description,
      position: position ?? 'HERO',
      isActive: isActive != null ? String(isActive) !== 'false' : true,
      sortOrder: sortOrder != null ? Number(sortOrder) : 0,
    },
  })
}

export async function updateBanner(id: string, body: UpdateBannerBody, file?: Express.Multer.File) {
  const banner = await findBannerOrThrow(id)
  const { alt, href, description, position, isActive, sortOrder } = body

  const data: Record<string, unknown> = {}
  if (alt !== undefined) data.alt = alt.trim()
  if (href !== undefined) data.href = href.trim() || '/products'
  if (description !== undefined) data.description = description
  if (position !== undefined) data.position = position
  if (isActive !== undefined) data.isActive = String(isActive) !== 'false'
  if (sortOrder !== undefined) data.sortOrder = Number(sortOrder)

  if (file) {
    const image = await uploadEntityImage(file.buffer, 'banners')
    data.imageUrl = image.url
    data.imagePublicId = image.publicId
    void destroyImage(banner.imagePublicId)
  }

  return prisma.banner.update({ where: { id }, data })
}

export async function deleteBanner(id: string) {
  const banner = await findBannerOrThrow(id)
  await prisma.banner.delete({ where: { id } })
  void destroyImage(banner.imagePublicId)
}

export async function toggleBannerStatus(id: string) {
  const banner = await findBannerOrThrow(id)
  return prisma.banner.update({
    where: { id },
    data: { isActive: !banner.isActive },
  })
}
