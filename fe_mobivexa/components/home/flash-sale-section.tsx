import Link from 'next/link'
import Image from 'next/image'
import { Zap, ChevronRight, Smartphone } from 'lucide-react'
import { CountdownTimer } from './countdown-timer'
import { formatVND, discountPercent } from '@/lib/utils/format'
import type { Product } from '@/features/products/types'
import { coverImageUrl } from '@/features/products/utils'

interface FlashSaleSectionProps {
  products: Product[]
  endTime: number
}

export function FlashSaleSection({ products, endTime }: FlashSaleSectionProps) {
  if (products.length === 0) return null

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
      {/* Header với gradient */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#ff7a18] via-[var(--color-sale)] to-[var(--color-sale-strong)] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-lg font-extrabold uppercase tracking-tight text-white drop-shadow">
            <Zap className="h-5 w-5 fill-white" aria-hidden />
            Flash Sale
          </span>
          <div className="hidden items-center gap-2 text-xs font-medium text-white/90 sm:flex">
            Kết thúc sau
            <CountdownTimer endTime={endTime} />
          </div>
        </div>
        <Link
          href="/products?tag=giam-gia"
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-white/90 hover:text-white"
        >
          Xem tất cả
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {/* Product list */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 p-4" style={{ width: 'max-content' }}>
          {products.map((p) => {
            const v = p.variants?.[0]
            const disc = v ? discountPercent(v.originalPrice, v.salePrice) : 0
            const cover = coverImageUrl(p)

            return (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="group w-[150px] flex-shrink-0 overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-[var(--color-sale)]/50 hover:shadow-md"
              >
                <div className="relative grid h-[130px] place-items-center bg-muted">
                  {disc > 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-[var(--color-sale-strong)] px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                      -{disc}%
                    </span>
                  )}
                  {cover ? (
                    <Image
                      src={cover}
                      alt={p.name}
                      fill
                      sizes="150px"
                      className="object-contain p-3 transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <Smartphone className="h-8 w-8 text-muted-foreground" aria-hidden />
                  )}
                </div>

                <div className="p-2.5">
                  <div className="line-clamp-2 min-h-[32px] text-[11px] font-semibold leading-tight">
                    {p.name}
                  </div>
                  {v && (
                    <div className="mt-1.5">
                      <div className="text-xs font-black text-[var(--color-sale-strong)]">
                        {formatVND(v.salePrice)}
                      </div>
                      {disc > 0 && (
                        <div className="text-[10px] text-muted-foreground line-through">
                          {formatVND(v.originalPrice)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
