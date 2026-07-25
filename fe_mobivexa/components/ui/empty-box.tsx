import type { ReactNode } from 'react'
import { PackageSearch } from 'lucide-react'

/** Khối trạng thái rỗng dùng chung cho các trang duyệt sản phẩm/danh mục/thương hiệu. */
export function EmptyBox({
  title,
  hint,
  action,
}: {
  title: string
  hint: string
  action?: ReactNode
}) {
  return (
    <div className="grid place-items-center gap-2 rounded-2xl border border-border bg-white py-16 text-center">
      <PackageSearch className="h-9 w-9 text-muted-foreground" aria-hidden />
      <p className="font-semibold text-gray-800">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
      {action}
    </div>
  )
}
