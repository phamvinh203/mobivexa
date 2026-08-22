import './config/env'
import http from 'http'
import { connectDB, ensureSearchIndexes } from './config/db'
import { createApp } from './app'
import { cleanupExpiredTokens } from './services/auth.service'

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
  setInterval(() => void cleanupExpiredTokens(), CLEANUP_INTERVAL_MS)

  const app = createApp()
  const server = http.createServer(app)

  server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`)
  })

  server.on('error', (err) => {
    console.error('[Server] Error:', err)
    process.exit(1)
  })
}

bootstrap()
