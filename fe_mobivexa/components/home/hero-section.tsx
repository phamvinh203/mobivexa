import Link from 'next/link'
import Image from 'next/image'
import { Smartphone } from 'lucide-react'
import { formatVND } from '@/lib/utils/format'
import type { Product } from '@/features/products/types'
import { coverImageUrl } from '@/features/products/utils'

interface HeroSectionProps {
  products: Product[]
}

export function HeroSection({ products }: HeroSectionProps) {
  const heroProducts = products.slice(0, 3)

  return (
    <section className="relative overflow-hidden bg-[#1a1535] text-white">
      {/* gradient mesh + glow orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-16 h-96 w-96 rounded-full bg-[var(--color-primary)] opacity-40 blur-[120px]" />
        <div className="absolute top-10 right-0 h-80 w-80 rounded-full bg-fuchsia-500 opacity-30 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-400 opacity-20 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
      </div>

      <div className="relative max-w-[1280px] mx-auto px-6 py-12 md:py-16 grid md:grid-cols-2 gap-10 items-center">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Siêu sale tháng 6 · Trả góp 0%
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
            Công nghệ đỉnh cao,
            <br />
            <span className="bg-gradient-to-r from-amber-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
              trong tầm tay bạn.
            </span>
          </h1>
          <p className="text-white/70 max-w-md text-sm md:text-base">
            Điện thoại chính hãng từ Apple, Samsung, Xiaomi và hơn thế. Bảo hành 12 tháng, giao
            nhanh 2 giờ nội thành.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#1a1535] shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-white/90"
            >
              Mua sắm ngay
            </Link>
            <Link
              href="/products?tag=giam-gia"
              className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              Xem khuyến mãi
            </Link>
          </div>
          <div className="flex gap-8 pt-3">
            {[
              ['11+', 'Thương hiệu'],
              ['70+', 'Sản phẩm'],
              ['2h', 'Giao nhanh'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-2xl font-extrabold">{n}</div>
                <div className="text-[11px] uppercase tracking-wider text-white/50">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Showcase sản phẩm nổi bật */}
        {heroProducts.length > 0 && (
          <div className="relative hidden md:grid grid-cols-3 gap-3">
            {heroProducts.map((p, i) => {
              const cover = coverImageUrl(p)
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  className={`group rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm transition-all hover:bg-white/15 ${
                    i === 1 ? '-translate-y-5' : 'translate-y-2'
                  }`}
                >
                  <div className="relative aspect-square">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={p.name}
                        fill
                        sizes="160px"
                        className="object-contain transition-transform group-hover:scale-110"
                      />
                    ) : (
                      <div className="grid h-full place-items-center">
                        <Smartphone className="h-8 w-8 text-white/40" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 line-clamp-1 text-[11px] font-semibold text-white/90">
                    {p.name}
                  </div>
                  {p.variants?.[0] && (
                    <div className="text-[11px] font-bold text-amber-300">
                      {formatVND(p.variants[0].salePrice)}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
