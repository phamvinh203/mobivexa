'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react'
import { userApi } from '@/features/users/api'
import { ApiError } from '@/lib/api/http'

/** Khớp validateChangePassword bên backend */
const MIN_LENGTH = 8

interface Fields {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const EMPTY: Fields = { currentPassword: '', newPassword: '', confirmPassword: '' }

export function PasswordForm() {
  const [form, setForm] = useState<Fields>(EMPTY)
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function field(key: keyof Fields, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDone(false)
  }

  /** Ba luật đầu khớp backend; luật xác nhận là của riêng client (BE không nhận
   *  confirmPassword) nhưng vẫn cần để tránh gõ nhầm mà không biết. */
  function validate(): string | null {
    if (!form.currentPassword) return 'Vui lòng nhập mật khẩu hiện tại'
    if (form.newPassword.length < MIN_LENGTH) {
      return `Mật khẩu mới phải có ít nhất ${MIN_LENGTH} ký tự`
    }
    if (form.currentPassword === form.newPassword) {
      return 'Mật khẩu mới phải khác mật khẩu hiện tại'
    }
    if (form.newPassword !== form.confirmPassword) {
      return 'Xác nhận mật khẩu không khớp'
    }
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }

    setError(null)
    setSaving(true)
    try {
      await userApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      setForm(EMPTY)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đổi được mật khẩu')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-border px-3 py-2 pr-10 text-sm outline-none transition-colors focus:border-[var(--color-primary)]'

  const rows: { key: keyof Fields; label: string; autoComplete: string }[] = [
    { key: 'currentPassword', label: 'Mật khẩu hiện tại', autoComplete: 'current-password' },
    { key: 'newPassword', label: 'Mật khẩu mới', autoComplete: 'new-password' },
    { key: 'confirmPassword', label: 'Xác nhận mật khẩu mới', autoComplete: 'new-password' },
  ]

  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <h1 className="mb-1 text-xl font-bold">Đổi mật khẩu</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Mật khẩu mới cần tối thiểu {MIN_LENGTH} ký tự và khác mật khẩu hiện tại.
      </p>

      <form onSubmit={submit} className="max-w-md">
        <div className="flex flex-col gap-3">
          {rows.map(({ key, label, autoComplete }) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">{label}</span>
              <span className="relative">
                <input
                  type={visible ? 'text' : 'password'}
                  value={form[key]}
                  onChange={(e) => field(key, e.target.value)}
                  className={inputClass}
                  autoComplete={autoComplete}
                />
                {key === 'currentPassword' && (
                  <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    {visible ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                )}
              </span>
            </label>
          ))}
        </div>

        <div aria-live="polite" className="mt-3 min-h-5">
          {error && (
            <p className="flex items-start gap-1.5 text-sm text-[var(--color-danger)]">
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              {error}
            </p>
          )}
          {done && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-success)]">
              <Check className="h-4 w-4" aria-hidden />
              Đổi mật khẩu thành công
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Cập nhật mật khẩu
        </button>
      </form>
    </div>
  )
}
