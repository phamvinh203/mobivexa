import prisma from '../config/db'
import { uploadEntityImage, destroyImage } from '../config/cloudinary'
import { AppError } from '../helpers/app_error'
import type { BannerPosition, CreateBannerBody, UpdateBannerBody } from '../types/banner.type'

async function findBannerOrThrow(id: string) {
  const banner = await prisma.banner.findUnique({ where: { id } })
  if (!banner) throw new AppError(404, 'Banner không tồn tại')
  return banner
}

// ─── Public & Admin ───────────────────────────────────────────────────────────

// Cache in-memory một entry cho nhánh public của getBanners — storefront gọi
// ở mọi trang, dữ liệu gần như đứng yên, TTL 60s (mô phỏng
// inventorySummaryCache ở product.service). Phải nhớ cả position: banner HERO
// mà trả cache của LEFT là sai data, nên entry chỉ dùng lại khi cùng position.
// Chỉ cache nhánh public; mọi mutation admin của service này set null ngay.
let publicBannersCache: {
  position: BannerPosition | undefined
  data: Awaited<ReturnType<typeof findPublicBanners>>
  expiresAt: number
} | null = null
const PUBLIC_BANNERS_TTL_MS = 60_000
// Cache tắt hẳn trong test — cùng logic skip của rate limiter: các case trong
// cùng file mock findMany khác nhau, cache sống qua các case sẽ khiến case sau
// đọc kết quả của case trước.
const CACHE_SKIP_IN_TEST = process.env.NODE_ENV === 'test'

function findPublicBanners(position?: BannerPosition) {
  return prisma.banner.findMany({
    where: {
      isActive: true,
      ...(position ? { position } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
}

export async function getBanners(position?: BannerPosition, includeInactive = false) {
  if (includeInactive) {
    return prisma.banner.findMany({
      where: position ? { position } : {},
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })
  }

  const now = Date.now()
  if (
    !CACHE_SKIP_IN_TEST &&
    publicBannersCache &&
    publicBannersCache.position === position &&
    now < publicBannersCache.expiresAt
  ) {
    return publicBannersCache.data
  }
  const data = await findPublicBanners(position)
  publicBannersCache = { position, data, expiresAt: now + PUBLIC_BANNERS_TTL_MS }
  return data
}

export async function createBanner(body: CreateBannerBody, file: Express.Multer.File) {
  const { alt, href, description, position, isActive, sortOrder } = body

  const image = await uploadEntityImage(file.buffer, 'banners')
  try {
    const banner = await prisma.banner.create({
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
    publicBannersCache = null
    return banner
  } catch (err) {
    void destroyImage(image.publicId)
    throw err
  }
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

  const updated = await prisma.banner.update({ where: { id }, data })
  publicBannersCache = null
  return updated
}

export async function deleteBanner(id: string) {
  const banner = await findBannerOrThrow(id)
  await prisma.banner.delete({ where: { id } })
  void destroyImage(banner.imagePublicId)
  publicBannersCache = null
}

export async function toggleBannerStatus(id: string) {
  const banner = await findBannerOrThrow(id)
  const updated = await prisma.banner.update({
    where: { id },
    data: { isActive: !banner.isActive },
  })
  publicBannersCache = null
  return updated
}
