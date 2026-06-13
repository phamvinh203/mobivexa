import type { ReactNode } from 'react'
import Link from 'next/link'

// Layout tối giản cho các trang xác thực: chỉ logo + nội dung canh giữa
export default function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <header className="h-16 flex items-center px-6">
        <Link href="/" className="text-xl font-bold text-[var(--color-primary)]">
          Mobivexa
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-4 py-8">{children}</main>
    </div>
  )
}
