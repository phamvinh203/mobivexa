import Link from 'next/link'

const COLUMNS = [
  {
    title: 'Về Mobivexa',
    links: ['Giới thiệu', 'Tuyển dụng', 'Tin tức', 'Liên hệ'],
  },
  {
    title: 'Hỗ trợ khách hàng',
    links: [
      'Hướng dẫn mua hàng',
      'Chính sách đổi trả',
      'Chính sách bảo mật',
      'Điều khoản sử dụng',
    ],
  },
]

export function ClientFooter() {
  return (
    <footer className="bg-white border-t border-[var(--color-border)] mt-auto">
      <div className="max-w-[1280px] mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="text-xl font-bold text-[var(--color-primary)]">Mobivexa</div>
          <p className="mt-2 text-sm text-gray-500">
            Mua sắm thông minh, sống đẹp hơn.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="font-semibold text-sm mb-3">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l}>
                  <Link href="#" className="text-sm text-gray-500 hover:text-[var(--color-primary)]">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4 className="font-semibold text-sm mb-3">Liên hệ</h4>
          <ul className="space-y-2 text-sm text-gray-500">
            <li>📞 Hotline: 1800 xxxx</li>
            <li>✉ support@mobivexa.com</li>
            <li>🏢 123 Lê Lợi, Q.1, TP.HCM</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)]">
        <div className="max-w-[1280px] mx-auto px-6 py-6 text-sm text-gray-500">
          © 2024 Mobivexa. Bảo lưu mọi quyền.
        </div>
      </div>
    </footer>
  )
}
