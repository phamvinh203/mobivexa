import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import { getCart, addItem, updateItem, removeItem, clearCart } from '../services/cart.service'

export const get = asyncHandler(async (req: Request, res: Response) => {
  const cart = await getCart(req.user!.userId)
  sendSuccess(res, { cart })
})

export const add = asyncHandler(async (req: Request, res: Response) => {
  const cart = await addItem(req.user!.userId, req.body)
  sendSuccess(res, { message: 'Đã thêm vào giỏ hàng', cart }, 201)
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const cart = await updateItem(req.user!.userId, req.params.itemId as string, req.body)
  sendSuccess(res, { message: 'Đã cập nhật số lượng', cart })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const cart = await removeItem(req.user!.userId, req.params.itemId as string)
  sendSuccess(res, { message: 'Đã xóa khỏi giỏ hàng', cart })
})

export const clear = asyncHandler(async (req: Request, res: Response) => {
  await clearCart(req.user!.userId)
  sendSuccess(res, { message: 'Đã xóa toàn bộ giỏ hàng' })
})
