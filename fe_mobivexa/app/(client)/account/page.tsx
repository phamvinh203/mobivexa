import type { Metadata } from 'next'
import { ProfileForm } from './_components/profile-form'

export const metadata: Metadata = {
  title: 'Thông tin cá nhân · Mobivexa',
}

export default function AccountProfilePage() {
  return <ProfileForm />
}
