'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ClientNavbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const [q, setQ] = useState('')

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    router.push(term ? `/products?search=${encodeURIComponent(term)}` : '/products')
  }

  const isStaff = user?.role === 'ADMIN' || user?.role === 'STAFF'

  return (
    <header className="sticky top-0 z-50">
      {/* ── Utility bar ─────────────────────────────────────────────────── */}
      <div className="bg-ink text-xs text-white/70">
        <div className="mx-auto flex h-9 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <span className="hidden sm:inline">
            🔥 Hàng chính hãng · Bảo hành 12 tháng · Trả góp 0%
          </span>
          <div className="flex items-center gap-4">
            <a href="tel:18001234" className="transition-colors hover:text-white">
              📞 1800&nbsp;1234
            </a>
            <Link href="/orders" className="hidden transition-colors hover:text-white sm:inline">
              Tra cứu đơn hàng
            </Link>
            {isStaff && (
              <Link
                href="/admin"
                className="font-semibold text-[var(--color-highlight)] transition-colors hover:brightness-110"
              >
                ⚙ Quản trị
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Main bar ────────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--color-border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1280px] items-center gap-3 px-4 sm:gap-5 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Mobivexa — Trang chủ">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-accent)] font-black text-white shadow-md shadow-indigo-500/30">
              M
            </span>
            <span className="hidden text-xl font-extrabold tracking-tight text-ink sm:inline">
              Mobi<span className="text-[var(--color-primary)]">vexa</span>
            </span>
          </Link>

          {/* Search */}
          <form onSubmit={onSearch} role="search" className="mx-auto max-w-[560px] flex-1">
            <label htmlFor="navbar-search" className="sr-only">
              Tìm kiếm sản phẩm
            </label>
            <div className="relative">
              <Input
                id="navbar-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                placeholder="Tìm iPhone, Galaxy, Xiaomi..."
                className="h-11 pr-24 rounded-full border-[var(--color-border)] bg-gray-50 focus-visible:bg-white focus-visible:ring-[var(--color-primary)]"
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-1 top-1 h-9 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
              >
                Tìm
              </Button>
            </div>
          </form>

          {/* Phải */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href="/cart"
              aria-label="Giỏ hàng"
              className="hidden sm:inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
            >
              <span className="text-lg" aria-hidden>🛒</span>
              <span className="ml-2">Giỏ hàng</span>
            </Link>
            <Link
              href="/cart"
              aria-label="Giỏ hàng"
              className="sm:inline-flex items-center justify-center rounded-lg p-2 text-gray-700 transition-colors hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
            >
              <span className="text-lg">🛒</span>
            </Link>

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                  >
                    <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-accent)] text-xs font-bold text-white">
                      {user?.fullName?.[0]?.toUpperCase() ?? 'U'}
                    </span>
                    <span className="hidden max-w-28 truncate text-sm font-medium md:inline">
                      {user?.fullName}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm">
                    <div className="truncate font-semibold">{user?.fullName}</div>
                    <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href="/account" className="w-full">👤 Tài khoản của tôi</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/orders" className="w-full">📦 Đơn hàng</Link>
                  </DropdownMenuItem>
                  {isStaff && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Link href="/admin" className="w-full font-medium text-[var(--color-primary)]">
                          ⚙ Trang quản trị
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={logout}
                    className="cursor-pointer"
                  >
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="grid h-9 place-items-center rounded-lg border border-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="hidden h-9 place-items-center rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] sm:grid"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
