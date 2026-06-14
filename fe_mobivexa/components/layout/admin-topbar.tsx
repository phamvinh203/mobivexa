'use client'

import { Bell } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'

export function AdminTopbar() {
  const { user, logout } = useAuth()

  return (
    <header className="fixed top-0 left-60 right-0 h-16 z-40 bg-white border-b border-[var(--color-border)] flex items-center px-6 gap-4">
      <div className="font-bold text-lg">
        Mobivexa <span className="text-[var(--color-primary)]">Admin</span>
      </div>

      <div className="flex-1 max-w-[480px]">
        <input
          type="search"
          placeholder="Tìm kiếm đơn hàng, người dùng, sản phẩm..."
          className="w-full h-9 px-3 rounded-lg bg-gray-50 border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      <div className="ml-auto flex items-center gap-4">
        <button className="relative text-gray-600" aria-label="Thông báo">
          <Bell className="h-5 w-5" aria-hidden />
        </button>
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] grid place-items-center text-sm font-semibold">
            {user?.fullName?.[0]?.toUpperCase() ?? 'A'}
          </span>
          <button onClick={() => logout()} className="text-sm text-[var(--color-danger)]">
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  )
}
