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
    req.user = verifyAccessToken(token)
    next()
  } catch {
    sendError(res, 401, 'Token không hợp lệ hoặc đã hết hạn')
  }
}
