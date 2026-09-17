import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/token_manager'
import { sendError } from '../helpers/response'
import { JwtPayload } from '../types/auth.type'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 401, 'Không có token xác thực')
    return
  }

  const token = authHeader.slice(7)

  try {
    const payload = verifyAccessToken(token)
    // Phòng thủ lớp hai: verifyAccessToken đã chặn guest token, ở đây chặn nốt
    // nốt payload thiếu userId để không bao giờ chạy query không giới hạn theo user
    if (typeof payload.userId !== 'string' || !payload.userId) {
      sendError(res, 401, 'Token không hợp lệ hoặc đã hết hạn')
      return
    }
    req.user = payload
    next()
  } catch {
    sendError(res, 401, 'Token không hợp lệ hoặc đã hết hạn')
  }
}

// Bản mềm của authenticate, dành cho endpoint phục vụ cả khách vãng lai.
//
// Token hỏng hoặc hết hạn KHÔNG trả 401: với chatbot, khách mở lại tab cũ mang
// theo token quá hạn vẫn nên chat được như người chưa đăng nhập, thay vì bị chặn
// giữa chừng bởi một thứ họ không biết là gì.
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(authHeader.slice(7))
    } catch {
      // Bỏ qua: coi như khách chưa đăng nhập
    }
  }

  next()
}
