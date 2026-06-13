import Link from 'next/link'
import { ProductCard } from '@/components/product/product-card'
import type { Product } from '@/features/products/types'

interface FeaturedProductsSectionProps {
  products: Product[]
}

export function FeaturedProductsSection({ products }: FeaturedProductsSectionProps) {
  if (products.length === 0) return null

  return (
    <section>
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="block h-6 w-1 rounded-full bg-[var(--color-sale)]" />
          <h2 className="text-lg font-bold text-gray-800">Sản phẩm nổi bật</h2>
        </div>
        <Link
          href="/products?featured=true"
          className="text-sm hover:underline"
          style={{ color: 'var(--color-sale)' }}
        >
          Xem tất cả →
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {products.slice(0, 10).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
