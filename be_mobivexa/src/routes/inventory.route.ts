import { Router } from 'express'
import { inventory } from '../controllers/product.controller'

const router: Router = Router()

router.get('/', inventory)

export const inventoryAdminRoutes: Router = router
