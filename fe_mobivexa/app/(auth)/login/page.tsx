'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { ApiError } from '@/lib/api/http'
import { useRateLimit } from '@/lib/hooks/use-rate-limit'
import { UserRole } from '@/types/api'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { cooldown, blocked, registerFailure, reset } = useRateLimit()

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (blocked) return
    setError('')
    setLoading(true)
    try {
      const user = await login({ email, password })
      reset()
      // STAFF/ADMIN vào trang quản trị, còn lại về trang chủ
      const isStaff = user.role === UserRole.ADMIN || user.role === UserRole.STAFF
      router.push(isStaff ? '/admin' : '/')
    } catch (err) {
      registerFailure()
      setError(err instanceof ApiError ? err.message : 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-8">
      <h1 className="text-2xl font-bold">Chào mừng trở lại</h1>
      <p className="text-sm text-gray-500 mt-1">Đăng nhập để tiếp tục mua sắm</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 text-[var(--color-danger)] text-sm px-3 py-2">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-[var(--color-border)] outline-none focus:border-[var(--color-primary)]"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium">Mật khẩu</label>
            <Link href="/forgot-password" className="text-sm text-[var(--color-primary)]">
              Quên mật khẩu?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-[var(--color-border)] outline-none focus:border-[var(--color-primary)]"
            placeholder="Mật khẩu"
          />
        </div>
        <button
          type="submit"
          disabled={loading || blocked}
          className="w-full h-12 rounded-lg bg-[var(--color-primary)] text-white font-medium disabled:opacity-60"
        >
          {blocked
            ? `Thử lại sau ${cooldown}s`
            : loading
              ? 'Đang đăng nhập...'
              : 'Đăng nhập'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="text-[var(--color-primary)] font-medium">
          Đăng ký ngay
        </Link>
      </p>
    </div>
  )
}
