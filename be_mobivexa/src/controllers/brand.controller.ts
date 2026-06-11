import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import {
  getBrands,
  getBrandBySlug,
  createBrand,
  updateBrand,
  deleteBrand,
  toggleBrandStatus,
} from '../services/brand.service'

// ─── Public ─────────────────────────────────────────────────────────────────

export const listBrands = asyncHandler(async (_req: Request, res: Response) => {
  const brands = await getBrands()
  sendSuccess(res, { brands })
})

export const getBrand = asyncHandler(async (req: Request, res: Response) => {
  const brand = await getBrandBySlug(req.params.slug as string)
  sendSuccess(res, { brand })
})

// ─── Admin ──────────────────────────────────────────────────────────────────

export const listBrandsAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const brands = await getBrands(true)
  sendSuccess(res, { brands })
})

export const createBrandAdmin = asyncHandler(async (req: Request, res: Response) => {
  const brand = await createBrand(req.body, req.file)
  sendSuccess(res, { message: 'Tạo thương hiệu thành công', brand }, 201)
})

export const updateBrandAdmin = asyncHandler(async (req: Request, res: Response) => {
  const brand = await updateBrand(req.params.id as string, req.body, req.file)
  sendSuccess(res, { message: 'Cập nhật thương hiệu thành công', brand })
})

export const deleteBrandAdmin = asyncHandler(async (req: Request, res: Response) => {
  await deleteBrand(req.params.id as string)
  sendSuccess(res, { message: 'Xóa thương hiệu thành công' })
})

export const toggleBrandStatusAdmin = asyncHandler(async (req: Request, res: Response) => {
  const brand = await toggleBrandStatus(req.params.id as string)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', brand })
})
