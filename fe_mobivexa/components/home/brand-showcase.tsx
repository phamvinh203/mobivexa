import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { ProductCard } from '@/components/product/product-card'
import { PromoBanner } from './promo-banner'
import { BrandChips } from './brand-chips'
import type { Product } from '@/features/products/types'
import type { Brand } from '@/features/brands/types'

interface BannerItem {
  src: string
  href: string
  alt: string
}

interface BrandShowcaseProps {
  title: string
  /** Link "Xem tất cả" ở góc tiêu đề */
  href: string
  products: Product[]
  brands: Brand[]
  /** Banner dọc cột trái (1-2 ảnh) */
  banners: BannerItem[]
  /** Class màu thanh accent bên trái tiêu đề */
  barClassName: string
  /** Class màu cho link "Xem tất cả" */
  linkClassName: string
  /** Badge tuỳ chọn cạnh tiêu đề (vd: HOT) */
  badge?: ReactNode
  /** Link cho nút "Xem tất cả" của hàng chip thương hiệu */
  brandsHref?: string
  /** Số sản phẩm hiển thị trong lưới (mặc định 8 = 2 hàng × 4 cột) */
  limit?: number
}

/**
 * Block trưng bày: banner dọc bên trái + hàng chip thương hiệu và lưới sản phẩm bên phải.
 * Tái dùng ProductCard và dữ liệu đã fetch ở homepage.
 */
export function BrandShowcase({
  title,
  href,
  products,
  brands,
  banners,
  barClassName,
  linkClassName,
  badge,
  brandsHref = '/products',
  limit = 8,
}: BrandShowcaseProps) {
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

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Cột trái: banner dọc (ẩn trên mobile) */}
        {banners.length > 0 && (
          <aside className="hidden flex-col gap-4 lg:flex">
            {banners.map((b) => (
              <PromoBanner key={b.src} imageSrc={b.src} href={b.href} alt={b.alt} />
            ))}
          </aside>
        )}

        {/* Cột phải: chip thương hiệu + lưới sản phẩm */}
        <div className="min-w-0 space-y-3">
          <BrandChips brands={brands} allHref={brandsHref} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.slice(0, limit).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
