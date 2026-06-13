import Link from 'next/link'
import { ProductCard } from '@/components/product/product-card'
import type { Product } from '@/features/products/types'

interface HotProductsSectionProps {
  products: Product[]
}

export function HotProductsSection({ products }: HotProductsSectionProps) {
  if (products.length === 0) return null

  return (
    <section>
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="block h-6 w-1 rounded-full bg-primary" />
          <h2 className="text-lg font-bold text-gray-800">Điện thoại HOT</h2>
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black leading-none text-white">
            🔥 HOT
          </span>
        </div>
        <Link href="/products?tag=hot" className="text-sm hover:underline text-primary">
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
