import { Router } from 'express'
import { optionalAuthenticate } from '../middlewares/optional_auth.middleware'
import { chatLimiter } from '../middlewares/rate_limit.middleware'
import { validateSendMessage } from '../validators/chat.validator'
import * as controller from '../controllers/chat.controller'

// POST /api/chat — public cho guest, optional auth nhận diện user đã đăng nhập.
// Thứ tự cố ý: optional-auth (limiter key theo userId/IP cần req.user) → validate
// body → chatLimiter → controller mở stream. Validate đứng TRƯỚC limiter: body lỗi
// trả 400 JSON ngay mà KHÔNG đốt quota của guest (20/ngày) — chỉ request hợp lệ
// mới tính vào hạn mức; 400 vẫn về trước khi mở SSE nên FE đọc status bình thường.
const router: Router = Router()

router.post('/', optionalAuthenticate, validateSendMessage, chatLimiter, controller.sendMessage)

export const chatRoutes: Router = router
