'use client'

import { useAuth } from '@/lib/auth/auth-context'
import { formatDate } from '@/lib/utils/format'

export default function AccountProfilePage() {
  const { user } = useAuth()
  if (!user) return <div className="text-gray-500">Đang tải...</div>

  const rows: [string, string][] = [
    ['Họ và tên', user.fullName],
    ['Email', user.email],
    ['Số điện thoại', user.phone ?? '—'],
    ['Vai trò', user.role],
    ['Trạng thái', user.isActive ? 'Đang hoạt động' : 'Đã khoá'],
    ['Thành viên từ', formatDate(user.createdAt)],
  ]

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
      <h1 className="text-xl font-bold mb-4">Thông tin cá nhân</h1>
      <dl className="divide-y divide-[var(--color-border)]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between py-3 text-sm">
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {/* TODO: form sửa (userApi.updateMe) + upload avatar (uploadAvatar) */}
    </div>
  )
}
