'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { authApi } from '@/features/auth/api'
import { ApiError } from '@/lib/api/http'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword({ email })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-8">
      <h1 className="text-2xl font-bold">Quên mật khẩu?</h1>
      <p className="text-sm text-gray-500 mt-1">
        Nhập email đăng ký, chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu.
      </p>

      {sent ? (
        <div className="mt-6 rounded-lg bg-green-50 text-[var(--color-success)] text-sm px-4 py-3">
          Nếu email tồn tại, mã OTP đã được gửi. Kiểm tra hộp thư của bạn.
          <div className="mt-3">
            <Link href="/reset-password" className="text-[var(--color-primary)] font-medium">
              Nhập mã OTP để đặt lại →
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 text-[var(--color-danger)] text-sm px-3 py-2">
              {error}
            </div>
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full h-11 px-3 rounded-lg border border-[var(--color-border)] outline-none focus:border-[var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-lg bg-[var(--color-primary)] text-white font-medium disabled:opacity-60"
          >
            {loading ? 'Đang gửi...' : 'Gửi mã đặt lại'}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-[var(--color-primary)]">
          ← Quay lại đăng nhập
        </Link>
      </p>
    </div>
  )
}
