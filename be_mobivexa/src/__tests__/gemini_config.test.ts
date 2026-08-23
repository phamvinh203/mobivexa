import { vi, describe, it, expect, afterEach } from 'vitest'

// File này đứng riêng, không gộp vào chat_service.test.ts: bên đó vi.mock cả
// module config/gemini, mà module đã bị mock thì import() trả về bản giả —
// hai nhóm test không sống chung được.

// ─── config/gemini ────────────────────────────────────────────────────────────

describe('config/gemini', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('ném lỗi ngay khi import nếu thiếu GEMINI_API_KEY', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.resetModules()

    await expect(import('../config/gemini')).rejects.toThrow(/GEMINI_API_KEY/)
  })

  it('dùng gemini-2.5-flash khi không set GEMINI_MODEL', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_MODEL', '')
    vi.resetModules()

    const { GEMINI_MODEL } = await import('../config/gemini')
    expect(GEMINI_MODEL).toBe('gemini-2.5-flash')
  })
})
