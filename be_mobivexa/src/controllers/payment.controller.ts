import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess, sendError } from '../helpers/response'
import { getOrderPaymentInfo, processSePayWebhook, getPaymentStats } from '../services/payment.service'
import type { SePayWebhookPayload } from '../types/payment.type'

export function verifySePaySecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.SEPAY_WEBHOOK_SECRET
  if (!secret || req.headers['x-sepay-secret'] !== secret) {
    sendError(res, 401, 'Webhook secret không hợp lệ')
    return
  }
  next()
}

export const paymentInfo = asyncHandler(async (req: Request, res: Response) => {
  const info = await getOrderPaymentInfo(req.user!.userId, req.params.id as string)
  sendSuccess(res, info)
})

export const sepayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const result = await processSePayWebhook(req.body as SePayWebhookPayload)
  res.json({ success: true, ...result })
})

// Admin: thống kê thanh toán cho dashboard đối soát
export const stats = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getPaymentStats()
  sendSuccess(res, data)
})
