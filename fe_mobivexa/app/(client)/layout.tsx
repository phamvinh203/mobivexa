import type { ReactNode } from 'react'
import { ClientNavbar } from '@/components/layout/client-navbar'
import { ClientFooter } from '@/components/layout/client-footer'

// Layout cho toàn bộ trang khách hàng (public + tài khoản): navbar + footer
export default function ClientLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <ClientNavbar />
      <main className="flex-1">{children}</main>
      <ClientFooter />
    </div>
  )
}
