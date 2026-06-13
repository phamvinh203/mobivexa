const TRUST_ITEMS = [
  ['🚚', 'Giao nhanh 2 giờ', 'Nội thành TP.HCM & HN'],
  ['✅', 'Chính hãng 100%', 'Hoàn tiền nếu phát hiện giả'],
  ['🛡️', 'Bảo hành 12 tháng', '1 đổi 1 trong 30 ngày'],
  ['💳', 'Trả góp 0%', 'Duyệt nhanh trong 5 phút'],
] as const

export function TrustBadges() {
  return (
    <section className="border-b border-border bg-card">
      <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
        {TRUST_ITEMS.map(([icon, title, description]) => (
          <div key={title} className="flex items-center gap-3 px-5 py-3.5">
            <span className="text-2xl">{icon}</span>
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
