import { Router } from 'express'
import { optionalAuthenticate } from '../middlewares/optional_auth.middleware'
import { supportMessageLimiter, supportTicketLimiter } from '../middlewares/rate_limit.middleware'
import { validateCreateTicket, validateSupportMessage } from '../validators/support.validator'
import * as controller from '../controllers/support.controller'

// ─── Khách: /api/support-tickets ──────────────────────────────────────────────
// Public cho guest (optional auth): guest xác thực phiên bằng header
// x-ticket-code, user đã đăng nhập thì JWT tự khớp ticket.userId.
const router: Router = Router()

router.post('/', optionalAuthenticate, validateCreateTicket, supportTicketLimiter, controller.create)
// Polling 3-5s của khách đi vào GET — không đặt limiter như POST để không tự bắn
// chính mình; chống dò id UUID là vô nghĩa, quyền đọc đã chặn bằng accessCode/JWT.
router.get('/:id', optionalAuthenticate, controller.get)
router.post('/:id/messages', optionalAuthenticate, validateSupportMessage, supportMessageLimiter, controller.sendMessage)

export const supportRoutes: Router = router

// ─── Admin: /api/admin/support-tickets ────────────────────────────────────────
// STAFF + ADMIN như các adminRouter khác — staff trực chat là STAFF.
const adminRouter: Router = Router()

adminRouter.get('/', controller.list)
adminRouter.get('/:id', controller.getAdmin)
adminRouter.post('/:id/claim', controller.claim)
adminRouter.post('/:id/messages', validateSupportMessage, controller.sendStaffMessage)
adminRouter.post('/:id/close', controller.close)

export const supportAdminRoutes: Router = adminRouter
