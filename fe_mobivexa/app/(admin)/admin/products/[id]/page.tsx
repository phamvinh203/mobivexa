import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <PagePlaceholder
      title="Chỉnh sửa sản phẩm"
      description={`Sản phẩm #${id}`}
      endpoint="PUT /admin/products/:id · adminProductApi.update()"
      todos={[
        'Form sửa thông tin + ảnh + biến thể',
        'CRUD ảnh (uploadImages/removeImage/setCover)',
        'CRUD biến thể + cập nhật tồn kho (updateStock)',
      ]}
    />
  )
}
