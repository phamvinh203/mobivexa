import prisma from '../config/db'
import { Prisma, OrderStatus, ReviewStatus } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { isPrismaError } from '../helpers/prisma_error'
import { uploadEntityImage, destroyImage } from '../config/cloudinary'
import { parsePagination, paginationMeta } from '../utils/pagination'
import type {
  CreateReviewBody,
  UpdateReviewBody,
  ReviewListQuery,
  AdminReviewListQuery,
} from '../types/review.type'

const EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const MAX_PHOTOS     = 5

// Include dùng chung cho mọi admin query review (list + reply) — tránh divergence.
const REVIEW_ADMIN_INCLUDE = {
  user:    { select: { id: true, fullName: true, email: true } },
  product: { select: { id: true, name: true, slug: true } },
  photos:  { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true } },
  _count:  { select: { helpful: true } },
} as const satisfies Prisma.ReviewInclude

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } })
  if (!product) throw new AppError(404, 'Sản phẩm không tồn tại')
  return product
}

async function findOwnedReview(userId: string, reviewId: string) {
  const review = await prisma.review.findFirst({
    where: { id: reviewId, userId },
    include: { photos: true },
  })
  if (!review) throw new AppError(404, 'Đánh giá không tồn tại')
  return review
}

const REVIEW_PUBLIC_SELECT = {
  id: true,
  rating: true,
  content: true,
  replyContent: true,
  repliedAt: true,
  createdAt: true,
  orderItem: { select: { color: true, storage: true, ram: true, sku: true } },
  user: { select: { id: true, fullName: true, avatarUrl: true } },
  photos: { orderBy: { sortOrder: 'asc' as const }, select: { id: true, url: true } },
  _count: { select: { helpful: true } },
} satisfies Prisma.ReviewSelect

// ─── Public ───────────────────────────────────────────────────────────────────

export async function getReviewSummary(slug: string) {
  // Lọc theo quan hệ product.slug (slug unique) để gộp bước tra id vào query thật —
  // 1 round-trip thay vì 2 tuần tự. Slug không có thật chỉ lộ ra khi kết quả rỗng.
  const where: Prisma.ReviewWhereInput = { product: { slug }, status: ReviewStatus.APPROVED }

  const [aggregate, breakdown, withPhoto] = await Promise.all([
    prisma.review.aggregate({
      where,
      _avg:   { rating: true },
      _count: { id: true },
    }),
    prisma.review.groupBy({
      by: ['rating'],
      where,
      _count: { id: true },
    }),
    prisma.reviewPhoto.count({ where: { review: where } }),
  ])

  // Rỗng: phân biệt "slug không tồn tại" (404) với "sản phẩm chưa có review" (summary 0).
  if (aggregate._count.id === 0) await findProductBySlug(slug)

  const breakdown5: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  breakdown.forEach((b) => { breakdown5[b.rating] = b._count.id })

  return {
    averageRating:  aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : 0,
    totalCount:     aggregate._count.id,
    breakdown:      breakdown5,
    withPhotoCount: withPhoto,
  }
}

export async function listReviews(slug: string, query: ReviewListQuery) {
  const { page, limit } = parsePagination(query)

  // Lọc theo product.slug thay vì tra productId trước (xem getReviewSummary).
  const where: Prisma.ReviewWhereInput = { product: { slug }, status: ReviewStatus.APPROVED }

  if (query.rating) {
    const r = Number(query.rating)
    if (r >= 1 && r <= 5) where.rating = r
  }
  if (query.hasPhoto === 'true') where.photos = { some: {} }

  const orderBy: Prisma.ReviewOrderByWithRelationInput =
    query.sort === 'helpful' ? { helpful: { _count: 'desc' } } : { createdAt: 'desc' }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, select: REVIEW_PUBLIC_SELECT }),
    prisma.review.count({ where }),
  ])

  // total = 0 có thể do slug sai hoặc do bộ lọc/chưa có review — chỉ slug sai mới 404.
  if (total === 0) await findProductBySlug(slug)

  return { reviews, pagination: paginationMeta(page, limit, total) }
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function getPendingReviews(userId: string) {
  return prisma.orderItem.findMany({
    where: {
      order: { userId, status: OrderStatus.DELIVERED },
      review: { is: null },
    },
    select: {
      id: true,
      productName: true,
      sku: true,
      color: true,
      storage: true,
      ram: true,
      unitPrice: true,
      quantity: true,
      order: { select: { id: true, orderCode: true, updatedAt: true } },
      variant: {
        select: {
          product: {
            select: {
              slug: true,
              images: { where: { isCover: true }, take: 1, select: { url: true } },
            },
          },
        },
      },
    },
    orderBy: { order: { updatedAt: 'desc' } },
  })
}

