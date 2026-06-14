import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { PaginationMeta } from '@/types/api'

/**
 * Footer phân trang dùng chung cho các bảng admin.
 * - Khi dùng bên trong AdminTable → truyền className="" (mặc định, có border-t qua footer slot).
 * - Khi dùng standalone (ví dụ reviews) → truyền className="rounded-xl bg-white ring-1 ring-border".
 * Trả về null nếu totalPages <= 1.
 */
export function Pagination({
  meta,
  loading,
  emptyLabel,
  onChange,
  className,
}: {
  meta: PaginationMeta
  loading: boolean
  emptyLabel: string
  onChange: (page: number) => void
  className?: string
}) {
  if (meta.totalPages <= 1) return null

  const rangeLabel =
    meta.total === 0
      ? emptyLabel
      : `${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} / ${meta.total}`

  return (
    <div
      className={cn('flex items-center justify-between px-4 py-3 text-sm', className)}
    >
      <span className="text-gray-500">{rangeLabel}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1 || loading}
          onClick={() => onChange(Math.max(1, meta.page - 1))}
        >
          Trước
        </Button>
        <span className="px-2 text-gray-600">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.totalPages || loading}
          onClick={() => onChange(meta.page + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  )
}
