import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as controller from '../controllers/auth.controller'
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateRefreshToken,
} from '../validators/auth.validator'

const router: Router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10,
  message: { message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/register',        authLimiter, validateRegister,        controller.register)
router.post('/login',           authLimiter, validateLogin,           controller.login)
router.post('/refresh',         authLimiter, validateRefreshToken,    controller.refreshToken)
router.post('/forgot-password', authLimiter, validateForgotPassword,  controller.forgotPassword)
router.post('/reset-password',  authLimiter, validateResetPassword,   controller.resetPassword)
router.post('/logout',                       validateRefreshToken,    controller.logout)

export const authRoutes: Router = router
