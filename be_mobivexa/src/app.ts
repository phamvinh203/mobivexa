import express from 'express'
import cors from 'cors'
import { mountRoutes } from './routes/index.route'
import { errorHandler } from './middlewares/error.middleware'

export function createApp() {
  const app = express()

  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  }))
  app.use(express.json())

  mountRoutes(app)

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  app.use(errorHandler)

  return app
}
