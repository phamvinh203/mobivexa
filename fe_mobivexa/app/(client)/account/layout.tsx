import type { ReactNode } from 'react'
import Link from 'next/link'
import { RouteGuard } from '@/components/layout/route-guard'

const NAV = [
  { label: 'Thông tin cá nhân', href: '/account' },
  { label: 'Đổi mật khẩu', href: '/account/password' },
  { label: 'Địa chỉ của tôi', href: '/account/addresses' },
  { label: 'Đơn hàng của tôi', href: '/orders' },
  { label: 'Đánh giá của tôi', href: '/account/reviews' },
]

// Khu vực tài khoản: yêu cầu đăng nhập + sidebar điều hướng
export default function AccountLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <RouteGuard>
      <div className="max-w-[1280px] mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <aside className="bg-white rounded-xl border border-[var(--color-border)] p-2 h-fit">
          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </RouteGuard>
  )
}
