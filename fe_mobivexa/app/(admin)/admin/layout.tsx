import type { ReactNode } from 'react'
import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { AdminTopbar } from '@/components/layout/admin-topbar'
import { RouteGuard } from '@/components/layout/route-guard'
import { UserRole } from '@/types/api'

// Layout dashboard quản trị: chỉ STAFF + ADMIN. Sidebar tối + topbar cố định.
export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <RouteGuard roles={[UserRole.STAFF, UserRole.ADMIN]}>
      <div className="min-h-screen bg-[#f3f4f6]">
        <AdminSidebar />
        <AdminTopbar />
        <div className="ml-60 pt-16">
          <div className="p-6">{children}</div>
        </div>
      </div>
    </RouteGuard>
  )
}
