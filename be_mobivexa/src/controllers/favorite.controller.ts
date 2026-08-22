import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import {
  listFavorites,
  listFavoriteIds,
  addFavorite,
  removeFavorite,
} from '../services/favorite.service'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listFavorites(req.user!.userId, req.query)
  sendSuccess(res, result)
})

export const ids = asyncHandler(async (req: Request, res: Response) => {
  const productIds = await listFavoriteIds(req.user!.userId)
  sendSuccess(res, { productIds })
})

export const add = asyncHandler(async (req: Request, res: Response) => {
  const { created } = await addFavorite(req.user!.userId, req.body.productId)
  // 201 khi vừa tạo, 200 khi đã có sẵn — FE phân biệt được bằng status mà không
  // phải đọc body. Cả hai đều mang favorited: true vì trạng thái cuối như nhau.
  sendSuccess(
    res,
    { message: created ? 'Đã thêm vào yêu thích' : 'Sản phẩm đã có trong yêu thích', favorited: true },
    created ? 201 : 200,
  )
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await removeFavorite(req.user!.userId, req.params.productId as string)
  sendSuccess(res, { message: 'Đã bỏ khỏi yêu thích', favorited: false })
})
