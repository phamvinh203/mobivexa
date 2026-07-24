import Link from 'next/link'
import { Smartphone, Sparkles, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const CTA_LINKS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/products', label: 'Tất cả sản phẩm', Icon: Smartphone },
  { href: '/products?tag=moi-nhat', label: 'Hàng mới về', Icon: Sparkles },
  { href: '/products?tag=ban-chay', label: 'Bán chạy', Icon: Trophy },
]

export function CtaStrip() {
  return (
    <section className="bg-[var(--color-ink)] text-white">
      <div className="max-w-[1280px] mx-auto flex flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div>
          <div className="text-sm text-white/60">Cần tư vấn chọn máy?</div>
          <a href="tel:18001234" className="text-2xl font-extrabold text-teal-300 hover:text-teal-200">
            1800&nbsp;1234
          </a>
          <div className="mt-0.5 text-xs text-white/40">Miễn phí · 8:00 – 22:00 hằng ngày</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {CTA_LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
