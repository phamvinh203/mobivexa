'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { authApi } from '@/features/auth/api'
import { userApi } from '@/features/users/api'
import type { AuthUser, LoginPayload } from '@/features/auth/types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Khôi phục phiên: thử lấy profile qua BFF (cookie HttpOnly tự gửi). Không cần
  // đọc token — nếu cookie không hợp lệ, getMe trả 401 và user giữ null.
  useEffect(() => {
    userApi
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    const { user: loggedIn } = await authApi.login(payload)
    setUser(loggedIn)
    return loggedIn
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {
      /* kể cả lỗi vẫn xoá state local */
    })
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    setUser(await userApi.getMe())
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  return ctx
}
