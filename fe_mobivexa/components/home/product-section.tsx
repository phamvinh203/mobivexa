import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { ProductCard } from '@/components/product/product-card'
import type { Product } from '@/features/products/types'

interface ProductSectionProps {
  title: string
  /** Link "Xem tất cả" ở góc tiêu đề */
  href: string
  products: Product[]
  /** Class màu cho thanh accent bên trái tiêu đề */
  barClassName: string
  /** Class màu cho link "Xem tất cả" */
  linkClassName: string
  /** Badge tuỳ chọn cạnh tiêu đề (vd: HOT) */
  badge?: ReactNode
  /** Nếu có, hiển thị nút "Xem thêm" ở cuối section, trỏ tới link này */
  moreHref?: string
}

/** Section lưới sản phẩm dùng chung cho homepage (nổi bật, HOT, ...). Hiển thị tối đa 10 sản phẩm. */
export function ProductSection({
  title,
  href,
  products,
  barClassName,
  linkClassName,
  badge,
  moreHref,
}: ProductSectionProps) {
  if (products.length === 0) return null

  return (
    <section>
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`block h-6 w-1 rounded-full ${barClassName}`} />
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          {badge}
        </div>
        <Link
          href={href}
          className={`inline-flex items-center gap-0.5 text-sm hover:underline ${linkClassName}`}
        >
          Xem tất cả
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {products.slice(0, 10).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {moreHref && (
        <div className="mt-5 flex justify-center">
          <Link
            href={moreHref}
            className={`inline-flex items-center gap-1.5 rounded-full border border-border px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-gray-50 ${linkClassName}`}
          >
            Xem thêm
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  )
}
