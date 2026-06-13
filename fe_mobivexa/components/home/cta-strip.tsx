import Link from 'next/link'

const CTA_LINKS = [
  ['/products', '📱 Tất cả sản phẩm'],
  ['/products?tag=moi-nhat', '✨ Hàng mới về'],
  ['/products?tag=ban-chay', '🏆 Bán chạy'],
] as const

export function CtaStrip() {
  return (
    <section className="bg-[#1a1535] text-white">
      <div className="max-w-[1280px] mx-auto flex flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div>
          <div className="text-sm text-white/60">Cần tư vấn chọn máy?</div>
          <a href="tel:18001234" className="text-2xl font-extrabold text-amber-300 hover:text-amber-200">
            1800&nbsp;1234
          </a>
          <div className="mt-0.5 text-xs text-white/40">Miễn phí · 8:00 – 22:00 hằng ngày</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {CTA_LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center justify-center rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
