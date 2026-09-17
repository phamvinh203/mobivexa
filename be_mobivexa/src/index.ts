import './config/env'
import http from 'http'
import { connectDB, ensureSearchIndexes } from './config/db'
import { createApp } from './app'
import { cleanupExpiredTokens } from './services/auth.service'
import { validateEnv } from './config/env'

// Kiểm tra biến bắt buộc trước khi mở port — fail-fast thay vì lỗi runtime sau này.
validateEnv()

const PORT = Number(process.env.PORT) || 5000

const CLIENT_URL = process.env.CLIENT_URL
if (!CLIENT_URL || CLIENT_URL === '*') {
  throw new Error('CLIENT_URL phải được đặt và không được là wildcard (*)')
}

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

async function bootstrap() {
  await connectDB()
  await ensureSearchIndexes()

  await cleanupExpiredTokens()
  // .catch: DB lỗi thoáng qua trong cron này không được thành unhandled
  // rejection (default của Node là crash cả process) — log và chờ chu kỳ sau.
  const cleanupTimer = setInterval(
    () => cleanupExpiredTokens().catch((err) => console.error('[Cleanup] Lỗi dọn token hết hạn:', err)),
    CLEANUP_INTERVAL_MS,
  )

  const app = createApp()
  const server = http.createServer(app)

  // PaaS (Render...) gửi SIGTERM/SIGINT khi stop/redeploy — dọn interval và
  // đóng server cho hết request đang treo rồi mới thoát.
  const shutdown = (signal: string) => {
    console.log(`[Server] Received ${signal}, shutting down...`)
    clearInterval(cleanupTimer)
    server.close(() => process.exit(0))
    // Bảo hiểm: còn connection không đóng được thì buộc thoát sau 10 giây.
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`)
  })

  server.on('error', (err) => {
    console.error('[Server] Error:', err)
    process.exit(1)
  })
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Khởi động thất bại:', err)
  process.exit(1)
})
