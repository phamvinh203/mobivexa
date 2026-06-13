import { http } from '@/lib/api/http'
import type { ListQuery } from '@/types/api'
import type {
  AuthUser,
  Address,
  UpdateProfilePayload,
  ChangePasswordPayload,
  AddressPayload,
  AdminUser,
  UpdateUserRolePayload,
} from './types'

// Khớp src/routes/user.route.ts — prefix /users/me (yêu cầu đăng nhập)
export const userApi = {
  getMe: () => http.get<AuthUser>('/users/me'),

  updateMe: (body: UpdateProfilePayload) =>
    http.put<AuthUser>('/users/me', body),

  changePassword: (body: ChangePasswordPayload) =>
    http.put<{ message: string }>('/users/me/password', body),

  uploadAvatar: (file: File) => {
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

// Khớp src/routes/admin.route.ts — prefix /admin/users (chỉ ADMIN)
export const adminUserApi = {
  list: (query?: ListQuery) =>
    http.get<AdminUser[]>('/admin/users', { params: query }),
  get: (id: string) => http.get<AdminUser>(`/admin/users/${id}`),
  changeRole: (id: string, body: UpdateUserRolePayload) =>
    http.patch<AdminUser>(`/admin/users/${id}/role`, body),
  toggleStatus: (id: string) =>
    http.patch<AdminUser>(`/admin/users/${id}/status`),
  remove: (id: string) =>
    http.delete<{ message: string }>(`/admin/users/${id}`),
}
