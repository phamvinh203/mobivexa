import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { mountRoutes } from './routes/index.route'
import { errorHandler } from './middlewares/error.middleware'

export function createApp() {
  const app = express()

  // Deploy sau nginx (1 hop): Express phải tin đúng số hop proxy mới suy ra IP
  // thật từ X-Forwarded-For. Thiếu nó, rate-limit gom mọi guest vào chung 1 bucket
  // (IP của nginx) và express-rate-limit v8 log lỗi mỗi request khi thấy XFF.
  app.set('trust proxy', 1)

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
  // Body bài viết blog (contentHtml) có thể vượt xa 100KB mặc định — giới hạn riêng 2MB
  // CHỈ cho /api/admin/blog, đặt TRƯỚC express.json() toàn cục (body-parser bỏ qua
  // request đã đọc body — api-contract.md 0.1, ADR-blog-005).
  app.use('/api/admin/blog', express.json({ limit: '2mb' }))
  app.use(express.json())

  mountRoutes(app)

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  app.use(errorHandler)

  return app
}
