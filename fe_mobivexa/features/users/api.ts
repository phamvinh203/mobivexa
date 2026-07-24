import { http } from '@/lib/api/http'
import { assertImageFile } from '@/lib/utils/file'
import type {
  AuthUser,
  Address,
  AvatarUploadResult,
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
    http
      .put<{ message: string; user: AuthUser }>('/users/me', body)
      .then((r) => r.user),

  changePassword: (body: ChangePasswordPayload) =>
    http.put<{ message: string }>('/users/me/password', body),

  // Backend chỉ trả { avatarUrl, avatarPublicId } (select trong uploadAvatar),
  // KHÔNG phải AuthUser đầy đủ.
  uploadAvatar: (file: File) => {
    assertImageFile(file)
    const form = new FormData()
    form.append('avatar', file)
    return http
      .post<{ message: string } & AvatarUploadResult>('/users/me/avatar', form)
      .then(({ avatarUrl, avatarPublicId }) => ({ avatarUrl, avatarPublicId }))
  },

  // Addresses
  listAddresses: () =>
    http
      .get<{ addresses: Address[] }>('/users/me/addresses')
      .then((r) => r.addresses ?? []),
  createAddress: (body: AddressPayload) =>
    http
      .post<{ message: string; address: Address }>('/users/me/addresses', body)
      .then((r) => r.address),
  updateAddress: (id: string, body: AddressPayload) =>
    http
      .put<{ message: string; address: Address }>(`/users/me/addresses/${id}`, body)
      .then((r) => r.address),
  deleteAddress: (id: string) =>
    http.delete<{ message: string }>(`/users/me/addresses/${id}`),
  // Backend chỉ trả { message } — muốn có địa chỉ mới thì gọi lại listAddresses().
  setDefaultAddress: (id: string) =>
    http.patch<{ message: string }>(`/users/me/addresses/${id}/default`),
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
