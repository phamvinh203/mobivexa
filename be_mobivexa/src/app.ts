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
  //
  // RÀNG BUỘC DEPLOY: giá trị 1 chỉ tin đúng proxy tầng 1 — nginx PHẢI cấu hình
  // `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` để ghi đè header
  // XFF do client gửi lên. Nếu nginx giữ nguyên header từ client, một client tự
  // gắn XFF giả là spoof được IP và bypass mọi rate limiter theo IP (authLimiter,
  // chatLimiter...).
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
