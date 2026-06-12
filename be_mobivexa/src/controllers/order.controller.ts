import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import {
  createOrder,
  listMyOrders,
  getMyOrder,
  cancelMyOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
} from '../services/order.service'

// ─── Customer ─────────────────────────────────────────────────────────────────

export const create = asyncHandler(async (req: Request, res: Response) => {
  const order = await createOrder(req.user!.userId, req.body)
  sendSuccess(res, { message: 'Đặt hàng thành công', order }, 201)
})

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const result = await listMyOrders(req.user!.userId, req.query)
  sendSuccess(res, result)
})

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  const order = await getMyOrder(req.user!.userId, req.params.id as string)
  sendSuccess(res, { order })
})

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const order = await cancelMyOrder(req.user!.userId, req.params.id as string, req.body.reason)
  sendSuccess(res, { message: 'Hủy đơn hàng thành công', order })
})

// ─── Admin ────────────────────────────────────────────────────────────────────

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listOrders(req.query)
  sendSuccess(res, result)
})

export const get = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrder(req.params.id as string)
  sendSuccess(res, { order })
})

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await updateOrderStatus(req.params.id as string, req.body)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', order })
})

export const updatePayment = asyncHandler(async (req: Request, res: Response) => {
  const order = await updatePaymentStatus(req.params.id as string, req.body)
  sendSuccess(res, { message: 'Cập nhật thanh toán thành công', order })
})
