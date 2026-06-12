import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { uploadImage } from '../middlewares/upload.middleware'
import {
  validateCreateReview,
  validateUpdateReview,
  validateReplyReview,
} from '../validators/review.validator'
import * as controller from '../controllers/review.controller'

// ─── Public: GET /api/products/:slug/reviews[/summary] ────────────────────────
const publicRouter: Router = Router({ mergeParams: true })
publicRouter.get('/summary', controller.getSummary)
publicRouter.get('/',        controller.list)

// ─── User: GET /api/users/me/reviews[/pending] ────────────────────────────────
const userRouter: Router = Router()
userRouter.use(authenticate)
userRouter.get('/pending', controller.getPending)
userRouter.get('/',        controller.getMyReviews)

// ─── User: POST /api/order-items/:orderItemId/review ──────────────────────────
const orderItemRouter: Router = Router({ mergeParams: true })
orderItemRouter.use(authenticate)
orderItemRouter.post('/', uploadImage.array('photos', 5), validateCreateReview, controller.create)

// ─── User: /api/reviews/:id ───────────────────────────────────────────────────
const reviewRouter: Router = Router()
reviewRouter.use(authenticate)
reviewRouter.put(   '/:id',         uploadImage.array('photos', 5), validateUpdateReview, controller.update)
reviewRouter.delete('/:id',                                                                controller.deleteOwn)
reviewRouter.post(  '/:id/helpful',                                                        controller.helpful)

// ─── Admin: /api/admin/reviews ────────────────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))
adminRouter.get(   '/',                                            controller.adminList)
adminRouter.post(  '/:id/reply',  validateReplyReview,             controller.adminReply)
adminRouter.delete('/:id',                                         controller.adminDelete)

export const reviewPublicRoutes    = publicRouter
export const reviewUserRoutes      = userRouter
export const reviewOrderItemRoutes = orderItemRouter
export const reviewRoutes          = reviewRouter
export const reviewAdminRoutes     = adminRouter
