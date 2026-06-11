import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { uploadImage } from '../middlewares/upload.middleware'
import { validateCreateBrand, validateUpdateBrand } from '../validators/brand.validator'
import * as controller from '../controllers/brand.controller'

// ─── Public routes: /api/brands ───────────────────────────────────────────────
const publicRouter: Router = Router()
publicRouter.get('/', controller.listBrands)
publicRouter.get('/:slug', controller.getBrand)

// ─── Admin routes: /api/admin/brands ──────────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))
adminRouter.get('/', controller.listBrandsAdmin)
adminRouter.post('/', uploadImage.single('logo'), validateCreateBrand, controller.createBrandAdmin)
adminRouter.put('/:id', uploadImage.single('logo'), validateUpdateBrand, controller.updateBrandAdmin)
adminRouter.delete('/:id', controller.deleteBrandAdmin)
adminRouter.patch('/:id/status', controller.toggleBrandStatusAdmin)

export const brandRoutes: Router = publicRouter
export const brandAdminRoutes: Router = adminRouter
