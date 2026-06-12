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
    },
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/validators/**'],
    },
  },
})
