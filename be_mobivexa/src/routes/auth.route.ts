import { Router } from 'express'
import * as controller from '../controllers/auth.controller'

const router: Router = Router()

// Public — không cần token
router.post('/register',        controller.register)
router.post('/login',           controller.login)
router.post('/refresh',         controller.refreshToken)
router.post('/forgot-password', controller.forgotPassword)
router.post('/reset-password',  controller.resetPassword)
router.post('/logout',          controller.logout)


// router.post('/logout',          authenticate, controller.logout)

export const authRoutes: Router = router
