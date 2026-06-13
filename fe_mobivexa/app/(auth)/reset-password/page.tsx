'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authApi } from '@/features/auth/api'
import { ApiError } from '@/lib/api/http'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.resetPassword({ otp, newPassword })
      router.push('/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đặt lại mật khẩu thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-8">
      <h1 className="text-2xl font-bold">Đặt lại mật khẩu</h1>
      <p className="text-sm text-gray-500 mt-1">
        Nhập mã OTP đã nhận qua email và mật khẩu mới.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 text-[var(--color-danger)] text-sm px-3 py-2">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Mã OTP</label>
          <input
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Nhập mã 6 số"
            className="w-full h-11 px-3 rounded-lg border border-[var(--color-border)] outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mật khẩu mới</label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-[var(--color-border)] outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-lg bg-[var(--color-primary)] text-white font-medium disabled:opacity-60"
        >
          {loading ? 'Đang xử lý...' : 'Xác nhận'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-[var(--color-primary)]">
          ← Quay lại đăng nhập
        </Link>
      </p>
    </div>
  )
}
