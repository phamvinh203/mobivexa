import type { Metadata } from 'next'
import { PasswordForm } from './_components/password-form'

export const metadata: Metadata = {
  title: 'Đổi mật khẩu · Mobivexa',
}

export default function ChangePasswordPage() {
  return <PasswordForm />
}
