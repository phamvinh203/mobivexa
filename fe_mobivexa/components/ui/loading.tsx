import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * Loading component với nhiều variant cho các use case khác nhau.
 * Được thiết kế để sử dụng thay thế cho các loading pattern thủ công.
 */

type LoadingSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_MAP: Record<LoadingSize, string> = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border',
  md: 'h-5 w-5 border-2',
  lg: 'h-6 w-6 border-2',
}

// ─── Spinner component ─────────────────────────────────────────────────────

export function Spinner({
  size = 'md',
  className,
}: {
  size?: LoadingSize
  className?: string
}) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-[var(--color-primary)] border-t-transparent',
        SIZE_MAP[size],
        className,
      )}
    />
  )
}

// ─── Full page loading (card-based) ─────────────────────────────────────────────

interface FullPageProps {
  message?: string
  className?: string
}

/**
 * Loading cho toàn bộ page / card lớn.
 * Hiện spinner + message ở giữa card với background trắng.
 */
export function FullPage({ message = 'Đang tải...', className }: FullPageProps) {
  return (
    <div className={cn('rounded-xl bg-white px-4 py-10 text-center text-sm text-gray-400 ring-1 ring-border', className)}>
      <div className="flex flex-col items-center gap-2">
        <Spinner size="md" />
        {message}
      </div>
    </div>
  )
}

// ─── Inline loading (compact) ─────────────────────────────────────────────────────

interface InlineProps {
  message?: string
  size?: LoadingSize
  className?: string
}

/**
 * Loading nhỏ gọn, inline với text.
 * Dùng cho: table cells, buttons, inline forms.
 */
export function Inline({ message, size = 'sm', className }: InlineProps) {
  return (
    <div className={cn('flex items-center gap-2 text-sm text-gray-400', className)}>
      <Spinner size={size} />
      {message && <span>{message}</span>}
    </div>
  )
}

// ─── Table row loading ─────────────────────────────────────────────────────────────

interface TableRowProps {
  colSpan: number
  message?: string
  className?: string
}

/**
 * Loading cho row trong bảng.
 * Dùng thay thế pattern thủ công trong AdminTable.
 */
export function TableRow({ colSpan, message = 'Đang tải...', className }: TableRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn('px-4 py-14 text-center text-sm text-gray-400', className)}>
        <div className="flex flex-col items-center gap-2">
          <Spinner size="md" />
          {message}
        </div>
      </td>
    </tr>
  )
}

// ─── Centered (flex container) ─────────────────────────────────────────────────────

interface CenteredProps {
  message?: string
  size?: LoadingSize
  className?: string
  children?: ReactNode
}

/**
 * Loading ở giữa container flex.
 * Dùng khi cần custom layout nhưng vẫn muốn loading ở giữa.
 */
export function Centered({ message, size = 'md', className, children }: CenteredProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 text-sm text-gray-400', className)}>
      <Spinner size={size} />
      {message && <span>{message}</span>}
      {children}
    </div>
  )
}

// ─── Overlay (modal/dialog overlay) ───────────────────────────────────────────────

interface OverlayProps {
  message?: string
  className?: string
}

/**
 * Loading overlay cho modal/dialog hoặc khi chặn user interaction.
 */
export function Overlay({ message = 'Đang xử lý...', className }: OverlayProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm',
        className,
      )}
    >
      <div className="rounded-xl bg-white px-6 py-4 text-center shadow-lg ring-1 ring-border">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <span className="text-sm font-medium text-gray-700">{message}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton (placeholder shimmer) ───────────────────────────────────────────────

interface SkeletonProps {
  className?: string
}

/**
 * Skeleton placeholder cho content đang tải.
 * Dùng cho: cards, list items, avatar placeholders.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className,
      )}
    />
  )
}

// ─── Combined exports ─────────────────────────────────────────────────────────────

/**
 * Loading component chính.
 * Sử dụng destructuring để chọn variant cần thiết:
 * ```tsx
 * import { Loading } from '@/components/ui/loading'
 *
 * <Loading.FullPage message="Đang tải dữ liệu..." />
 * <Loading.Inline message="Đang tải..." size="sm" />
 * <Loading.TableRow colSpan={6} />
 * ```
 */
export const Loading = {
  FullPage,
  Inline,
  TableRow,
  Centered,
  Overlay,
  Skeleton,
  Spinner,
}

// Export Spinner as default cho backward compatibility
export default Spinner
