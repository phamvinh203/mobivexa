import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { SePayTxStatus } from '../generated/prisma/client'
import { ORDER_CODE_EXACT_RE } from '../utils/order_code'

// Payload SePay phải có đủ 4 field này thì mới ghi nhận được giao dịch.
// Trả 400 (thay vì 200 im lặng) để SePay đánh dấu webhook lỗi trên dashboard —
// giúp phát hiện sai cấu hình ngay lúc setup thay vì mất giao dịch âm thầm.
export function validateSePayWebhook(req: Request, res: Response, next: NextFunction): void {
  const { id, transferType, transferAmount, transactionDate } = req.body ?? {}

  if (!Number.isFinite(Number(id))) {
    sendError(res, 400, 'Payload thiếu id giao dịch')
    return
  }
  if (transferType !== 'in' && transferType !== 'out') {
    sendError(res, 400, 'transferType không hợp lệ')
    return
  }
  if (!Number.isFinite(Number(transferAmount))) {
    sendError(res, 400, 'transferAmount không hợp lệ')
    return
  }
  if (!transactionDate || isNaN(new Date(transactionDate).getTime())) {
    sendError(res, 400, 'transactionDate không hợp lệ')
    return
  }

  next()
}

export function validateMatchTransaction(req: Request, res: Response, next: NextFunction): void {
  const { orderCode } = req.body ?? {}

  if (!orderCode || typeof orderCode !== 'string') {
    sendError(res, 400, 'Vui lòng nhập mã đơn hàng')
    return
  }
  if (!ORDER_CODE_EXACT_RE.test(orderCode.trim())) {
    sendError(res, 400, 'Mã đơn hàng không đúng định dạng (ORD-YYYYMMDD-XXXXXX)')
    return
  }

  req.body.orderCode = orderCode.trim()
  next()
}

export function validateTransactionQuery(req: Request, res: Response, next: NextFunction): void {
  const { status } = req.query

  if (status && !Object.values(SePayTxStatus).includes(status as SePayTxStatus)) {
    sendError(res, 400, 'Trạng thái giao dịch không hợp lệ')
    return
  }

  next()
}
