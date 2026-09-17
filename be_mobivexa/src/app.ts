import express, { type Request } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import { mountRoutes } from './routes/index.route'
import { errorHandler } from './middlewares/error.middleware'

export function createApp() {
  const app = express()

  // Sau 1 tầng reverse proxy (nginx/Render): Express phải tin header X-Forwarded-*
  // của proxy, nếu không mọi client dùng chung IP proxy và rate limit theo IP
  // (vd authLimiter 10 lượt/15 phút) thành khóa sập toàn bộ người dùng.
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
  // Nén response (gzip) — giảm băng thông, đặt sớm để mọi response đều được nén.
  app.use(compression())

  app.use(express.json())

  // Log mỗi request (method, path, status, thời gian); bỏ qua /health để
  // health-check định kỳ của PaaS không spam log.
  app.use(morgan<Request>('tiny', { skip: (req) => req.path === '/health' }))

  mountRoutes(app)

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  app.use(errorHandler)

  return app
}
