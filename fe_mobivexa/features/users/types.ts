import type { UserRole } from '@/types/api'
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
export interface AdminUser extends AuthUser {
  _count?: { orders: number; reviews: number }
}

export interface UpdateUserRolePayload {
  role: UserRole
}
