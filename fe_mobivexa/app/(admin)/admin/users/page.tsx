'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Trash2, Eye, EyeOff, UserCog, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { AdminTable } from '@/components/ui/admin-table'
import { Pagination } from '@/components/ui/pagination'
import { StatusDot } from '@/components/ui/status-dot'
import { formatDate } from '@/lib/utils/format'
import { useRowAction } from '@/lib/hooks/use-row-action'
import { ApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/auth-context'
import { adminUserApi } from '@/features/users/api'
import { USER_ROLE_META, USER_ROLES, type AdminUser, type AdminUserListResult } from '@/features/users/types'
import { UserRole, type PaginationMeta } from '@/types/api'
import { UserRoleModal } from './user-role-modal'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'
type RoleFilter = 'ALL' | UserRole

const PAGE_SIZE = 20
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

const COLUMNS = [
  'Người dùng', 'Vai trò', 'Trạng thái', 'Ngày tạo',
  { label: 'Thao tác', className: 'text-right' },
] as const

export default function AdminUsersPage() {
  const { user: me } = useAuth()

  const [result, setResult] = useState<AdminUserListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const [editing, setEditing] = useState<AdminUser | null>(null)

  const { busyId, runBusy } = useRowAction(setError)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminUserApi.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        role: roleFilter === 'ALL' ? undefined : roleFilter,
        isActive: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách người dùng')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  function handleRoleSaved(updated: AdminUser) {
    setEditing(null)
    setResult((prev) => prev ? { ...prev, users: prev.users.map((u) => u.id === updated.id ? updated : u) } : prev)
  }

  function handleToggle(user: AdminUser) {
    return runBusy(user.id, async () => {
      const updated = await adminUserApi.toggleStatus(user.id)
      setResult((prev) => prev ? { ...prev, users: prev.users.map((u) => u.id === updated.id ? updated : u) } : prev)
    }, 'Cập nhật trạng thái thất bại')
  }

  function handleDelete(user: AdminUser) {
    if (!confirm(`Xoá người dùng "${user.fullName}"? Hành động này không thể hoàn tác.`)) return
    return runBusy(user.id, async () => {
      await adminUserApi.remove(user.id)
      setResult((prev) => {
        if (!prev) return prev
        const total = Math.max(0, prev.pagination.total - 1)
        return {
          users: prev.users.filter((u) => u.id !== user.id),
          pagination: { ...prev.pagination, total, totalPages: Math.ceil(total / prev.pagination.limit) },
        }
      })
    }, 'Xoá người dùng thất bại')
  }

  const users = result?.users ?? []
  const pagination = result?.pagination ?? EMPTY_PAGINATION

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Người dùng</h1>
        <p className="text-sm text-gray-500">Danh sách, đổi vai trò, khoá/mở và xoá người dùng.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className="h-8 w-64 pl-8"
          />
        </form>

        {(['ALL', ...USER_ROLES] as RoleFilter[]).map((r) => (
          <FilterChip
            key={r}
            active={roleFilter === r}
            label={r === 'ALL' ? 'Tất cả role' : USER_ROLE_META[r].label}
            onClick={() => { setRoleFilter(r); setPage(1) }}
          />
        ))}

        <div className="ml-auto flex gap-2">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              label={s === 'ALL' ? 'Tất cả' : s === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khoá'}
              onClick={() => { setStatusFilter(s); setPage(1) }}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      <AdminTable
        columns={COLUMNS}
        colSpan={5}
        loading={loading}
        empty={users.length === 0}
        emptyMessage="Không có người dùng phù hợp."
        scrollable
        footer={
          pagination.totalPages > 1
            ? <Pagination meta={pagination} loading={loading} emptyLabel="Không có người dùng" onChange={setPage} />
            : undefined
        }
      >
        {users.map((user) => {
          const isSelf = me?.id === user.id
          return (
            <tr key={user.id} className="hover:bg-gray-50/60">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-border">
                    {user.avatarUrl ? (
                      <Image src={user.avatarUrl} alt={user.fullName} fill sizes="40px" className="object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs font-medium text-gray-400">
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium text-gray-800">
                      <span className="truncate">{user.fullName}</span>
                      {isSelf && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">Bạn</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-gray-400">{user.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${USER_ROLE_META[user.role].badgeClass}`}>
                  {USER_ROLE_META[user.role].label}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusDot active={user.isActive} activeLabel="Hoạt động" inactiveLabel="Đã khoá" />
              </td>
              <td className="px-4 py-3 text-gray-600">{formatDate(user.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost" size="icon-sm"
                    disabled={isSelf || busyId === user.id}
                    onClick={() => handleToggle(user)}
                    title={isSelf ? 'Không thể khoá chính mình' : user.isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}
                  >
                    {user.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost" size="icon-sm"
                    disabled={isSelf}
                    onClick={() => setEditing(user)}
                    title={isSelf ? 'Không thể đổi role chính mình' : 'Đổi vai trò'}
                  >
                    <UserCog className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive" size="icon-sm"
                    disabled={isSelf || busyId === user.id}
                    onClick={() => handleDelete(user)}
                    title={isSelf ? 'Không thể xoá chính mình' : 'Xoá'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          )
        })}
      </AdminTable>

      {editing && (
        <UserRoleModal user={editing} onClose={() => setEditing(null)} onSaved={handleRoleSaved} />
      )}
    </div>
  )
}
