import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { inventory } from '../controllers/product.controller'

const router: Router = Router()

router.use(authenticate, authorize(...STAFF_ROLES))
router.get('/', inventory)

export const inventoryAdminRoutes: Router = router
