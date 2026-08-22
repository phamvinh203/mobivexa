import prisma from '../config/db'
import { Prisma, CouponType } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { isPrismaError } from '../helpers/prisma_error'
import { parsePagination, paginationMeta, LIMITS } from '../utils/pagination'
import type { CreateCouponBody, UpdateCouponBody, AdminCouponListQuery } from '../types/coupon.type'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Chuẩn hoá cả lúc ghi lẫn lúc tra. Nhờ vậy @unique trên `code` có tác dụng như
// so sánh không phân biệt hoa thường, mà không cần index biểu thức.
export const normalizeCode = (raw: string) => raw.trim().toUpperCase()

async function findCouponOrThrow(id: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id } })
  if (!coupon) throw new AppError(404, 'Mã giảm giá không tồn tại')
  return coupon
}

// Dựng data cho create/update từ body. Trả về object chỉ chứa field được gửi lên,
// nên dùng chung được cho cả hai (update không đụng field vắng mặt).
function couponData(body: UpdateCouponBody) {
  const data: Prisma.CouponUncheckedUpdateInput = {}

  if (body.code          !== undefined) data.code          = normalizeCode(body.code)
  if (body.description   !== undefined) data.description   = body.description
  if (body.type          !== undefined) data.type          = body.type
  if (body.value         !== undefined) data.value         = body.value
  if (body.maxDiscount   !== undefined) data.maxDiscount   = body.maxDiscount
  if (body.minOrderValue !== undefined) data.minOrderValue = body.minOrderValue
  if (body.usageLimit    !== undefined) data.usageLimit    = body.usageLimit
  if (body.startsAt      !== undefined) data.startsAt      = new Date(body.startsAt)
  if (body.endsAt        !== undefined) data.endsAt        = new Date(body.endsAt)
  if (body.isActive      !== undefined) data.isActive      = body.isActive

  // FIXED không có trần giảm — validator đã chặn việc GỬI maxDiscount kèm FIXED,
  // nhưng đổi type từ PERCENT sang FIXED mà không gửi maxDiscount thì trần cũ vẫn
  // nằm đó. Xoá luôn cho sạch.
  if (body.type === CouponType.FIXED) data.maxDiscount = null

  return data
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listCoupons(query: AdminCouponListQuery) {
  const { page, limit } = parsePagination(query, LIMITS.DEFAULT, LIMITS.MAX)

  const where: Prisma.CouponWhereInput = {}

  // Code luôn viết hoa trong DB nên chuẩn hoá đầu vào rồi so thẳng, không cần
  // mode: 'insensitive' (vốn kéo theo ILIKE và không dùng được index).
  const search = query.search?.trim()
  if (search) where.code = { contains: normalizeCode(search) }

  if (query.isActive === 'true')  where.isActive = true
  if (query.isActive === 'false') where.isActive = false

  const now = new Date()
  switch (query.status) {
    case 'running':
      where.isActive = true
      where.startsAt = { lte: now }
      where.endsAt   = { gte: now }
      break
    case 'scheduled':
      where.startsAt = { gt: now }
      break
    case 'expired':
      where.endsAt = { lt: now }
      break
  }

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: { _count: { select: { usages: true } } },
    }),
    prisma.coupon.count({ where }),
  ])

  return { coupons, pagination: paginationMeta(page, limit, total) }
}

export async function getCouponById(id: string) {
  const coupon = await prisma.coupon.findUnique({
    where:   { id },
    include: { _count: { select: { usages: true } } },
  })
  if (!coupon) throw new AppError(404, 'Mã giảm giá không tồn tại')
  return coupon
}

export async function createCoupon(body: CreateCouponBody) {
  try {
    return await prisma.coupon.create({
      data: couponData(body) as Prisma.CouponUncheckedCreateInput,
    })
  } catch (err) {
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Mã giảm giá đã tồn tại')
    throw err
  }
}

export async function updateCoupon(id: string, body: UpdateCouponBody) {
  await findCouponOrThrow(id)

  try {
    return await prisma.coupon.update({ where: { id }, data: couponData(body) })
  } catch (err) {
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Mã giảm giá đã tồn tại')
    throw err
  }
}

export async function toggleCouponStatus(id: string) {
  const { isActive } = await findCouponOrThrow(id)
  return prisma.coupon.update({ where: { id }, data: { isActive: !isActive } })
}

export async function deleteCoupon(id: string) {
  // Chặn xoá khi đã có người dùng dù onDelete: Cascade sẽ tự dọn — xoá mã đang
  // chạy làm khách đang giữ mã mất mã giữa chừng, và mất luôn khả năng đối chiếu.
  const used = await prisma.couponUsage.count({ where: { couponId: id } })
  if (used > 0) throw new AppError(409, 'Mã đã có người sử dụng, hãy tắt thay vì xoá')

  try {
    await prisma.coupon.delete({ where: { id } })
  } catch (err) {
    if (isPrismaError(err, 'P2025')) throw new AppError(404, 'Mã giảm giá không tồn tại')
    throw err
  }
}
