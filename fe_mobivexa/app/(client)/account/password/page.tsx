import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function ChangePasswordPage() {
  return (
    <PagePlaceholder
      title="Đổi mật khẩu"
      endpoint="PUT /users/me/password · userApi.changePassword()"
      todos={['Form: mật khẩu hiện tại + mật khẩu mới + xác nhận']}
    />
  )
}
