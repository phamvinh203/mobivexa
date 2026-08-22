import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { checkName, parseJsonField } from './common.validator'

// Kiểm tra 1 variant hợp lệ — trả về message lỗi hoặc null nếu OK
function checkVariant(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'Phiên bản sản phẩm không hợp lệ'
  const { sku, originalPrice, salePrice } = v as Record<string, unknown>

  if (!sku || String(sku).trim().length === 0) return 'SKU không được để trống'
  // Giá gốc 0 nghĩa là phiên bản lên storefront với giá 0đ — chặn ngay từ đây.
  // Giá bán 0 thì hợp lệ: đó là quy ước "không có giá khuyến mãi".
  // Number.isInteger chứ không phải typeof 'number': VND không có đơn vị nhỏ hơn
  // đồng, mà giá lẻ thì lan ra tận đơn hàng — subtotal lẻ khiến mã giảm phủ 100%
  // để lại vài hào, và đơn đó kẹt UNPAID vì VietQR không xin được số lẻ còn SePay
  // không khớp nổi. Chặn từ gốc rẻ hơn làm tròn ở mọi chỗ tiêu thụ.
  if (typeof originalPrice !== 'number' || !Number.isInteger(originalPrice) || originalPrice <= 0) return 'Giá gốc phải là số nguyên lớn hơn 0'
  if (typeof salePrice !== 'number' || !Number.isInteger(salePrice) || salePrice < 0) return 'Giá bán phải là số nguyên không âm'
  if (salePrice > originalPrice) return 'Giá bán không được lớn hơn giá gốc'
  return null
}

/** PUT variant là cập nhật từng phần nên chỉ kiểm tra field thực sự được gửi lên.
 *  Đối chiếu chéo giá bán với giá gốc phải làm ở service, nơi đọc được giá đang lưu. */
export function checkVariantPatch(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'Phiên bản sản phẩm không hợp lệ'
  const { sku, originalPrice, salePrice, stock } = v as Record<string, unknown>

  if (sku !== undefined && String(sku).trim().length === 0) return 'SKU không được để trống'
  if (originalPrice !== undefined && (typeof originalPrice !== 'number' || !Number.isInteger(originalPrice) || originalPrice <= 0)) return 'Giá gốc phải là số nguyên lớn hơn 0'
  if (salePrice !== undefined && (typeof salePrice !== 'number' || !Number.isInteger(salePrice) || salePrice < 0)) return 'Giá bán phải là số nguyên không âm'
  if (stock !== undefined && (!Number.isInteger(stock) || (stock as number) < 0)) return 'Tồn kho phải là số nguyên không âm'
  return null
}

// Giới hạn để một request hỏng (hoặc cố tình phá) không nhét được hàng nghìn
// dòng vào bảng product_specs
const MAX_SPECS = 60
const MAX_SPEC_LABEL = 100
const MAX_SPEC_VALUE = 500

// Kiểm tra mảng thông số — trả message lỗi hoặc null nếu OK.
// `undefined` là hợp lệ: sản phẩm không bắt buộc phải có thông số.
function checkSpecs(specs: unknown): string | null {
  if (specs === undefined) return null
  if (!Array.isArray(specs)) return 'Thông số kỹ thuật phải là một danh sách'
  if (specs.length > MAX_SPECS) return `Tối đa ${MAX_SPECS} dòng thông số`

  for (const s of specs) {
    if (!s || typeof s !== 'object') return 'Dòng thông số không hợp lệ'
    const { label, value } = s as Record<string, unknown>

    if (typeof label !== 'string' || label.trim().length === 0) return 'Tên thông số không được để trống'
    if (typeof value !== 'string' || value.trim().length === 0) return 'Giá trị thông số không được để trống'
    if (label.trim().length > MAX_SPEC_LABEL) return `Tên thông số tối đa ${MAX_SPEC_LABEL} ký tự`
    if (value.trim().length > MAX_SPEC_VALUE) return `Giá trị thông số tối đa ${MAX_SPEC_VALUE} ký tự`
  }
  return null
}

export function validateCreateProduct(req: Request, res: Response, next: NextFunction): void {
  // multipart/form-data gửi variants / tagIds / specs dưới dạng JSON string
  if (!parseJsonField(res, req.body, 'variants')) return
  if (!parseJsonField(res, req.body, 'tagIds')) return
  if (!parseJsonField(res, req.body, 'specs')) return

  const specsError = checkSpecs(req.body.specs)
  if (specsError) {
    sendError(res, 400, specsError)
    return
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
  if (!parseJsonField(res, req.body, 'tagIds')) return
  if (!checkName(res, req.body.name, 'Tên sản phẩm', { optional: true })) return
  next()
}

// Body: { specs: [{ label, value }, ...] }. Mảng rỗng hợp lệ — nghĩa là xoá sạch.
export function validateReplaceSpecs(req: Request, res: Response, next: NextFunction): void {
  if (!Array.isArray(req.body?.specs)) {
    sendError(res, 400, 'Thông số kỹ thuật phải là một danh sách')
    return
  }

  const err = checkSpecs(req.body.specs)
  if (err) {
    sendError(res, 400, err)
    return
  }

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

export function validateUpdateVariant(req: Request, res: Response, next: NextFunction): void {
  const err = checkVariantPatch(req.body)
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
  // expectedStock là tuỳ chọn — client gửi kèm để phát hiện tồn kho đã đổi từ lúc mở form.
  if (req.body.expectedStock !== undefined) {
    const expected = Number(req.body.expectedStock)
    if (!Number.isInteger(expected) || expected < 0) {
      sendError(res, 400, 'Tồn kho đối chiếu không hợp lệ')
      return
    }
  }
  next()
}
