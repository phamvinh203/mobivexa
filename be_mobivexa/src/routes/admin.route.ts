import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize } from '../middlewares/authorize.middleware'
import { UserRole } from '../generated/prisma/client'
import { validateUpdateUserRole } from '../validators/admin.validator'
import * as controller from '../controllers/admin.controller'

const router: Router = Router()

// Chỉ ADMIN — không cho STAFF quản lý user
router.use(authenticate, authorize(UserRole.ADMIN))

router.get('/', controller.getUsers)
router.get('/:id', controller.getUser)
router.patch('/:id/role', validateUpdateUserRole, controller.changeUserRole)
router.patch('/:id/status', controller.toggleStatus)
router.delete('/:id', controller.removeUser)

export const adminUserRoutes: Router = router
