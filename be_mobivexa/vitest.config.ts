import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      CLIENT_URL: 'http://localhost:3000',
      JWT_ACCESS_SECRET:  'test-access-secret-minimum-32-characters!!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-characters!!',
      DATABASE_URL: 'postgresql://test',
      SEPAY_WEBHOOK_SECRET: 'test-webhook-secret',
      SEPAY_API_TOKEN: 'test-api-token',
      SEPAY_ACCOUNT_NUMBER: '0123456789',
      // Chuỗi giả là đủ: mọi test đều mock client Gemini, không test nào gọi API
      // thật. Key thật chỉ sống trong .env.local — file này được git theo dõi.
      GEMINI_API_KEY: 'test-gemini-key',
    },
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/validators/**'],
    },
  },
})
