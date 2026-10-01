import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { MAX_CHAT_MESSAGE_LENGTH } from '../types/chat.type'

const MAX_SESSION_ID_LENGTH = 64

// POST /api/chat — chạy trong route SAU optionalAuthenticate, TRƯỚC chatLimiter và
// trước khi controller mở stream SSE: body lỗi trả 400 JSON chuẩn ngay (không đốt
// quota limiter, FE đọc status bình thường), còn lỗi sau khi headers đã bắn phải
// đi qua `event: error`.
export function validateSendMessage(req: Request, res: Response, next: NextFunction): void {
  const { sessionId, message } = req.body ?? {}

  if (sessionId !== undefined && (typeof sessionId !== 'string' || sessionId.length > MAX_SESSION_ID_LENGTH)) {
    sendError(res, 400, 'sessionId không hợp lệ')
    return
  }
  if (typeof message !== 'string' || message.trim() === '') {
    sendError(res, 400, 'Tin nhắn không được để trống')
    return
  }
  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    sendError(res, 400, `Tin nhắn tối đa ${MAX_CHAT_MESSAGE_LENGTH} ký tự`)
    return
  }
  next()
}
