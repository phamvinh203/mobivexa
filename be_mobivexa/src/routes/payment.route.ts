import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { webhookLimiter, qrLimiter, syncLimiter } from '../middlewares/rate_limit.middleware'
import { verifySePaySecret } from '../middlewares/sepay_webhook.middleware'
import {
  validateSePayWebhook,
  validateMatchTransaction,
  validateTransactionQuery,
} from '../validators/payment.validator'
import * as controller from '../controllers/payment.controller'

const router = Router()

// ─── Customer ─────────────────────────────────────────────────────────────────
// Lấy VietQR + thông tin ngân hàng cho đơn BANK_TRANSFER
router.get('/orders/:id/payment', authenticate, qrLimiter, controller.paymentInfo)
// Endpoint nhẹ để FE polling trong lúc hiển thị QR — không rate limit vì FE gọi mỗi 2-3s
router.get('/orders/:id/payment/status', authenticate, controller.paymentStatus)

// ─── Webhook: public — SePay gọi vào khi phát hiện biến động số dư ────────────
router.post(
  '/webhooks/sepay',
  webhookLimiter,
  verifySePaySecret,
  validateSePayWebhook,
  controller.sepayWebhook
)

// ─── Admin: /api/admin/payment (STAFF + ADMIN) ────────────────────────────────
const adminRouter = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))

// Số liệu tổng hợp cho dashboard
adminRouter.get('/stats', controller.stats)

// Sổ cái giao dịch SePay — tra cứu, đối soát
adminRouter.get('/transactions', validateTransactionQuery, controller.transactions)
// Hàng chờ xử lý: tiền đã về nhưng chưa gán được đơn
adminRouter.get('/transactions/unmatched', controller.unmatchedTransactions)
// Gán tay giao dịch vào đơn (khách ghi sai nội dung / lệch số tiền)
adminRouter.post('/transactions/:txId/match', validateMatchTransaction, controller.matchTx)

// Kéo lại giao dịch từ SePay UserAPI khi nghi ngờ webhook bị rớt
adminRouter.post('/sync', syncLimiter, controller.sync)

export const paymentRoutes = router
export const paymentAdminRoutes = adminRouter
