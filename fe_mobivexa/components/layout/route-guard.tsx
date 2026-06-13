'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import type { UserRole } from '@/types/api'

interface RouteGuardProps {
  children: ReactNode
  /** Nếu truyền, chỉ user có role nằm trong danh sách mới được vào */
  roles?: UserRole[]
  /** Đường dẫn redirect khi chưa đăng nhập (mặc định /login) */
  redirectTo?: string
  /** Đường dẫn redirect khi sai quyền (mặc định /) */
  fallbackTo?: string
}

export function RouteGuard({
  children,
  roles,
  redirectTo = '/login',
  fallbackTo = '/',
}: RouteGuardProps) {
  const { user, loading, isAuthenticated } = useAuth()
  const router = useRouter()

  const unauthorized =
    !loading && isAuthenticated && !!roles && !!user && !roles.includes(user.role)

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) router.replace(redirectTo)
    else if (unauthorized) router.replace(fallbackTo)
  }, [loading, isAuthenticated, unauthorized, redirectTo, fallbackTo, router])

  if (loading) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-gray-500">
        Đang tải...
      </div>
    )
  }
  if (!isAuthenticated || unauthorized) return null

  return <>{children}</>
}
