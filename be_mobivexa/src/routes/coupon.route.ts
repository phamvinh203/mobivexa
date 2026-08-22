import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { couponPreviewLimiter } from '../middlewares/rate_limit.middleware'
import { validateCreateCoupon, validateUpdateCoupon, validatePreviewCoupon } from '../validators/coupon.validator'
import * as controller from '../controllers/coupon.controller'

// ─── Customer routes: /api/coupons ────────────────────────────────────────────
const publicRouter: Router = Router()
publicRouter.use(authenticate)

publicRouter.get('/',         controller.listMine)
publicRouter.post('/preview', couponPreviewLimiter, validatePreviewCoupon, controller.preview)

// ─── Admin routes: /api/admin/coupons ─────────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))

adminRouter.get('/',              controller.listAdmin)
adminRouter.get('/:id',           controller.getAdmin)
adminRouter.post('/',             validateCreateCoupon, controller.create)
adminRouter.put('/:id',           validateUpdateCoupon, controller.update)
adminRouter.patch('/:id/status',  controller.toggleStatus)
adminRouter.delete('/:id',        controller.remove)

export const couponRoutes: Router = publicRouter
export const couponAdminRoutes: Router = adminRouter
