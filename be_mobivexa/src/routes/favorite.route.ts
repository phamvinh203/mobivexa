import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { validateAddFavorite } from '../validators/favorite.validator'
import * as controller from '../controllers/favorite.controller'

const router: Router = Router()

router.use(authenticate)

router.get('/',                                   controller.list)
router.get('/ids',                                controller.ids)
router.post('/',           validateAddFavorite,   controller.add)
router.delete('/:productId',                      controller.remove)

export const favoriteRoutes: Router = router
