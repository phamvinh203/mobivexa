import { Request, Response, NextFunction, RequestHandler } from 'express'

// Bọc handler async, tự chuyển lỗi vào next() để error middleware xử lý
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }
