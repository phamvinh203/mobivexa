import { Router } from 'express'
import { authorize } from '../middlewares/authorize.middleware'
import { UserRole } from '../generated/prisma/client'
import { validateUpdateUserRole } from '../validators/admin.validator'
import * as controller from '../controllers/admin.controller'

const router: Router = Router()

// Chỉ ADMIN — không cho STAFF quản lý user. Đăng nhập + STAFF/ADMIN đã được kiểm
// một lần ở mount /api/admin (index.route.ts), ở đây chỉ siết thêm role.
router.use(authorize(UserRole.ADMIN))

router.get('/', controller.getUsers)
router.get('/:id', controller.getUser)
router.patch('/:id/role', validateUpdateUserRole, controller.changeUserRole)
router.patch('/:id/status', controller.toggleStatus)
router.delete('/:id', controller.removeUser)

export const adminUserRoutes: Router = router