export async function createReview(
  userId: string,
  orderItemId: string,
  body: CreateReviewBody,
  files?: Express.Multer.File[]
) {
  const orderItem = await prisma.orderItem.findFirst({
    where: { id: orderItemId, order: { userId, status: OrderStatus.DELIVERED } },
    include: { order: { select: { id: true } }, review: { select: { id: true } } },
  })

  if (!orderItem) throw new AppError(404, 'Không tìm thấy sản phẩm trong đơn hàng đã giao')
  if (orderItem.review) throw new AppError(409, 'Bạn đã đánh giá sản phẩm này rồi')

  // Resolve productId and upload photos in parallel
  const productIdPromise = orderItem.variantId
    ? prisma.productVariant
        .findUnique({ where: { id: orderItem.variantId }, select: { productId: true } })
        .then((r) => r!.productId)
    : resolveProductIdFromOrderItem(orderItem)

  const uploadPromise = files?.length
    ? Promise.all(files.slice(0, MAX_PHOTOS).map((f) => uploadEntityImage(f.buffer, 'reviews')))
    : Promise.resolve([] as Array<{ url: string; publicId: string }>)

  const [productId, uploadedPhotos] = await Promise.all([productIdPromise, uploadPromise])

  try {
    return await prisma.review.create({
      data: {
        orderItemId,
        userId,
        productId,
        variantId: orderItem.variantId,
        rating:    body.rating,
        content:   body.content.trim(),
        status:  ReviewStatus.APPROVED,
        photos: uploadedPhotos.length
          ? { create: uploadedPhotos.map((p, i) => ({ url: p.url, publicId: p.publicId, sortOrder: i })) }
          : undefined,
      },
      include: { photos: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true } } },
    })
  } catch (err) {
    // Race: hai request tạo review cùng order item lọt qua check ở trên —
    // unique orderItemId chặn ở DB. Dọn ảnh vừa upload để không thành mồ côi.
    if (isPrismaError(err, 'P2002')) {
      uploadedPhotos.forEach((p) => void destroyImage(p.publicId))
      throw new AppError(409, 'Bạn đã đánh giá sản phẩm này rồi')
    }
    throw err
  }
}

async function resolveProductIdFromOrderItem(orderItem: { productName: string; sku: string }) {
  const variant = await prisma.productVariant.findUnique({
    where: { sku: orderItem.sku },
    select: { productId: true },
  })
  if (variant) return variant.productId
  const product = await prisma.product.findFirst({
    where: { name: orderItem.productName },
    select: { id: true },
  })
  if (!product) throw new AppError(400, 'Không xác định được sản phẩm')
  return product.id
}

export async function getMyReviews(userId: string, query: { page?: string; limit?: string }) {
  const { page, limit } = parsePagination(query)
  const where: Prisma.ReviewWhereInput = { userId }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        rating: true,
        content: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        photos:   { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true } },
        product:  { select: { name: true, slug: true, images: { where: { isCover: true }, take: 1, select: { url: true } } } },
        orderItem: { select: { color: true, storage: true, ram: true } },
      },
    }),
    prisma.review.count({ where }),
  ])

  return { reviews, pagination: paginationMeta(page, limit, total) }
}

