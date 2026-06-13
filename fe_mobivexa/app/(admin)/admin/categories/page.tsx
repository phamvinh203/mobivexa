import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminCategoriesPage() {
  return (
    <PagePlaceholder
      title="Quản lý Danh mục"
      endpoint="GET /admin/categories · adminCategoryApi.list()"
      todos={[
        'Bảng danh mục + ảnh + trạng thái',
        'Modal tạo/sửa (adminCategoryApi.create/update — có upload ảnh)',
        'Bật/tắt hiển thị (toggleStatus), xoá (remove)',
      ]}
    />
  )
}
