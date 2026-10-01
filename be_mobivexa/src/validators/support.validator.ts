import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { MAX_SUPPORT_MESSAGE_LENGTH, MAX_SUPPORT_NAME_LENGTH } from '../types/support.type'

// POST /api/support-tickets — tạo ticket: guest phải khai tên, user đăng nhập
// để BE tự lấy fullName (gửi tên cũng bị bỏ qua, tránh giả mạo tên người khác).
export function validateCreateTicket(req: Request, res: Response, next: NextFunction): void {
  const { customerName, message } = req.body ?? {}

  if (customerName !== undefined && (typeof customerName !== 'string' || customerName.trim().length > MAX_SUPPORT_NAME_LENGTH)) {
    sendError(res, 400, `Tên tối đa ${MAX_SUPPORT_NAME_LENGTH} ký tự`)
    return
  }
  if (typeof message !== 'string' || message.trim() === '') {
    sendError(res, 400, 'Nội dung không được để trống')
    return
  }
  if (message.length > MAX_SUPPORT_MESSAGE_LENGTH) {
    sendError(res, 400, `Nội dung tối đa ${MAX_SUPPORT_MESSAGE_LENGTH} ký tự`)
    return
  }
  next()
}

// POST /api/support-tickets/:id/messages — cả khách và staff dùng chung validator.
export function validateSupportMessage(req: Request, res: Response, next: NextFunction): void {
  const { content } = req.body ?? {}

  if (typeof content !== 'string' || content.trim() === '') {
    sendError(res, 400, 'Tin nhắn không được để trống')
    return
  }
  if (content.length > MAX_SUPPORT_MESSAGE_LENGTH) {
    sendError(res, 400, `Tin nhắn tối đa ${MAX_SUPPORT_MESSAGE_LENGTH} ký tự`)
    return
  }
  next()
}
