'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { UserRole } from '@/types/api'

interface NavItem {
  label: string
  href: string
  icon: string
  adminOnly?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    title: 'TỔNG QUAN',
    items: [{ label: 'Dashboard', href: '/admin', icon: '🏠' }],
  },
  {
    title: 'DANH MỤC',
    items: [
      { label: 'Người dùng', href: '/admin/users', icon: '👥', adminOnly: true },
      { label: 'Danh mục', href: '/admin/categories', icon: '🗂' },
      { label: 'Thương hiệu', href: '/admin/brands', icon: '🏷' },
      { label: 'Tags', href: '/admin/tags', icon: '🔖' },
    ],
  },
  {
    title: 'SẢN PHẨM',
    items: [
      { label: 'Sản phẩm', href: '/admin/products', icon: '📦' },
      { label: 'Tồn kho', href: '/admin/inventory', icon: '📊' },
    ],
  },
  {
    title: 'BÁN HÀNG',
    items: [
      { label: 'Đơn hàng', href: '/admin/orders', icon: '🛒' },
      { label: 'Thanh toán', href: '/admin/payment', icon: '💳' },
      { label: 'Đánh giá', href: '/admin/reviews', icon: '⭐' },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const isAdmin = user?.role === UserRole.ADMIN

  return (
    <aside className="fixed top-0 left-0 w-60 h-screen bg-[var(--color-admin-sidebar)] text-gray-300 flex flex-col overflow-y-auto">
      {/* User */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-[var(--color-primary)] text-white grid place-items-center font-semibold">
            {user?.fullName?.[0]?.toUpperCase() ?? 'A'}
          </span>
          <div>
            <div className="text-white text-sm font-bold">{user?.fullName ?? 'Admin'}</div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white">
              {user?.role ?? 'STAFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2">
        {NAV.map((group) => (
          <div key={group.title} className="mt-4">
            <p className="px-3.5 py-2 text-[11px] uppercase tracking-wider text-gray-500">
              {group.title}
            </p>
            {group.items
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => {
                const active =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-[var(--color-primary)] text-white border-l-2 border-indigo-300'
                        : 'text-gray-400 hover:bg-[var(--color-admin-sidebar-hover)] hover:text-white'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 text-xs text-gray-500">
        <div>v1.0.0</div>
        <Link href="/" className="hover:text-white">
          🌐 Xem trang khách hàng ↗
        </Link>
      </div>
    </aside>
  )
}
