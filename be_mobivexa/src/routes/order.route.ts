import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { validateCreateOrder, validateUpdateStatus, validateUpdatePayment } from '../validators/order.validator'
import * as controller from '../controllers/order.controller'

// ─── Customer routes: /api/orders ─────────────────────────────────────────────
const customerRouter: Router = Router()
customerRouter.use(authenticate)

customerRouter.post('/',           validateCreateOrder, controller.create)
customerRouter.get('/',                                 controller.listMine)
customerRouter.get('/:id',                              controller.getMine)
customerRouter.patch('/:id/cancel',                     controller.cancel)

// ─── Admin routes: /api/admin/orders ──────────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))

adminRouter.get('/',                                      controller.list)
adminRouter.get('/:id',                                   controller.get)
adminRouter.patch('/:id/status',  validateUpdateStatus,   controller.updateStatus)
adminRouter.patch('/:id/payment', validateUpdatePayment,  controller.updatePayment)

export const orderRoutes      = customerRouter
export const orderAdminRoutes = adminRouter
