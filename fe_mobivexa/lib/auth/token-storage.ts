import { TOKEN_KEYS } from '../api/config'

// localStorage proxy — returns null on server (RSC/SSR)
const storage = () =>
  typeof window === 'undefined' ? null : window.localStorage

export const getAccessToken = (): string | null =>
  storage()?.getItem(TOKEN_KEYS.access) ?? null

export const getRefreshToken = (): string | null =>
  storage()?.getItem(TOKEN_KEYS.refresh) ?? null

export function setTokens(accessToken: string, refreshToken: string): void {
  const s = storage()
  if (!s) return
  s.setItem(TOKEN_KEYS.access, accessToken)
  s.setItem(TOKEN_KEYS.refresh, refreshToken)
}

export function clearTokens(): void {
  const s = storage()
  if (!s) return
  s.removeItem(TOKEN_KEYS.access)
  s.removeItem(TOKEN_KEYS.refresh)
}
