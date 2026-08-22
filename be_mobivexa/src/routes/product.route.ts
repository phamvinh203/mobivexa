import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { uploadImage } from '../middlewares/upload.middleware'
import { validateCreateProduct, validateUpdateProduct, validateVariant, validateUpdateStock, validateReplaceSpecs } from '../validators/product.validator'
import * as controller from '../controllers/product.controller'

// ─── Public routes: /api/products ─────────────────────────────────────────────
const publicRouter: Router = Router()
publicRouter.get('/', controller.list)
publicRouter.get('/featured', controller.featured)
publicRouter.get('/:slug', controller.detail)

// ─── Admin routes: /api/admin/products ────────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))

adminRouter.get('/', controller.listAdmin)
adminRouter.get('/:id', controller.getAdmin)
adminRouter.post('/', uploadImage.array('images', 10), validateCreateProduct, controller.create)
adminRouter.put('/:id', uploadImage.array('images', 10), validateUpdateProduct, controller.update)
adminRouter.delete('/:id', controller.remove)
adminRouter.patch('/:id/status', controller.toggleStatus)
adminRouter.patch('/:id/featured', controller.toggleFeatured)

// Images
adminRouter.post('/:id/images', uploadImage.array('images', 10), controller.uploadImages)
adminRouter.delete('/:id/images/:imageId', controller.removeImage)
adminRouter.patch('/:id/images/:imageId/cover', controller.setCover)

// Specs - thay ca bang mot lan, xem replaceProductSpecs de biet vi sao khong CRUD tung dong
adminRouter.put('/:id/specs', validateReplaceSpecs, controller.replaceSpecs)

// Variants
adminRouter.post('/:id/variants', validateVariant, controller.createVariant)
adminRouter.put('/:id/variants/:variantId', controller.editVariant)
adminRouter.delete('/:id/variants/:variantId', controller.removeVariant)
adminRouter.patch('/:id/variants/:variantId/stock', validateUpdateStock, controller.patchStock)

export const productRoutes: Router = publicRouter
export const productAdminRoutes: Router = adminRouter
