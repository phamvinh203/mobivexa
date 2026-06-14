import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { uploadImage } from '../middlewares/upload.middleware'
import { validateCreateBanner, validateUpdateBanner } from '../validators/banner.validator'
import * as controller from '../controllers/banner.controller'

// ─── Public routes: /api/banners ──────────────────────────────────────────────
const publicRouter: Router = Router()
publicRouter.get('/', controller.listBanners)                  // ?position=HERO|LEFT|RIGHT|HORIZONTAL
publicRouter.get('/positions', controller.listBannerPositions) // danh sách vị trí

// ─── Admin routes: /api/admin/banners ─────────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))
adminRouter.get('/', controller.listBannersAdmin)              // ?position=...
adminRouter.get('/positions', controller.listBannerPositions)
adminRouter.post('/', uploadImage.single('image'), validateCreateBanner, controller.createBannerAdmin)
adminRouter.put('/:id', uploadImage.single('image'), validateUpdateBanner, controller.updateBannerAdmin)
adminRouter.delete('/:id', controller.deleteBannerAdmin)
adminRouter.patch('/:id/status', controller.toggleBannerStatusAdmin)

export const bannerRoutes: Router = publicRouter
export const bannerAdminRoutes: Router = adminRouter
