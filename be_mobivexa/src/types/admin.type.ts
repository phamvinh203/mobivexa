export interface AdminUserListQuery {
  page?: string
  limit?: string
  search?: string // tìm theo email hoặc fullName
  role?: string   // 'CUSTOMER' | 'ADMIN' | 'STAFF'
  isActive?: string // 'true' | 'false'
}
