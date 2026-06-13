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
import {
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
} from './token-storage'

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

  // Khôi phục phiên khi load app: nếu có token thì lấy lại profile
  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      setLoading(false)
      return
    }
    userApi
      .getMe()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await authApi.login(payload)
    setTokens(result.accessToken, result.refreshToken)
    setUser(result.user)
    return result.user
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => {
        /* kể cả lỗi vẫn xoá token local */
      })
    }
    clearTokens()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await userApi.getMe()
    setUser(me)
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
