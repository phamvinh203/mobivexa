import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import * as controller from '../controllers/dashboard.controller'

// ─── Admin routes: /api/admin/dashboard ───────────────────────────────────────
// Chỉ đọc số liệu thống kê — STAFF + ADMIN như các adminRouter khác
const router: Router = Router()
router.use(authenticate, authorize(...STAFF_ROLES))

router.get('/', controller.stats)

export const dashboardRoutes: Router = router
