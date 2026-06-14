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
