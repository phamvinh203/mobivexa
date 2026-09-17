import { Router } from 'express'
import { authLimiter, catalogLimiter } from '../middlewares/rate_limit.middleware'
import * as controller from '../controllers/auth.controller'
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateRefreshToken,
} from '../validators/auth.validator'

const router: Router = Router()

router.post('/register',        authLimiter, validateRegister,        controller.register)
router.post('/login',           authLimiter, validateLogin,           controller.login)
router.post('/refresh',         authLimiter, validateRefreshToken,    controller.refreshToken)
router.post('/forgot-password', authLimiter, validateForgotPassword,  controller.forgotPassword)
router.post('/reset-password',  authLimiter, validateResetPassword,   controller.resetPassword)
// catalogLimiter thay vì authLimiter vì logout là ghi DB không cần đăng nhập
// (có thể bị spam) nhưng 10 lượt/15 phút của authLimiter quá chặt cho logout.
router.post('/logout',         catalogLimiter,         validateRefreshToken,    controller.logout)

export const authRoutes: Router = router
