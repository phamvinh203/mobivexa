import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { mountRoutes } from './routes/index.route'
import { errorHandler } from './middlewares/error.middleware'

export function createApp() {
  const app = express()

  // Header bảo mật mặc định (HSTS, noSniff, frameguard, ẩn X-Powered-By...).
  // Đặt trước cors để áp cho cả preflight lẫn response lỗi.
  app.use(helmet())

  app.use(
    cors({
      origin: (process.env.CLIENT_URL ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      credentials: true,
    }),
  )
  app.use(express.json())

  mountRoutes(app)

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  app.use(errorHandler)

  return app
}
