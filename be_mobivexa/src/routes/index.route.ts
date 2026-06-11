import { Express } from 'express'
import { authRoutes } from './auth.route'
import { userRoutes } from './user.route'

export function mountRoutes(app: Express): void {
  const v = '/api'
  app.use(`${v}/auth`,  authRoutes)
  app.use(`${v}/users`, userRoutes)
}
