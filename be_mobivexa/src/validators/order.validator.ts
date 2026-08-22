import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { checkId, checkQuantity } from './common.validator'
import { CODE_RE, MAX_CODE_LENGTH } from './coupon.validator'
import { PaymentMethod, OrderStatus, PaymentStatus } from '../generated/prisma/client'

export function validateCreateOrder(req: Request, res: Response, next: NextFunction): void {
  const { addressId, paymentMethod, items, couponCode } = req.body

  if (!checkId(res, addressId, 'Vui lòng chọn địa chỉ giao hàng')) return

  if (paymentMethod && !Object.values(PaymentMethod).includes(paymentMethod)) {
    sendError(res, 400, 'Phương thức thanh toán không hợp lệ')
    return
  }

  // Cổng cho couponCode, mở đúng khi giá trị TRUTHY — bản sao chính xác của
  // `if (couponCode)` trong createOrder, nên mọi giá trị chạm tới normalizeCode
  // đều đã đi qua đây. Không dùng `!== undefined`: form luôn gửi kèm field thì ô
  // trống ra chuỗi rỗng, mà bắt lỗi chuỗi rỗng là khoá luôn đường đặt hàng của
  // khách không dùng mã — trong khi service vốn coi nó là "không có mã".
  //
  // Thiếu cổng này thì couponCode: 123 (truthy) đi trọn tới raw.trim() và nổ
  // TypeError thành 500 "Lỗi server", đúng ca mà preview đã chặn từ lâu.
  if (couponCode) {
    if (!checkId(res, couponCode, 'Mã giảm giá không hợp lệ')) return

    if (couponCode.trim().length > MAX_CODE_LENGTH) {
      sendError(res, 400, `Mã giảm giá không được dài quá ${MAX_CODE_LENGTH} ký tự`)
      return
    }

    // Chặt hơn validatePreviewCoupon một bậc, và chặt hơn một cách AN TOÀN: mã nào
    // nằm được trong DB cũng đã qua CODE_RE ở validateBody lúc tạo, nên hình thức
    // này không thể từ chối một mã mà preview vừa báo dùng được. Cái nó chặn là
    // chuỗi rác đúng độ dài ("!!!!") — thứ duy nhất nó làm được là tốn một lượt
    // findUnique.
    if (!CODE_RE.test(couponCode.trim().toUpperCase())) {
      sendError(res, 400, 'Mã chỉ gồm chữ, số, gạch ngang và gạch dưới, dài 3-32 ký tự')
      return
    }
  }

  if (items !== undefined) {
    if (!Array.isArray(items) || items.length === 0) {
      sendError(res, 400, 'Danh sách sản phẩm không hợp lệ')
      return
    }
    for (const item of items) {
      if (!checkId(res, item.variantId, 'variantId không hợp lệ')) return
      if (!checkQuantity(res, Number(item.quantity))) return
    }
  }

  next()
}

export function validateUpdateStatus(req: Request, res: Response, next: NextFunction): void {
  const { status, cancelReason } = req.body

  if (!Object.values(OrderStatus).includes(status)) {
    sendError(res, 400, 'Trạng thái đơn hàng không hợp lệ')
    return
  }

  if (status === OrderStatus.CANCELLED && !cancelReason?.trim()) {
    sendError(res, 400, 'Vui lòng nhập lý do hủy đơn')
    return
  }

  next()
}

export function validateUpdatePayment(req: Request, res: Response, next: NextFunction): void {
  if (!Object.values(PaymentStatus).includes(req.body.paymentStatus)) {
    sendError(res, 400, 'Trạng thái thanh toán không hợp lệ')
    return
  }
  next()
}
