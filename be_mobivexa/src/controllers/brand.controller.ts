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

export const listBrands = asyncHandler(async (_req, res) => {
  const brands = await getBrands()
  sendSuccess(res, { brands })
})

export const getBrand = asyncHandler(async (req, res) => {
  const brand = await getBrandBySlug(req.params.slug)
  sendSuccess(res, { brand })
})

// ─── Admin ──────────────────────────────────────────────────────────────────

export const listBrandsAdmin = asyncHandler(async (_req, res) => {
  const brands = await getBrands(true)
  sendSuccess(res, { brands })
})

export const createBrandAdmin = asyncHandler(async (req, res) => {
  const brand = await createBrand(req.body, req.file)
  sendSuccess(res, { message: 'Tạo thương hiệu thành công', brand }, 201)
})

export const updateBrandAdmin = asyncHandler(async (req, res) => {
  const brand = await updateBrand(req.params.id, req.body, req.file)
  sendSuccess(res, { message: 'Cập nhật thương hiệu thành công', brand })
})

export const deleteBrandAdmin = asyncHandler(async (req, res) => {
  await deleteBrand(req.params.id)
  sendSuccess(res, { message: 'Xóa thương hiệu thành công' })
})

export const toggleBrandStatusAdmin = asyncHandler(async (req, res) => {
  const brand = await toggleBrandStatus(req.params.id)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', brand })
})
