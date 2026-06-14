'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api/http'
import { adminUserApi } from '@/features/users/api'
import { UserRole } from '@/types/api'
import { USER_ROLES, USER_ROLE_META, type AdminUser } from '@/features/users/types'

interface UserRoleModalProps {
  /** User đang đổi role */
  user: AdminUser
  onClose: () => void
  onSaved: (updated: AdminUser) => void
}

export function UserRoleModal({ user, onClose, onSaved }: UserRoleModalProps) {
  const [role, setRole] = useState<UserRole>(user.role)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (role === user.role) {
      onClose()
      return
    }

    setSubmitting(true)
    try {
      const updated = await adminUserApi.changeRole(user.id, { role })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đổi role thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog title={`Đổi vai trò — ${user.fullName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="role">Vai trò</Label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {USER_ROLE_META[r].label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            STAFF/ADMIN có thể truy cập trang quản trị.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? 'Đang lưu...' : 'Cập nhật'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
