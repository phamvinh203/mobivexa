import { Router } from 'express'
import { authLimiter } from '../middlewares/rate_limit.middleware'
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
router.post('/logout',                       validateRefreshToken,    controller.logout)

export const authRoutes: Router = router
