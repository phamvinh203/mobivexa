import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { checkId } from './common.validator'

// Mỗi ký tự đều thành token gửi lên Gemini. 2000 ký tự đã dài hơn mọi câu hỏi
// mua hàng thật; dài hơn nữa là dán nội dung rác hoặc thử phá prompt.
const MAX_MESSAGE_LENGTH = 2000

export function validateSendMessage(req: Request, res: Response, next: NextFunction): void {
  const { sessionId, message } = req.body

  // sessionId không bắt buộc — thiếu thì service tự tạo phiên mới.
  if (sessionId !== undefined && !checkId(res, sessionId, 'sessionId không hợp lệ')) return

  if (typeof message !== 'string' || message.trim() === '') {
    sendError(res, 400, 'Nội dung tin nhắn không được để trống')
    return
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    sendError(res, 400, `Tin nhắn không được vượt quá ${MAX_MESSAGE_LENGTH} ký tự`)
    return
  }

  // Ghi đè tại chỗ: khoảng trắng thừa vừa tốn token vừa làm title xấu.
  req.body.message = message.trim()
  next()
}
