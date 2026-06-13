'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth/auth-context'

const CATEGORY_LINKS = [
  { label: 'Điện thoại', slug: 'dien-thoai' },
  { label: 'Laptop', slug: 'laptop' },
  { label: 'Phụ kiện', slug: 'phu-kien' },
  { label: 'Âm thanh', slug: 'am-thanh' },
  { label: 'Máy tính bảng', slug: 'may-tinh-bang' },
  { label: 'Đồng hồ', slug: 'dong-ho' },
]

export function ClientNavbar() {
  const { user, isAuthenticated, logout } = useAuth()

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[var(--color-border)]">
      {/* Hàng chính */}
      <div className="h-[72px] max-w-[1280px] mx-auto px-6 flex items-center gap-6">
        <Link href="/" className="text-2xl font-bold text-[var(--color-primary)]">
          Mobivexa
        </Link>

        {/* Search */}
        <div className="flex-1 max-w-[560px] mx-auto">
          <div className="flex items-center h-11 rounded-full border border-[var(--color-border)] overflow-hidden focus-within:border-[var(--color-primary)]">
            <input
              type="search"
              placeholder="Tìm kiếm sản phẩm, thương hiệu..."
              className="flex-1 px-4 outline-none text-sm bg-transparent"
            />
            <button className="h-full px-5 bg-[var(--color-primary)] text-white text-sm font-medium">
              Tìm
            </button>
          </div>
        </div>

        {/* Phải */}
        <div className="flex items-center gap-4">
          <Link href="/cart" className="text-sm text-gray-700 hover:text-[var(--color-primary)]">
            🛒 Giỏ hàng
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                href="/account"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <span className="w-9 h-9 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] grid place-items-center">
                  {user?.fullName?.[0]?.toUpperCase() ?? 'U'}
                </span>
                <span className="max-w-28 truncate">{user?.fullName}</span>
              </Link>
              <button
                onClick={() => logout()}
                className="text-sm text-[var(--color-danger)]"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="h-9 px-4 grid place-items-center rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-medium"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="h-9 px-4 grid place-items-center rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Hàng phụ — danh mục nhanh */}
      <nav className="h-11 border-t border-[var(--color-border)]">
        <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center gap-8 overflow-x-auto">
          {CATEGORY_LINKS.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="text-sm text-gray-600 hover:text-[var(--color-primary)] whitespace-nowrap"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}
