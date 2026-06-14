'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Trash2, Eye, EyeOff, UserCog, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/auth-context'
import { adminUserApi } from '@/features/users/api'
import { USER_ROLE_META, USER_ROLES, type AdminUser } from '@/features/users/types'
import { UserRole, type PaginationMeta } from '@/types/api'
import { UserRoleModal } from './user-role-modal'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'
type RoleFilter = 'ALL' | UserRole

const PAGE_SIZE = 20

/** Chip toggle dùng chung cho filter (role / status) — tránh lặp className. */
function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'bg-white text-gray-600 ring-1 ring-border hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

export default function AdminUsersPage() {
  const { user: me } = useAuth()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await adminUserApi.list({
        page: pagination.page,
        limit: PAGE_SIZE,
        search: search || undefined,
        role: roleFilter === 'ALL' ? undefined : roleFilter,
        isActive: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
      })
      setUsers(result.users)
      setPagination(result.pagination)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách người dùng')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, search, roleFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
    resetPage()
  }

  // Reset về trang 1 khi đổi filter (search/role/status) để tránh trỏ tới trang rỗng.
  const resetPage = () => setPagination((p) => ({ ...p, page: 1 }))

  function goToPage(page: number) {
    setPagination((p) => ({ ...p, page: Math.max(1, Math.min(page, p.totalPages || 1)) }))
  }

  function handleRoleSaved(updated: AdminUser) {
    setEditing(null)
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
  }

  // Bọc thao tác trên 1 dòng: set busy + bắt lỗi; cập nhật state cục bộ trong op.
  async function runBusy(id: string, op: () => Promise<void>, errMsg: string) {
    setBusyId(id)
    try {
      await op()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errMsg)
    } finally {
      setBusyId(null)
    }
  }

  function handleToggle(user: AdminUser) {
    return runBusy(
      user.id,
      async () => {
        const updated = await adminUserApi.toggleStatus(user.id)
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      },
      'Cập nhật trạng thái thất bại',
    )
  }

  function handleDelete(user: AdminUser) {
    if (!confirm(`Xoá người dùng "${user.fullName}"? Hành động này không thể hoàn tác.`)) return
    return runBusy(
      user.id,
      async () => {
        await adminUserApi.remove(user.id)
        setUsers((prev) => prev.filter((u) => u.id !== user.id))
        // Giảm total + tính lại totalPages để footer không bị stale.
        setPagination((p) => {
          const total = Math.max(0, p.total - 1)
          return { ...p, total, totalPages: Math.ceil(total / p.limit) }
        })
      },
      'Xoá người dùng thất bại',
    )
  }

  const rangeLabel = useMemo(() => {
    if (pagination.total === 0) return 'Không có người dùng'
    const from = (pagination.page - 1) * pagination.limit + 1
    const to = Math.min(pagination.page * pagination.limit, pagination.total)
    return `${from}–${to} / ${pagination.total}`
  }, [pagination])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Người dùng</h1>
        <p className="text-sm text-gray-500">Danh sách, đổi vai trò, khoá/mở và xoá người dùng.</p>
      </div>

      {/* Filter bar */}
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

        {/* Filter role */}
        {(['ALL', ...USER_ROLES] as RoleFilter[]).map((r) => (
          <FilterChip
            key={r}
            active={roleFilter === r}
            label={r === 'ALL' ? 'Tất cả role' : USER_ROLE_META[r].label}
            onClick={() => {
              setRoleFilter(r)
              resetPage()
            }}
          />
        ))}

        {/* Filter status */}
        <div className="ml-auto flex gap-2">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              label={s === 'ALL' ? 'Tất cả' : s === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khoá'}
              onClick={() => {
                setStatusFilter(s)
                resetPage()
              }}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {/* Bảng */}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Người dùng</th>
                <th className="px-4 py-3 font-medium">Vai trò</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Ngày tạo</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    Không có người dùng phù hợp.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
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
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${USER_ROLE_META[user.role].badgeClass}`}
                        >
                          {USER_ROLE_META[user.role].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                            Đã khoá
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isSelf || busyId === user.id}
                            onClick={() => handleToggle(user)}
                            title={isSelf ? 'Không thể khoá chính mình' : user.isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}
                          >
                            {user.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isSelf}
                            onClick={() => setEditing(user)}
                            title={isSelf ? 'Không thể đổi role chính mình' : 'Đổi vai trò'}
                          >
                            <UserCog className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
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
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-gray-500">{rangeLabel}</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || loading}
                onClick={() => goToPage(pagination.page - 1)}
              >
                Trước
              </Button>
              <span className="px-2 text-gray-600">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => goToPage(pagination.page + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <UserRoleModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={handleRoleSaved}
        />
      )}
    </div>
  )
}
