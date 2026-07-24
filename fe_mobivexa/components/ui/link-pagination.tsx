import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Phân trang bằng <Link> thật — dùng cho trang public render phía server.
 * Khác với Pagination trong ./pagination.tsx (callback onChange, dành cho bảng
 * admin fetch client-side): component này sinh URL nên crawler đọc được, mở tab
 * mới được, và hoạt động cả khi chưa hydrate.
 *
 * Không phụ thuộc vào bất kỳ kiểu filter cụ thể nào — trang gọi tự quyết định
 * URL qua hrefFor, nên dùng lại được cho /products, /categories/[slug],
 * /brands/[slug]...
 */
export interface LinkPaginationProps {
  page: number
  totalPages: number
  /** Sinh href cho 1 số trang. Trang gọi tự quyết giữ lại query nào. */
  hrefFor: (page: number) => string
  /** Số nút trang hiển thị trước khi rút gọn bằng "…" (mặc định 7) */
  maxButtons?: number
  className?: string
}

/** Dãy số trang có rút gọn: 1 … 4 [5] 6 … 12 */
export function pageWindow(
  current: number,
  total: number,
  maxButtons = 7,
): (number | 'gap')[] {
  if (total <= maxButtons) return Array.from({ length: total }, (_, i) => i + 1)

  // Luôn giữ trang đầu/cuối + cửa sổ quanh trang hiện tại để không mất lối
  // nhảy về hai đầu danh sách.
  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)

  const result: (number | 'gap')[] = []
  let previous = 0
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push('gap')
    result.push(page)
    previous = page
  }
  return result
}

const ITEM =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-medium transition-colors'
const IDLE =
  'border-border bg-white text-gray-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
const CURRENT =
  'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
const DISABLED = 'border-border bg-white text-gray-300'

/** Nút lùi/tiến — thành <span> khi đã ở đầu/cuối để không có link chết. */
function StepLink({
  to,
  disabled,
  hrefFor,
  label,
  rel,
  children,
}: {
  to: number
  disabled: boolean
  hrefFor: (page: number) => string
  label: string
  rel: 'prev' | 'next'
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span aria-disabled className={cn(ITEM, DISABLED)}>
        {children}
      </span>
    )
  }
  return (
    <Link href={hrefFor(to)} rel={rel} aria-label={label} className={cn(ITEM, IDLE)}>
      {children}
    </Link>
  )
}

export function LinkPagination({
  page,
  totalPages,
  hrefFor,
  maxButtons,
  className,
}: LinkPaginationProps) {
  if (totalPages <= 1) return null

  const items = pageWindow(page, totalPages, maxButtons)

  return (
    <nav aria-label="Phân trang" className={cn('flex justify-center pt-2', className)}>
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          <StepLink
            to={page - 1}
            disabled={page <= 1}
            hrefFor={hrefFor}
            label="Trang trước"
            rel="prev"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </StepLink>
        </li>

        {items.map((item, i) =>
          item === 'gap' ? (
            <li
              key={`gap-${i}`}
              aria-hidden
              className="px-1 text-sm text-muted-foreground"
            >
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={hrefFor(item)}
                aria-label={`Trang ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={cn(ITEM, item === page ? CURRENT : IDLE)}
              >
                {item}
              </Link>
            </li>
          ),
        )}

        <li>
          <StepLink
            to={page + 1}
            disabled={page >= totalPages}
            hrefFor={hrefFor}
            label="Trang sau"
            rel="next"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </StepLink>
        </li>
      </ul>
    </nav>
  )
}
