import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminUsersPage() {
  return (
    <PagePlaceholder
      title="Quản lý Người dùng"
      description="Chỉ ADMIN. Danh sách, đổi role, khoá/mở, xoá người dùng."
      endpoint="GET /admin/users · adminUserApi.list()"
      todos={[
        'Bảng users + filter role/status (adminUserApi.list)',
        'Modal đổi role (adminUserApi.changeRole)',
        'Khoá/mở tài khoản (adminUserApi.toggleStatus)',
      ]}
    />
  )
}
