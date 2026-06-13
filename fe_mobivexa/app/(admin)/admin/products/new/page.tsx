import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminProductCreatePage() {
  return (
    <PagePlaceholder
      title="Thêm sản phẩm mới"
      endpoint="POST /admin/products · adminProductApi.create()"
      todos={[
        'Form 2 cột: thông tin + ảnh + biến thể',
        'Upload nhiều ảnh (images[]), chọn ảnh bìa',
        'Quản lý biến thể (variants), tags, danh mục, thương hiệu',
      ]}
    />
  )
}
