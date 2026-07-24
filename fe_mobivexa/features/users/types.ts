import { UserRole, type ListQuery, type PaginationMeta } from '@/types/api'
import type { AuthUser } from '../auth/types'

export type { AuthUser }

export interface Address {
  id: string
  userId: string
  fullName: string
  phone: string
  province: string
  district: string
  ward: string
  streetDetail: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

/** Kết quả POST /users/me/avatar — backend select đúng 2 field này,
 *  không trả về user đầy đủ (xem uploadAvatar trong user.service.ts). */
export interface AvatarUploadResult {
  avatarUrl: string
  avatarPublicId: string
}

export interface UpdateProfilePayload {
  fullName?: string
  phone?: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface AddressPayload {
  fullName: string
  phone: string
  province: string
  district: string
  ward: string
  streetDetail: string
  isDefault?: boolean
}

// ── Admin: quản lý người dùng ────────────────────────────────────────────────

/** Metadata hiển thị cho từng role — nhãn tiếng Việt + class màu badge.
 *  Gom cùng chỗ để thêm role mới chỉ sửa một nơi (khớp pattern BANNER_POSITION_META). */
export const USER_ROLES = Object.values(UserRole)

export const USER_ROLE_META: Record<UserRole, { label: string; badgeClass: string }> = {
  CUSTOMER: { label: 'Khách hàng', badgeClass: 'bg-gray-100 text-gray-700' },
  STAFF: { label: 'Nhân viên', badgeClass: 'bg-sky-100 text-sky-700' },
  ADMIN: { label: 'Quản trị viên', badgeClass: 'bg-purple-100 text-purple-700' },
}

/** Kết quả GET /admin/users — paginated */
export interface AdminUserListResult {
  users: AdminUser[]
  pagination: PaginationMeta
}

// Extend ListQuery để có index signature [key: string] — cần cho http.get params
export interface AdminUserListQuery extends ListQuery {
  role?: UserRole
  isActive?: boolean
}

/** User detail có thêm _count (addresses, refreshTokens) */
export interface AdminUser extends AuthUser {
  _count?: { addresses?: number; refreshTokens?: number; orders?: number; reviews?: number }
}

export interface UpdateUserRolePayload {
  role: UserRole
}
