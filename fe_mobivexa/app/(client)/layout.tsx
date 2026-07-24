import type { ReactNode } from 'react'
import { ClientNavbar } from '@/components/layout/client-navbar'
import { ClientFooter } from '@/components/layout/client-footer'
import { brandApi } from '@/features/brands/api'

// Layout cho toàn bộ trang khách hàng (public + tài khoản): navbar + footer
export default async function ClientLayout({
  children,
}: {
  children: ReactNode
}) {
  // Gợi ý tìm kiếm lấy từ thương hiệu thật (brandApi cache 5 phút server-side).
  // Hỏng thì search vẫn chạy, chỉ mất phần chip gợi ý.
  const brands = await brandApi.list().catch(() => [])
  const trending = brands
    .filter((b) => b.isActive)
    .slice(0, 8)
    .map((b) => b.name)

  return (
    <div className="flex flex-col min-h-screen">
      <ClientNavbar trending={trending} />
      <main className="flex-1">{children}</main>
      <ClientFooter />
    </div>
  )
}
