import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { validateCreateCoupon, validateUpdateCoupon } from '../validators/coupon.validator'
import * as controller from '../controllers/coupon.controller'

// ─── Admin routes: /api/admin/coupons ─────────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))

adminRouter.get('/',              controller.listAdmin)
adminRouter.get('/:id',           controller.getAdmin)
adminRouter.post('/',             validateCreateCoupon, controller.create)
adminRouter.put('/:id',           validateUpdateCoupon, controller.update)
adminRouter.patch('/:id/status',  controller.toggleStatus)
adminRouter.delete('/:id',        controller.remove)

export const couponAdminRoutes: Router = adminRouter
