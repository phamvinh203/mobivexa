import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminBrandsPage() {
  return (
    <PagePlaceholder
      title="Quản lý Thương hiệu"
      endpoint="GET /admin/brands · adminBrandApi.list()"
      todos={[
        'Bảng thương hiệu + logo + trạng thái',
        'Modal tạo/sửa (adminBrandApi.create/update — upload logo)',
        'Bật/tắt (toggleStatus), xoá (remove)',
      ]}
    />
  )
}
