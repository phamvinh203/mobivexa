import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <PagePlaceholder
      title="Chi tiết người dùng"
      description={`User #${id} — hồ sơ, đơn hàng, đánh giá, hành động quản trị.`}
      endpoint="GET /admin/users/:id · adminUserApi.get(id)"
      todos={['Layout 3 cột: hồ sơ / hoạt động / hành động', 'Khoá-mở-xoá tài khoản']}
    />
  )
}
