import { Truck, BadgeCheck, ShieldCheck, CreditCard } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const TRUST_ITEMS: { Icon: LucideIcon; title: string; description: string }[] = [
  { Icon: Truck, title: 'Giao nhanh 2 giờ', description: 'Nội thành TP.HCM & HN' },
  { Icon: BadgeCheck, title: 'Chính hãng 100%', description: 'Hoàn tiền nếu phát hiện giả' },
  { Icon: ShieldCheck, title: 'Bảo hành 12 tháng', description: '1 đổi 1 trong 30 ngày' },
  { Icon: CreditCard, title: 'Trả góp 0%', description: 'Duyệt nhanh trong 5 phút' },
]

export function TrustBadges() {
  return (
    <section className="border-b border-border bg-card">
      <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
        {TRUST_ITEMS.map(({ Icon, title, description }) => (
          <div key={title} className="flex items-center gap-3 px-5 py-3.5">
            <Icon className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-gray-800">{title}</div>
              <div className="truncate text-[11px] text-gray-500">{description}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
