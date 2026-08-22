import { Router } from 'express'
import { avatarLimiter } from '../middlewares/rate_limit.middleware'
import { authenticate } from '../middlewares/auth.middleware'
import { uploadImage } from '../middlewares/upload.middleware'
import { validateUpdateProfile, validateChangePassword, validateAddress } from '../validators/user.validator'
import * as controller from '../controllers/user.controller'

const router: Router = Router()

// Tất cả user routes đều yêu cầu đăng nhập
router.use(authenticate)

// Profile
router.get('/me',                  controller.getMe)
router.put('/me',                  validateUpdateProfile,  controller.updateMe)
router.put('/me/password',         validateChangePassword, controller.changeMyPassword)
router.post('/me/avatar',          avatarLimiter, uploadImage.single('avatar'), controller.uploadMyAvatar)

// Addresses
router.get('/me/addresses',                                           controller.getMyAddresses)
router.post('/me/addresses',       validateAddress,                   controller.createMyAddress)
router.put('/me/addresses/:id',    validateAddress,                   controller.updateMyAddress)
router.delete('/me/addresses/:id',                                    controller.deleteMyAddress)
router.patch('/me/addresses/:id/default',                             controller.setMyDefaultAddress)

export const userRoutes: Router = router
