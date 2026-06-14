import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { verifySePaySecret, paymentInfo, sepayWebhook, stats } from '../controllers/payment.controller'

const router = Router()

// Customer: get VietQR + bank details for a BANK_TRANSFER order
router.get('/orders/:id/payment', authenticate, paymentInfo)

// Webhook: public — SePay calls this when a bank transfer is detected
router.post('/webhooks/sepay', verifySePaySecret, sepayWebhook)

// Admin: thống kê thanh toán (STAFF + ADMIN)
const adminRouter = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))
adminRouter.get('/stats', stats)

export const paymentRoutes = router
export const paymentAdminRoutes = adminRouter
