import { Router } from 'express'
import { optionalAuthenticate } from '../middlewares/auth.middleware'
import { chatLimiter } from '../middlewares/rate_limit.middleware'
import { validateSendMessage } from '../validators/chat.validator'
import * as controller from '../controllers/chat.controller'

const router: Router = Router()

// optionalAuthenticate cho cả nhóm: khách vãng lai chat được, còn user đăng nhập
// thì phiên tự gắn về tài khoản của họ.
router.use(optionalAuthenticate)

router.post('/sessions',              chatLimiter,                        controller.create)
router.post('/messages',              chatLimiter, validateSendMessage,   controller.send)
router.get('/sessions/:id/messages',                                      controller.messages)

export const chatRoutes: Router = router
