'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import { Phone, Settings, ShoppingCart, User, Package } from 'lucide-react'
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
            Hàng chính hãng · Bảo hành 12 tháng · Trả góp 0%
          </span>
          <div className="flex items-center gap-4">
            <a
              href="tel:18001234"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
              1800&nbsp;1234
            </a>
            <Link href="/orders" className="hidden transition-colors hover:text-white sm:inline">
              Tra cứu đơn hàng
            </Link>
            {isStaff && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1 font-semibold text-[var(--color-highlight)] transition-colors hover:brightness-110"
              >
                <Settings className="h-3.5 w-3.5" aria-hidden />
                Quản trị
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Main bar ────────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--color-border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1280px] items-center gap-3 px-4 sm:gap-5 sm:px-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center transition-opacity hover:opacity-90"
            aria-label="Mobivexa — Trang chủ"
          >
            <Image
              src="/mobivexa-logo.png"
              alt="Mobivexa"
              width={129}
              height={36}
              sizes="(max-width: 640px) 116px, 129px"
              className="h-8 w-auto sm:h-9"
              priority
            />
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
              className="inline-flex items-center justify-center rounded-lg p-2 text-gray-700 transition-colors hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] sm:px-3 sm:py-2"
            >
              <ShoppingCart className="h-5 w-5" aria-hidden />
              <span className="ml-2 hidden text-sm font-medium sm:inline">Giỏ hàng</span>
            </Link>

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
                  <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-accent)] text-xs font-bold text-white">
                    {user?.fullName?.[0]?.toUpperCase() ?? 'U'}
                  </span>
                  <span className="hidden max-w-28 truncate text-sm font-medium md:inline">
                    {user?.fullName}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm">
                    <div className="truncate font-semibold">{user?.fullName}</div>
                    <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href="/account" className="flex w-full items-center gap-2">
                      <User className="h-4 w-4" aria-hidden />
                      Tài khoản của tôi
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/orders" className="flex w-full items-center gap-2">
                      <Package className="h-4 w-4" aria-hidden />
                      Đơn hàng
                    </Link>
                  </DropdownMenuItem>
                  {isStaff && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Link
                          href="/admin"
                          className="flex w-full items-center gap-2 font-medium text-[var(--color-primary)]"
                        >
                          <Settings className="h-4 w-4" aria-hidden />
                          Trang quản trị
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
