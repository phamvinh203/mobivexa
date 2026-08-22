import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { checkId, checkQuantity } from './common.validator'
import { PaymentMethod, OrderStatus, PaymentStatus } from '../generated/prisma/client'

export function validateCreateOrder(req: Request, res: Response, next: NextFunction): void {
  const { addressId, paymentMethod, items } = req.body

  if (!checkId(res, addressId, 'Vui lòng chọn địa chỉ giao hàng')) return

  if (paymentMethod && !Object.values(PaymentMethod).includes(paymentMethod)) {
    sendError(res, 400, 'Phương thức thanh toán không hợp lệ')
    return
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
