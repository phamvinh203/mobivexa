import { Router } from 'express'
import { validateCreateTag } from '../validators/tag.validator'
import * as controller from '../controllers/tag.controller'

// ─── Public routes: /api/tags ─────────────────────────────────────────────────
const publicRouter: Router = Router()
publicRouter.get('/', controller.listTags)

// ─── Admin routes: /api/admin/tags ────────────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.get('/', controller.listTags)
adminRouter.post('/', validateCreateTag, controller.createTagAdmin)
adminRouter.delete('/:id', controller.deleteTagAdmin)

export const tagRoutes: Router = publicRouter
export const tagAdminRoutes: Router = adminRouter
