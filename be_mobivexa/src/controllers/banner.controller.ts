import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import { BANNER_POSITIONS, BANNER_POSITION_LABEL, type BannerPosition } from '../types/banner.type'
import {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
} from '../services/banner.service'

// ─── Public ──────────────────────────────────────────────────────────────────

export const listBanners = asyncHandler(async (req: Request, res: Response) => {
  const position = req.query.position as BannerPosition | undefined
  const banners = await getBanners(position)
  sendSuccess(res, { banners })
})

export const listBannerPositions = asyncHandler(async (_req: Request, res: Response) => {
  const positions = BANNER_POSITIONS.map((value) => ({ value, label: BANNER_POSITION_LABEL[value] }))
  sendSuccess(res, { positions })
})

// ─── Admin ────────────────────────────────────────────────────────────────────

export const listBannersAdmin = asyncHandler(async (req: Request, res: Response) => {
  const position = req.query.position as BannerPosition | undefined
  const banners = await getBanners(position, true)
  sendSuccess(res, { banners })
})

export const createBannerAdmin = asyncHandler(async (req: Request, res: Response) => {
  const banner = await createBanner(req.body, req.file!)
  sendSuccess(res, { message: 'Tạo banner thành công', banner }, 201)
})

export const updateBannerAdmin = asyncHandler(async (req: Request, res: Response) => {
  const banner = await updateBanner(req.params.id as string, req.body, req.file)
  sendSuccess(res, { message: 'Cập nhật banner thành công', banner })
})

export const deleteBannerAdmin = asyncHandler(async (req: Request, res: Response) => {
  await deleteBanner(req.params.id as string)
  sendSuccess(res, { message: 'Xóa banner thành công' })
})

export const toggleBannerStatusAdmin = asyncHandler(async (req: Request, res: Response) => {
  const banner = await toggleBannerStatus(req.params.id as string)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', banner })
})
