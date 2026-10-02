import { Request, Response, NextFunction, RequestHandler } from 'express'

// Route trong dự án chỉ dùng tham số dạng `:name` — Express 5 chỉ trả mảng cho
// wildcard (`*splat`), mà dự án không có — nên req.params.x luôn là string. Khai
// báo ở đây một lần để controller khỏi phải `as string` ở từng chỗ đọc param.
type ParamsRequest = Request<Record<string, string>>

// Bọc handler async, tự chuyển lỗi vào next() để error middleware xử lý
export const asyncHandler =
  (fn: (req: ParamsRequest, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req as ParamsRequest, res, next).catch(next)
  }
