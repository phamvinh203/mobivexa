import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { verifySePaySecret, paymentInfo, sepayWebhook } from '../controllers/payment.controller'

const router = Router()

// Customer: get VietQR + bank details for a BANK_TRANSFER order
router.get('/orders/:id/payment', authenticate, paymentInfo)

// Webhook: public — SePay calls this when a bank transfer is detected
router.post('/webhooks/sepay', verifySePaySecret, sepayWebhook)

export const paymentRoutes = router
