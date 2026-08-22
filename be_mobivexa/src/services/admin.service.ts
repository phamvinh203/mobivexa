import prisma from '../config/db'
import { Prisma, UserRole } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { USER_PUBLIC_SELECT } from './user.service'
import { parsePagination, paginationMeta, LIMITS } from '../utils/pagination'
import type { AdminUserListQuery } from '../types/admin.type'

// Set cho O(1) lookup — không tái tính mỗi request
const VALID_ROLES = new Set(Object.values(UserRole))

// List: không cần _count (tránh 2 COUNT subquery/row trên danh sách lớn)
const ADMIN_USER_LIST_SELECT = USER_PUBLIC_SELECT

// Detail: kèm thêm count để admin xem tổng địa chỉ, token
const ADMIN_USER_DETAIL_SELECT = {
  ...USER_PUBLIC_SELECT,
  _count: { select: { addresses: true, refreshTokens: true } },
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertNotSelf(actorId: string, targetId: string, action: string) {
  if (actorId === targetId) throw new AppError(400, `Không thể ${action} của chính mình`)
}

// Kiểm tra tồn tại — dùng khi chỉ cần throw 404, không cần dữ liệu
async function assertUserExists(id: string) {
  const found = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!found) throw new AppError(404, 'Người dùng không tồn tại')
}

export async function findUserOrThrow(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: ADMIN_USER_DETAIL_SELECT })
  if (!user) throw new AppError(404, 'Người dùng không tồn tại')
  return user
}

// ─── Admin services ──────────────────────────────────────────────────────────

export async function listUsers(query: AdminUserListQuery) {
  const { page, limit } = parsePagination(query, LIMITS.INVENTORY, LIMITS.MAX_INVENTORY)

  const where: Prisma.UserWhereInput = {}
  // Trim trước khi lọc, giống listOrders: ô tìm kiếm chỉ có khoảng trắng phải
  // coi như không lọc, chứ không phải lọc theo ' ' rồi ra danh sách vô nghĩa.
  const search = query.search?.trim()
  if (search) {
    where.OR = [
      { email:    { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (query.role && VALID_ROLES.has(query.role as UserRole)) {
    where.role = query.role as UserRole
  }
  if (query.isActive !== undefined) {
    where.isActive = query.isActive === 'true'
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: ADMIN_USER_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return {
    users,
    pagination: paginationMeta(page, limit, total),
  }
}

export async function updateUserRole(actorId: string, targetId: string, role: string) {
  assertNotSelf(actorId, targetId, 'đổi role')
  // role đã được validate ở middleware — chỉ cần kiểm tra user tồn tại
  await assertUserExists(targetId)
  return prisma.user.update({
    where: { id: targetId },
    data: { role: role as UserRole },
    select: ADMIN_USER_DETAIL_SELECT,
  })
}

export async function toggleUserStatus(actorId: string, targetId: string) {
  assertNotSelf(actorId, targetId, 'khóa tài khoản')
  const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, isActive: true } })
  if (!user) throw new AppError(404, 'Người dùng không tồn tại')
  return prisma.user.update({
    where: { id: targetId },
    data: { isActive: !user.isActive },
    select: ADMIN_USER_DETAIL_SELECT,
  })
}

export async function deleteUser(actorId: string, targetId: string) {
  assertNotSelf(actorId, targetId, 'xóa tài khoản')
  await assertUserExists(targetId)
  await prisma.user.delete({ where: { id: targetId } })
}
