import { Express } from 'express'
import { authRoutes } from './auth.route'

export function mountRoutes(app: Express): void {
  const v = '/api'
  app.use(`${v}/auth`, authRoutes)
}
