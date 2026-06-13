import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AdminTagsPage() {
  return (
    <PagePlaceholder
      title="Quản lý Tags"
      endpoint="GET /tags · tagApi.list() | POST,DELETE /admin/tags"
      todos={[
        'Form tạo tag inline (adminTagApi.create)',
        'Lưới chip tags + xoá (adminTagApi.remove)',
      ]}
    />
  )
}
