import { Express } from 'express'
import { authRoutes } from './auth.route'
import { userRoutes } from './user.route'
import { categoryRoutes, categoryAdminRoutes } from './category.route'
import { brandRoutes, brandAdminRoutes } from './brand.route'
import { productRoutes, productAdminRoutes } from './product.route'
import { inventoryAdminRoutes } from './inventory.route'
import { tagRoutes, tagAdminRoutes } from './tag.route'
import { adminUserRoutes } from './admin.route'
import { cartRoutes } from './cart.route'
import { orderRoutes, orderAdminRoutes } from './order.route'
import { paymentRoutes } from './payment.route'

export function mountRoutes(app: Express): void {
  const v = '/api'

  // Public + auth
  app.use(`${v}/auth`, authRoutes)
  app.use(`${v}/users`, userRoutes)
  app.use(`${v}/categories`, categoryRoutes)
  app.use(`${v}/brands`, brandRoutes)
  app.use(`${v}/products`, productRoutes)
  app.use(`${v}/tags`, tagRoutes)
  app.use(`${v}/cart`, cartRoutes)
  app.use(`${v}/orders`, orderRoutes)
  app.use(`${v}`, paymentRoutes)

  // Admin
  app.use(`${v}/admin/users`, adminUserRoutes)
  app.use(`${v}/admin/categories`, categoryAdminRoutes)
  app.use(`${v}/admin/brands`, brandAdminRoutes)
  app.use(`${v}/admin/products`, productAdminRoutes)
  app.use(`${v}/admin/inventory`, inventoryAdminRoutes)
  app.use(`${v}/admin/tags`, tagAdminRoutes)
  app.use(`${v}/admin/orders`, orderAdminRoutes)
}
