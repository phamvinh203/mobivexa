import prisma from '../config/db'
import { Prisma, UserRole } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { USER_PUBLIC_SELECT } from './user.service'
import { parsePagination, paginationMeta, LIMITS } from '../utils/pagination'
import type { AdminUserListQuery } from '../types/admin.type'
import { parseSearch } from '../utils/search'

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
  const search = parseSearch(query.search)
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

// Thu hồi mọi refresh token đang hoạt động của user — dùng khi quyền hạn của họ
// vừa đổi (role/status). refreshTokenService chỉ tin vào cờ isRevoked + hạn dùng
// của chính token, KHÔNG đọc lại User mỗi lần refresh — nên nếu không revoke ở
// đây, user vừa bị đổi role/khoá tài khoản vẫn refresh được access token mang
// quyền CŨ cho tới khi refresh token tự hết hạn (tối đa 7 ngày). Access token
// đang cầm (JWT, tối đa 15 phút) vẫn còn hiệu lực tới khi hết hạn — không thể
// thu hồi tức thời vì JWT là stateless, nhưng revoke refresh token chặn được
// việc gia hạn quyền cũ sau đó.
function revokeUserSessions(targetId: string) {
  return prisma.refreshToken.updateMany({
    where: { userId: targetId, isRevoked: false },
    data: { isRevoked: true },
  })
}

export async function updateUserRole(actorId: string, targetId: string, role: string) {
  assertNotSelf(actorId, targetId, 'đổi role')
  // Role đã được validate ở middleware (validateUpdateUserRole) — kiểm tra lại
  // ở đây là phòng thủ lớp 2, đề phòng route/middleware sau này đổi mà bỏ sót.
  if (!VALID_ROLES.has(role as UserRole)) {
    throw new AppError(400, `Role không hợp lệ. Hợp lệ: ${[...VALID_ROLES].join(', ')}`)
  }
  await assertUserExists(targetId)
  // Đổi role + revoke session cũ trong 1 transaction — nếu tách rời, revoke lỗi
  // giữa chừng sẽ để lại đúng lỗ hổng mà thay đổi này sinh ra để vá.
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetId },
      data: { role: role as UserRole },
      select: ADMIN_USER_DETAIL_SELECT,
    }),
    revokeUserSessions(targetId),
  ])
  return user
}

export async function toggleUserStatus(actorId: string, targetId: string) {
  assertNotSelf(actorId, targetId, 'khóa tài khoản')
  const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, isActive: true } })
  if (!user) throw new AppError(404, 'Người dùng không tồn tại')
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetId },
      data: { isActive: !user.isActive },
      select: ADMIN_USER_DETAIL_SELECT,
    }),
    revokeUserSessions(targetId),
  ])
  return updated
}

export async function deleteUser(actorId: string, targetId: string) {
  assertNotSelf(actorId, targetId, 'xóa tài khoản')
  await assertUserExists(targetId)
  await prisma.user.delete({ where: { id: targetId } })
}
