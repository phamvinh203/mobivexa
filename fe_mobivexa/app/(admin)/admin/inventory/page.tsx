import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminInventoryPage() {
  return (
    <PagePlaceholder
      title="Quản lý Tồn kho"
      endpoint="GET /admin/inventory · inventoryApi.list()"
      todos={[
        'Bảng biến thể nhóm theo sản phẩm',
        'Tô màu cảnh báo: sắp hết (<10) / hết hàng (=0)',
        'Filter theo tình trạng tồn kho',
      ]}
    />
  )
}
