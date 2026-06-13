import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Về Mobivexa',
    links: [
      { label: 'Giới thiệu', href: '#' },
      { label: 'Tuyển dụng', href: '#' },
      { label: 'Tin công nghệ', href: '#' },
      { label: 'Hệ thống cửa hàng', href: '#' },
    ],
  },
  {
    title: 'Hỗ trợ khách hàng',
    links: [
      { label: 'Hướng dẫn mua hàng', href: '#' },
      { label: 'Tra cứu đơn hàng', href: '/orders' },
      { label: 'Chính sách đổi trả', href: '#' },
      { label: 'Chính sách bảo hành', href: '#' },
    ],
  },
  {
    title: 'Chính sách',
    links: [
      { label: 'Chính sách bảo mật', href: '#' },
      { label: 'Điều khoản sử dụng', href: '#' },
      { label: 'Chính sách trả góp', href: '#' },
      { label: 'Chính sách vận chuyển', href: '#' },
    ],
  },
]

const SOCIAL = [
  { label: 'Facebook', icon: 'f' },
  { label: 'Instagram', icon: '◉' },
  { label: 'YouTube', icon: '▶' },
  { label: 'TikTok', icon: '♪' },
]

export function ClientFooter() {
  return (
    <footer className="mt-auto bg-[#1a1535] text-white/70">
      {/* ── Top: brand + newsletter ──────────────────────────────────────── */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-fuchsia-500 font-black text-white shadow-md shadow-indigo-500/30">
                M
              </span>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Mobi<span className="text-indigo-300">vexa</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-white/50">
              Hệ thống bán lẻ điện thoại chính hãng. Mua sắm thông minh, sống đẹp hơn.
            </p>
          </div>

          <div className="md:max-w-md md:flex-1">
            <h4 className="text-sm font-semibold text-white">Đăng ký nhận khuyến mãi</h4>
            <form className="mt-3 flex overflow-hidden rounded-full border border-white/15 bg-white/[0.06] focus-within:border-indigo-300">
              <Input
                type="email"
                placeholder="Nhập email của bạn"
                className="flex-1 border-0 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                type="submit"
                size="sm"
                className="m-1 h-8 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-fuchsia-500 text-white hover:opacity-90"
              >
                Đăng ký
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Columns ───────────────────────────────────────────────────────── */}
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-8 px-6 py-10 md:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 text-sm font-semibold text-white">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-white/55 transition-colors hover:text-indigo-300"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Liên hệ</h4>
          <ul className="space-y-2.5 text-sm text-white/55">
            <li className="flex items-center gap-2">
              📞{' '}
              <a href="tel:18001234" className="hover:text-indigo-300">
                1800 1234
              </a>
            </li>
            <li className="flex items-center gap-2">✉ support@mobivexa.com</li>
            <li className="flex items-start gap-2">🏢 123 Lê Lợi, Q.1, TP.HCM</li>
          </ul>
          <div className="mt-4 flex gap-2">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                title={s.label}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm text-white/70 transition-colors hover:bg-[var(--color-primary)] hover:text-white"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Trust / payment strip ────────────────────────────────────────── */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-3 px-6 py-4 sm:flex-row">
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
            <span className="flex items-center gap-1.5">
              ✅ Chính hãng 100%
            </span>
            <span className="flex items-center gap-1.5">
              🛡️ Bảo hành 12 tháng
            </span>
            <span className="flex items-center gap-1.5">
              🚚 Giao nhanh 2 giờ
            </span>
          </div>
          <div className="flex items-center gap-2">
            {['VISA', 'MASTERCARD', 'MOMO', 'VNPAY', 'COD'].map((m) => (
              <span
                key={m}
                className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-[#1a1535]"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────── */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[1280px] px-6 py-5 text-center text-xs text-white/40 sm:text-left">
          © {new Date().getFullYear()} Mobivexa. Bảo lưu mọi quyền. · Đồ án tốt nghiệp.
        </div>
      </div>
    </footer>
  )
}
