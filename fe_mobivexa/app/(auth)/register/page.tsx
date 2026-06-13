'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authApi } from '@/features/auth/api'
import { ApiError } from '@/lib/api/http'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.register({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
      })
      router.push('/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-8">
      <h1 className="text-2xl font-bold">Tạo tài khoản mới</h1>
      <p className="text-sm text-gray-500 mt-1">Điền thông tin để bắt đầu mua sắm</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 text-[var(--color-danger)] text-sm px-3 py-2">
            {error}
          </div>
        )}
        <Field label="Họ và tên" value={form.fullName} onChange={set('fullName')} required />
        <Field label="Email" type="email" value={form.email} onChange={set('email')} required />
        <Field label="Số điện thoại" value={form.phone} onChange={set('phone')} />
        <Field
          label="Mật khẩu"
          type="password"
          value={form.password}
          onChange={set('password')}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-lg bg-[var(--color-primary)] text-white font-medium disabled:opacity-60"
        >
          {loading ? 'Đang xử lý...' : 'Đăng ký'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Đã có tài khoản?{' '}
        <Link href="/login" className="text-[var(--color-primary)] font-medium">
          Đăng nhập
        </Link>
      </p>
    </div>
  )
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        {...props}
        className="w-full h-11 px-3 rounded-lg border border-[var(--color-border)] outline-none focus:border-[var(--color-primary)]"
      />
    </div>
  )
}
