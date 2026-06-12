import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { validateAddItem, validateUpdateItem } from '../validators/cart.validator'
import * as controller from '../controllers/cart.controller'

const router: Router = Router()

router.use(authenticate)

router.get('/',                         controller.get)
router.post('/items',    validateAddItem,    controller.add)
router.put('/items/:itemId',  validateUpdateItem, controller.update)
router.delete('/items/:itemId',             controller.remove)
router.delete('/',                      controller.clear)

export const cartRoutes: Router = router
