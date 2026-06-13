'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth/auth-context'

/**
 * Gom mọi client-side provider tại đây (auth, theme, query client...).
 * Được render trong root layout (Server Component) — provider phải là client.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
