import { Response } from 'express'
import { sendError } from '../helpers/response'

export function checkQuantity(res: Response, qty: number, max?: number): boolean {
  if (!Number.isInteger(qty) || qty < 1 || (max !== undefined && qty > max)) {
    sendError(res, 400, max !== undefined ? `Số lượng phải là số nguyên từ 1 đến ${max}` : 'Số lượng phải là số nguyên dương')
    return false
  }
  return true
}

// Parse 1 field từ JSON string (multipart/form-data gửi array/object dạng chuỗi).
// Trả về true nếu OK (hoặc field không phải string), false (và đã gửi lỗi) nếu parse fail.
export function parseJsonField(res: Response, body: Record<string, unknown>, key: string): boolean {
  if (typeof body[key] === 'string') {
    try {
      body[key] = JSON.parse(body[key] as string)
    } catch {
      sendError(res, 400, `${key} phải là JSON hợp lệ`)
      return false
    }
  }
  return true
}

// Parse 1 field số nguyên tại chỗ — anh em của parseJsonField cho scalar.
// Multipart/form-data gửi mọi field dạng chuỗi, nên "5" phải được ghi đè thành 5
// trước khi xuống Prisma (cột Int). Validate mà không ghi lại thì tầng dưới vẫn
// nhận chuỗi và Prisma ném "Expected Int, provided String".
export function parseIntField(
  res: Response,
  body: Record<string, unknown>,
  key: string,
  { min, max, message }: { min: number; max: number; message: string },
): boolean {
  const value = Number(body[key])
  if (!Number.isInteger(value) || value < min || value > max) {
    sendError(res, 400, message)
    return false
  }
  body[key] = value
  return true
}

// Kiểm tra field id dạng chuỗi: true nếu hợp lệ, false (và đã gửi lỗi) nếu không.
//
// Cố tình KHÔNG kiểm tra dạng uuid: id sai dạng vẫn ra 404 ở tầng service, còn
// ràng buộc hình thức ở đây sẽ chặn nhầm nếu sau này đổi kiểu khoá. Việc duy
// nhất của nó là chặn undefined/null/số/object lọt xuống Prisma.
export function checkId(res: Response, value: unknown, message: string): boolean {
  if (!value || typeof value !== 'string') {
    sendError(res, 400, message)
    return false
  }
  return true
}

// Kiểm tra field "tên": trả về true nếu hợp lệ, false (và đã gửi lỗi) nếu không.
// optional=true dùng cho update — chỉ validate khi field được gửi lên.
export function checkName(
  res: Response,
  name: unknown,
  label: string,
  { optional = false, min = 2 }: { optional?: boolean; min?: number } = {},
): boolean {
  if (optional && name === undefined) return true

  if (!name || String(name).trim().length < min) {
    sendError(res, 400, `${label} phải có ít nhất ${min} ký tự`)
    return false
  }
  return true
}
