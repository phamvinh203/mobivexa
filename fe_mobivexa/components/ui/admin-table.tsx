import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Định nghĩa 1 cột: chuỗi đơn giản hoặc object với className tuỳ chỉnh.
 *  Dùng className="text-right" / "text-center" cho cột số/thao tác. */
export type TableColumn = string | { label: string; className?: string }

/**
 * Vỏ bảng dùng chung cho tất cả trang admin list.
 * Bọc: rounded-xl card + tuỳ chọn overflow-x-auto + thead chuẩn + loading/empty rows.
 *
 * Props:
 * - columns     : mảng tiêu đề cột (string | { label, className })
 * - colSpan     : số cột (cho loading/empty row)
 * - loading     : đang tải → hiện "Đang tải..."
 * - empty       : danh sách rỗng → hiện emptyMessage
 * - emptyMessage: thông báo khi không có dữ liệu
 * - scrollable  : thêm div.overflow-x-auto bọc bảng (mặc định false)
 * - footer      : slot footer (thường là <Pagination>), được đặt sau bảng với border-t
 * - children    : các <tr> của tbody (chỉ render khi không loading & không empty)
 */
export function AdminTable({
  columns,
  colSpan,
  loading,
  empty,
  emptyMessage,
  scrollable = false,
  footer,
  children,
}: {
  columns: readonly TableColumn[]
  colSpan: number
  loading: boolean
  empty: boolean
  emptyMessage: string
  scrollable?: boolean
  footer?: ReactNode
  children: ReactNode
}) {
  const table = (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
        <tr>
          {columns.map((col, i) => {
            const label = typeof col === 'string' ? col : col.label
            const cls = typeof col === 'object' ? col.className : undefined
            return (
              <th key={i} className={cn('px-4 py-3 font-medium', cls)}>
                {label}
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {loading ? (
          <tr>
            <td colSpan={colSpan} className="px-4 py-10 text-center text-gray-400">
              Đang tải...
            </td>
          </tr>
        ) : empty ? (
          <tr>
            <td colSpan={colSpan} className="px-4 py-10 text-center text-gray-400">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          children
        )}
      </tbody>
    </table>
  )

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-border">
      {scrollable ? <div className="overflow-x-auto">{table}</div> : table}
      {footer && <div className="border-t">{footer}</div>}
    </div>
  )
}
