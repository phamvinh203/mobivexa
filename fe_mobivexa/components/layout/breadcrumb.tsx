import Link from 'next/link'
import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  /** Không có href = mục hiện tại (không bấm được) */
  href?: string
}

/** Breadcrumb dùng chung cho các trang client (sản phẩm, danh mục, thương hiệu). */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            <li
              {...(item.href ? {} : { 'aria-current': 'page' as const })}
              className={item.href ? undefined : 'font-medium text-gray-700'}
            >
              {item.href ? (
                <Link href={item.href} className="hover:text-[var(--color-primary)]">
                  {item.label}
                </Link>
              ) : (
                item.label
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
