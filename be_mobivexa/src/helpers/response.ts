import { Response } from "express";

// Trả về lỗi với message — dùng khi cần trả lỗi ngoài luồng errorHandler
export const sendError = (res: Response, status: number, message: string) =>
  res.status(status).json({ message })

// Trả về response thành công — status mặc định là 200, truyền 201 khi tạo tài nguyên mới
export const sendSuccess = (res: Response, data: unknown, status = 200) =>
  res.status(status).json(data)
