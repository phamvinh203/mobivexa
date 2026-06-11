import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { uploadImage } from '../middlewares/upload.middleware'
import { validateCreateCategory, validateUpdateCategory } from '../validators/category.validator'
import * as controller from '../controllers/category.controller'

// ─── Public routes: /api/categories ──────────────────────────────────────────
const publicRouter: Router = Router()
publicRouter.get('/', controller.listCategories)
publicRouter.get('/:slug', controller.getCategory)

// ─── Admin routes: /api/admin/categories ──────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))
adminRouter.get('/', controller.listCategoriesAdmin)
adminRouter.post('/', uploadImage.single('image'), validateCreateCategory, controller.createCategoryAdmin)
adminRouter.put('/:id', uploadImage.single('image'), validateUpdateCategory, controller.updateCategoryAdmin)
adminRouter.delete('/:id', controller.deleteCategoryAdmin)
adminRouter.patch('/:id/status', controller.toggleCategoryStatusAdmin)

export const categoryRoutes: Router = publicRouter
export const categoryAdminRoutes: Router = adminRouter
