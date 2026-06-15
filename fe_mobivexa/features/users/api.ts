import { http } from '@/lib/api/http'
import { assertImageFile } from '@/lib/utils/file'
import type {
  AuthUser,
  Address,
  UpdateProfilePayload,
  ChangePasswordPayload,
  AddressPayload,
  AdminUser,
  AdminUserListQuery,
  AdminUserListResult,
  UpdateUserRolePayload,
} from './types'

// Khớp src/routes/user.route.ts — prefix /users/me (yêu cầu đăng nhập)
export const userApi = {
  getMe: () => http.get<{ user: AuthUser }>('/users/me').then((r) => r.user),

  updateMe: (body: UpdateProfilePayload) =>
    http.put<AuthUser>('/users/me', body),

  changePassword: (body: ChangePasswordPayload) =>
    http.put<{ message: string }>('/users/me/password', body),

  uploadAvatar: (file: File) => {
    assertImageFile(file)
    const form = new FormData()
    form.append('avatar', file)
    return http.post<AuthUser>('/users/me/avatar', form)
  },

  // Addresses
  listAddresses: () => http.get<Address[]>('/users/me/addresses'),
  createAddress: (body: AddressPayload) =>
    http.post<Address>('/users/me/addresses', body),
  updateAddress: (id: string, body: AddressPayload) =>
    http.put<Address>(`/users/me/addresses/${id}`, body),
  deleteAddress: (id: string) =>
    http.delete<{ message: string }>(`/users/me/addresses/${id}`),
  setDefaultAddress: (id: string) =>
    http.patch<Address>(`/users/me/addresses/${id}/default`),
}

// Khớp src/routes/admin.route.ts — prefix /admin/users (chỉ ADMIN).
// Backend bọc { users, pagination } / { user } → unwrap tại đây.
export const adminUserApi = {
  list: (query?: AdminUserListQuery) =>
    http.get<AdminUserListResult>('/admin/users', { params: query }),

  get: (id: string) =>
    http.get<{ user: AdminUser }>(`/admin/users/${id}`).then((r) => r.user),

  changeRole: (id: string, body: UpdateUserRolePayload) =>
    http.patch<{ user: AdminUser }>(`/admin/users/${id}/role`, body).then((r) => r.user),

  toggleStatus: (id: string) =>
    http.patch<{ user: AdminUser }>(`/admin/users/${id}/status`).then((r) => r.user),

  remove: (id: string) =>
    http.delete<{ message: string }>(`/admin/users/${id}`),
}
