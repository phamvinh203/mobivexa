import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminProductsPage() {
  return (
    <PagePlaceholder
      title="Quản lý Sản phẩm"
      endpoint="GET /products · productApi.list() | /admin/products"
      todos={[
        'Bảng sản phẩm + filter danh mục/thương hiệu/trạng thái',
        'Toggle nổi bật (toggleFeatured) & trạng thái (toggleStatus)',
        'Link tới trang Thêm/Sửa sản phẩm',
      ]}
    />
  )
}
