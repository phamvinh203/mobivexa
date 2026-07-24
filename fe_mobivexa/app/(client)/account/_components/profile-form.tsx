'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Check, Loader2, Pencil, TriangleAlert } from 'lucide-react'
import { userApi } from '@/features/users/api'
import { ApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/auth-context'
import { assertImageFile } from '@/lib/utils/file'
import { formatDate } from '@/lib/utils/format'
import { USER_ROLE_META } from '@/features/users/types'

/** Khớp PHONE_RE trong be_mobivexa/src/validators/user.validator.ts */
const PHONE_RE = /^(0|\+84)[0-9]{8,10}$/

export function ProfileForm() {
  const { user, refreshUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  if (!user) {
    return (
      <div className="grid min-h-[30vh] place-items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">Đang tải thông tin...</p>
      </div>
    )
  }

  function startEdit() {
    setFullName(user!.fullName)
    setPhone(user!.phone ?? '')
    setError(null)
    setDone(null)
    setEditing(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const name = fullName.trim()
    const tel = phone.trim()

    if (name.length < 2) {
      setError('Họ tên phải có ít nhất 2 ký tự')
      return
    }
    if (tel && !PHONE_RE.test(tel)) {
      setError('Số điện thoại không hợp lệ (bắt đầu bằng 0 hoặc +84)')
      return
    }
    // Backend từ chối khi không có field nào thay đổi ("Vui lòng cung cấp ít
    // nhất một trường") → chặn trước cho khỏi hiện lỗi vô nghĩa.
    if (name === user!.fullName && tel === (user!.phone ?? '')) {
      setEditing(false)
      return
    }

    setError(null)
    setSaving(true)
    try {
      await userApi.updateMe({ fullName: name, phone: tel || undefined })
      await refreshUser()
      setEditing(false)
      setDone('Đã cập nhật thông tin')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được thông tin')
    } finally {
      setSaving(false)
    }
  }

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // cho phép chọn lại đúng file đó lần sau
    if (!file) return

    setError(null)
    setDone(null)
    try {
      assertImageFile(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ảnh không hợp lệ')
      return
    }

    setUploading(true)
    try {
      await userApi.uploadAvatar(file)
      await refreshUser()
      setDone('Đã cập nhật ảnh đại diện')
    } catch (err) {
      // Backend giới hạn 10 lần upload/giờ — message rate limit hiển thị nguyên văn
      setError(err instanceof ApiError ? err.message : 'Không tải được ảnh lên')
    } finally {
      setUploading(false)
    }
  }

  const rows: [string, string][] = [
    ['Email', user.email],
    ['Vai trò', USER_ROLE_META[user.role]?.label ?? user.role],
    ['Trạng thái', user.isActive ? 'Đang hoạt động' : 'Đã khoá'],
    ['Xác thực email', user.emailVerified ? 'Đã xác thực' : 'Chưa xác thực'],
    ['Thành viên từ', formatDate(user.createdAt)],
  ]

  const inputClass =
    'w-full rounded-lg border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)]'

  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <h1 className="mb-5 text-xl font-bold">Thông tin cá nhân</h1>

      {/* ── Avatar ───────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative">
          <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-accent)] text-2xl font-bold text-white">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={80}
                height={80}
                className="h-20 w-20 object-cover"
              />
            ) : (
              (user.fullName?.[0]?.toUpperCase() ?? 'U')
            )}
          </span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Đổi ảnh đại diện"
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[var(--color-primary)] text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Camera className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={pickAvatar}
            className="hidden"
          />
        </div>

        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-gray-900">{user.fullName}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* ── Form sửa / bảng thông tin ────────────────────────────────────── */}
      {editing ? (
        <form onSubmit={save} className="max-w-md">
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Họ và tên</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                autoComplete="name"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">
                Số điện thoại
                <span className="ml-1 font-normal text-muted-foreground">
                  (không bắt buộc)
                </span>
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder="0912345678"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-[var(--color-danger)]">
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Lưu thay đổi
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Huỷ
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="divide-y divide-border border-t border-border">
            <div className="flex justify-between gap-4 py-3 text-sm">
              <dt className="text-gray-500">Họ và tên</dt>
              <dd className="font-medium">{user.fullName}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3 text-sm">
              <dt className="text-gray-500">Số điện thoại</dt>
              <dd className="font-medium">{user.phone ?? '—'}</dd>
            </div>
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <div aria-live="polite" className="mt-3 min-h-5">
            {done && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-success)]">
                <Check className="h-4 w-4" aria-hidden />
                {done}
              </p>
            )}
            {error && (
              <p className="flex items-start gap-1.5 text-sm text-[var(--color-danger)]">
                <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                {error}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={startEdit}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Chỉnh sửa thông tin
          </button>
        </>
      )}
    </div>
  )
}
