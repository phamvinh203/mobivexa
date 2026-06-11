import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { uploadImage } from '../middlewares/upload.middleware'
import { validateCreateProduct, validateUpdateProduct, validateVariant } from '../validators/product.validator'
import * as controller from '../controllers/product.controller'

// ─── Public routes: /api/products ─────────────────────────────────────────────
const publicRouter: Router = Router()
publicRouter.get('/', controller.list)
publicRouter.get('/featured', controller.featured)
publicRouter.get('/:slug', controller.detail)

// ─── Admin routes: /api/admin/products ────────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))

adminRouter.post('/', uploadImage.array('images', 10), validateCreateProduct, controller.create)
adminRouter.put('/:id', uploadImage.array('images', 10), validateUpdateProduct, controller.update)
adminRouter.delete('/:id', controller.remove)
adminRouter.patch('/:id/status', controller.toggleStatus)
adminRouter.patch('/:id/featured', controller.toggleFeatured)

// Images
adminRouter.post('/:id/images', uploadImage.array('images', 10), controller.uploadImages)
adminRouter.delete('/:id/images/:imageId', controller.removeImage)
adminRouter.patch('/:id/images/:imageId/cover', controller.setCover)

// Variants
adminRouter.post('/:id/variants', validateVariant, controller.createVariant)
adminRouter.put('/:id/variants/:variantId', controller.editVariant)
adminRouter.delete('/:id/variants/:variantId', controller.removeVariant)

export const productRoutes: Router = publicRouter
export const productAdminRoutes: Router = adminRouter
