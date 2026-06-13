import { productApi } from '@/features/products/api'
import { ProductCard } from '@/components/product/product-card'
import type { Product } from '@/features/products/types'

// Server Component: fetch sản phẩm nổi bật ngay trên server (endpoint public)
export default async function HomePage() {
  let featured: Product[] = []
  try {
    featured = await productApi.featured()
  } catch {
    // Backend chưa chạy → render trang rỗng thay vì crash
    featured = []
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-[#080810] text-white">
        <div className="max-w-[1280px] mx-auto px-6 py-20">
          <p className="text-xs uppercase tracking-widest text-indigo-400">
            Bộ sưu tập mới — 2024
          </p>
          <h1 className="mt-4 text-5xl font-bold leading-tight">
            Điện thoại đỉnh nhất.
            <br />
            Giá tốt nhất.
          </h1>
          <p className="mt-4 text-white/60 max-w-md">
            Tất cả thương hiệu lớn. Hàng chính hãng. Giao trong 2 giờ tại nội thành.
          </p>
        </div>
      </section>

      {/* Featured */}
      <section className="max-w-[1280px] mx-auto px-6 py-12">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl font-bold">Sản phẩm nổi bật</h2>
          <a href="/products" className="text-sm text-[var(--color-primary)]">
            Xem tất cả →
          </a>
        </div>

        {featured.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            Chưa có sản phẩm nổi bật. (Kiểm tra backend ở {process.env.NEXT_PUBLIC_API_URL})
          </div>
        )}
      </section>
    </div>
  )
}
