import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import {
  getOrderPaymentInfo,
  getOrderPaymentStatus,
  processSePayWebhook,
  getPaymentStats,
  listTransactions,
  matchTransaction,
  syncFromSePay,
} from '../services/payment.service'
import { SePayTxStatus } from '../generated/prisma/client'
import type { SePayWebhookPayload, TransactionListQuery } from '../types/payment.type'

// ─── Customer ─────────────────────────────────────────────────────────────────

export const paymentInfo = asyncHandler(async (req, res) => {
  const info = await getOrderPaymentInfo(req.user!.userId, req.params.id)
  sendSuccess(res, info)
})

// FE polling endpoint này trong lúc hiển thị QR để tự chuyển màn khi tiền về
export const paymentStatus = asyncHandler(async (req, res) => {
  const status = await getOrderPaymentStatus(req.user!.userId, req.params.id)
  sendSuccess(res, status)
})

// ─── Webhook ──────────────────────────────────────────────────────────────────

export const sepayWebhook = asyncHandler(async (req, res) => {
  const result = await processSePayWebhook(req.body as SePayWebhookPayload)
  res.json({ success: true, ...result })
})

// ─── Admin ────────────────────────────────────────────────────────────────────

export const stats = asyncHandler(async (_req, res) => {
  const data = await getPaymentStats()
  sendSuccess(res, data)
})

export const transactions = asyncHandler(async (req, res) => {
  const data = await listTransactions(req.query as TransactionListQuery)
  sendSuccess(res, data)
})

// Giao dịch tiền đã về nhưng chưa gán được đơn — hàng chờ xử lý của admin.
// Chỉ là /transactions ép sẵn status=UNMATCHED, không thêm code path ở service.
export const unmatchedTransactions = asyncHandler(async (req, res) => {
  const data = await listTransactions({ ...req.query, status: SePayTxStatus.UNMATCHED } as TransactionListQuery)
  sendSuccess(res, data)
})

export const matchTx = asyncHandler(async (req, res) => {
  const tx = await matchTransaction(req.params.txId, req.body, req.user!.userId)
  sendSuccess(res, { message: 'Gán giao dịch vào đơn hàng thành công', transaction: tx })
})

export const sync = asyncHandler(async (req, res) => {
  const { limit, from, to } = req.query
  const summary = await syncFromSePay({
    limit: limit ? Number(limit) : undefined,
    from:  from as string | undefined,
    to:    to   as string | undefined,
  })
  sendSuccess(res, { message: 'Đồng bộ giao dịch từ SePay hoàn tất', ...summary })
})
