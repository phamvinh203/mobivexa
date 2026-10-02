import { Router } from 'express'
import * as controller from '../controllers/dashboard.controller'

// ─── Admin routes: /api/admin/dashboard ───────────────────────────────────────
// Chỉ đọc số liệu thống kê — STAFF + ADMIN như các adminRouter khác
const router: Router = Router()

router.get('/', controller.stats)

export const dashboardRoutes: Router = router
