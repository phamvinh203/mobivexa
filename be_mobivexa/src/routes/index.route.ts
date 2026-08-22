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
import { paymentRoutes, paymentAdminRoutes } from './payment.route'
import {
  reviewPublicRoutes,
  reviewUserRoutes,
  reviewOrderItemRoutes,
  reviewRoutes,
  reviewAdminRoutes,
} from './review.route'
import { bannerRoutes, bannerAdminRoutes } from './banner.route'
import { favoriteRoutes } from './favorite.route'

export function mountRoutes(app: Express): void {
  const v = '/api'

  // Public + auth
  app.use(`${v}/auth`, authRoutes)
  app.use(`${v}/users`, userRoutes)
  app.use(`${v}/categories`, categoryRoutes)
  app.use(`${v}/brands`, brandRoutes)
  app.use(`${v}/banners`, bannerRoutes)
  app.use(`${v}/products`, productRoutes)
  app.use(`${v}/products/:slug/reviews`, reviewPublicRoutes)
  app.use(`${v}/tags`, tagRoutes)
  app.use(`${v}/cart`, cartRoutes)
  app.use(`${v}/favorites`, favoriteRoutes)
  app.use(`${v}/orders`, orderRoutes)
  app.use(`${v}`, paymentRoutes)

  // Review (user)
  app.use(`${v}/users/me/reviews`,                reviewUserRoutes)
  app.use(`${v}/order-items/:orderItemId/review`, reviewOrderItemRoutes)
  app.use(`${v}/reviews`,                         reviewRoutes)

  // Admin
  app.use(`${v}/admin/users`, adminUserRoutes)
  app.use(`${v}/admin/categories`, categoryAdminRoutes)
  app.use(`${v}/admin/brands`, brandAdminRoutes)
  app.use(`${v}/admin/products`, productAdminRoutes)
  app.use(`${v}/admin/inventory`, inventoryAdminRoutes)
  app.use(`${v}/admin/tags`, tagAdminRoutes)
  app.use(`${v}/admin/orders`, orderAdminRoutes)
  app.use(`${v}/admin/payment`, paymentAdminRoutes)
  app.use(`${v}/admin/reviews`, reviewAdminRoutes)
  app.use(`${v}/admin/banners`, bannerAdminRoutes)
}