export async function updateReview(
  userId: string,
  reviewId: string,
  body: UpdateReviewBody,
  files?: Express.Multer.File[]
) {
  const review = await findOwnedReview(userId, reviewId)

  if (Date.now() - review.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw new AppError(400, 'Đã quá 30 ngày, không thể chỉnh sửa đánh giá')
  }

  const data: Prisma.ReviewUpdateInput = { status: ReviewStatus.APPROVED }
  if (body.rating  !== undefined) data.rating  = body.rating
  if (body.content !== undefined) data.content = body.content.trim()

  const uploaded = files?.length
    ? await Promise.all(files.slice(0, MAX_PHOTOS).map((f) => uploadEntityImage(f.buffer, 'reviews')))
    : null

  if (uploaded) {
    data.photos = {
      deleteMany: {},
      create: uploaded.map((p, i) => ({ url: p.url, publicId: p.publicId, sortOrder: i })),
    }
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data,
    include: { photos: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true } } },
  })

  // Chỉ xóa ảnh cũ trên Cloudinary SAU khi update DB thành công — upload hay
  // update fail giữa chừng thì ảnh cũ còn nguyên, không mất dữ liệu oan.
  if (uploaded) review.photos.forEach((p) => void destroyImage(p.publicId))

  return updated
}

export async function deleteMyReview(userId: string, reviewId: string) {
  const review = await findOwnedReview(userId, reviewId)
  await prisma.review.delete({ where: { id: reviewId } })
  review.photos.forEach((p) => void destroyImage(p.publicId))
}

export async function toggleHelpful(userId: string, reviewId: string) {
  const [review, existing] = await Promise.all([
    prisma.review.findUnique({ where: { id: reviewId }, select: { id: true, status: true } }),
    prisma.reviewHelpful.findUnique({ where: { userId_reviewId: { userId, reviewId } } }),
  ])

  if (!review || review.status !== ReviewStatus.APPROVED) {
    throw new AppError(404, 'Đánh giá không tồn tại')
  }

  if (existing) {
    try {
      await prisma.reviewHelpful.delete({ where: { userId_reviewId: { userId, reviewId } } })
    } catch (err) {
      // Race: hai request bỏ vote song song đều thấy bản ghi — request thua
      // nhận P2025, coi như đã bỏ vote thành công (idempotent)
      if (!isPrismaError(err, 'P2025')) throw err
    }
  } else {
    try {
      await prisma.reviewHelpful.create({ data: { userId, reviewId } })
    } catch (err) {
      // Race: hai request vote song song đều thấy chưa vote — request thua nhận
      // P2002 (unique userId+reviewId), coi như đã vote thành công (idempotent)
      if (!isPrismaError(err, 'P2002')) throw err
    }
  }

  const updated = await prisma.review.findUnique({
    where:  { id: reviewId },
    select: { _count: { select: { helpful: true } } },
  })
  return { helpful: !existing, count: updated?._count.helpful ?? 0 }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listReviewsAdmin(query: AdminReviewListQuery) {
  const { page, limit } = parsePagination(query)

  const where: Prisma.ReviewWhereInput = {}
  if (query.status)    where.status    = query.status
  if (query.productId) where.productId = query.productId
  if (query.rating)    where.rating    = Number(query.rating)

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: REVIEW_ADMIN_INCLUDE,
    }),
    prisma.review.count({ where }),
  ])

  return { reviews, pagination: paginationMeta(page, limit, total) }
}

export async function replyReview(reviewId: string, content: string) {
  try {
    // Trả về full review (cùng include như list) để FE replace cả dòng —
    // nhất quán với các mutation khác (toggleStatus/toggleFeatured trả full entity).
    return await prisma.review.update({
      where:  { id: reviewId },
      data:   { replyContent: content.trim(), repliedAt: new Date() },
      include: REVIEW_ADMIN_INCLUDE,
    })
  } catch (err) {
    // WHERE chỉ có khoá chính, nên P2025 ở đây nghĩa là bản ghi không tồn tại
    if (isPrismaError(err, 'P2025')) throw new AppError(404, 'Đánh giá không tồn tại')
    throw err
  }
}

export async function deleteReview(reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { photos: { select: { publicId: true } } },
  })
  if (!review) throw new AppError(404, 'Đánh giá không tồn tại')
  await prisma.review.delete({ where: { id: reviewId } })
  review.photos.forEach((p) => void destroyImage(p.publicId))
}
