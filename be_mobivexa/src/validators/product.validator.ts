import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { checkName } from './common.validator'

// Kiểm tra 1 variant hợp lệ — trả về message lỗi hoặc null nếu OK
function checkVariant(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'Phiên bản sản phẩm không hợp lệ'
  const { sku, originalPrice, salePrice } = v as Record<string, unknown>

  if (!sku || String(sku).trim().length === 0) return 'SKU không được để trống'
  if (typeof originalPrice !== 'number' || originalPrice < 0) return 'Giá gốc không hợp lệ'
  if (typeof salePrice !== 'number' || salePrice < 0) return 'Giá bán không hợp lệ'
  if (salePrice > originalPrice) return 'Giá bán không được lớn hơn giá gốc'
  return null
}

export function validateCreateProduct(req: Request, res: Response, next: NextFunction): void {
  // multipart/form-data gửi variants dưới dạng JSON string
  if (typeof req.body.variants === 'string') {
    try {
      req.body.variants = JSON.parse(req.body.variants)
    } catch {
      sendError(res, 400, 'variants phải là JSON hợp lệ')
      return
    }
  }

  const { categoryId, brandId, variants } = req.body

  if (!checkName(res, req.body.name, 'Tên sản phẩm')) return
  if (!categoryId) {
    sendError(res, 400, 'Vui lòng chọn danh mục')
    return
  }
  if (!brandId) {
    sendError(res, 400, 'Vui lòng chọn thương hiệu')
    return
  }
  if (!Array.isArray(variants) || variants.length === 0) {
    sendError(res, 400, 'Sản phẩm phải có ít nhất một phiên bản')
    return
  }
  for (const v of variants) {
    const err = checkVariant(v)
    if (err) {
      sendError(res, 400, err)
      return
    }
  }

  next()
}

export function validateUpdateProduct(req: Request, res: Response, next: NextFunction): void {
  if (!checkName(res, req.body.name, 'Tên sản phẩm', { optional: true })) return
  next()
}

export function validateVariant(req: Request, res: Response, next: NextFunction): void {
  const err = checkVariant(req.body)
  if (err) {
    sendError(res, 400, err)
    return
  }
  next()
}

export function validateUpdateStock(req: Request, res: Response, next: NextFunction): void {
  const stock = Number(req.body.stock)
  if (!Number.isInteger(stock) || stock < 0) {
    sendError(res, 400, 'Tồn kho phải là số nguyên không âm')
    return
  }
  next()
}
