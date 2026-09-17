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

  it('thiếu GEMINI_API_KEY: import vẫn thành công, lỗi chỉ ném khi dùng client', async () => {
    // Init lười có chủ đích: module nằm trong chuỗi import của toàn bộ app, ném
    // lúc import sẽ làm thiếu key giết cả API — giờ chỉ chatbot nhận 503.
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.resetModules()

    const gemini = await import('../config/gemini')

    expect(gemini.isGeminiConfigured()).toBe(false)
    expect(() => gemini.getGemini()).toThrow(/GEMINI_API_KEY/)
  })

  it('dùng gemini-2.5-flash khi không set GEMINI_MODEL', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_MODEL', '')
    vi.resetModules()

    const { GEMINI_MODEL } = await import('../config/gemini')
    expect(GEMINI_MODEL).toBe('gemini-2.5-flash')
  })
})
