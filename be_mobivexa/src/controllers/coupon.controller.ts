import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import {
  listCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  listActiveCoupons,
  previewCoupon,
} from '../services/coupon.service'
import type { PreviewCouponBody } from '../types/coupon.type'

// ─── Admin ────────────────────────────────────────────────────────────────────

export const listAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await listCoupons(req.query)
  sendSuccess(res, result)
})

export const getAdmin = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await getCouponById(req.params.id as string)
  sendSuccess(res, { coupon })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await createCoupon(req.body)
  sendSuccess(res, { message: 'Tạo mã giảm giá thành công', coupon }, 201)
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await updateCoupon(req.params.id as string, req.body)
  sendSuccess(res, { message: 'Cập nhật mã giảm giá thành công', coupon })
})

export const toggleStatus = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await toggleCouponStatus(req.params.id as string)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', coupon })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteCoupon(req.params.id as string)
  sendSuccess(res, { message: 'Xóa mã giảm giá thành công' })
})

// ─── Customer ─────────────────────────────────────────────────────────────────

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const result = await listActiveCoupons(req.user!.userId)
  sendSuccess(res, result)
})

export const preview = asyncHandler(async (req: Request, res: Response) => {
  // Gắn kiểu vào chỗ bóc body để interface là hợp đồng THẬT của endpoint: đổi
  // chữ ký previewCoupon hay đổi PreviewCouponBody mà quên bên kia là lỗi biên
  // dịch, chứ không phải một field undefined lặng lẽ chạy tiếp tới tầng service.
  const { code, items }: PreviewCouponBody = req.body
  const result = await previewCoupon(req.user!.userId, code, items)
  sendSuccess(res, result)
})
