import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
} from '../services/category.service'

// ─── Public ─────────────────────────────────────────────────────────────────

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await getCategories()
  sendSuccess(res, { categories })
})

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await getCategoryBySlug(req.params.slug as string)
  sendSuccess(res, { category })
})

// ─── Admin ──────────────────────────────────────────────────────────────────

export const listCategoriesAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await getCategories(true)
  sendSuccess(res, { categories })
})

export const createCategoryAdmin = asyncHandler(async (req: Request, res: Response) => {
  const category = await createCategory(req.body, req.file)
  sendSuccess(res, { message: 'Tạo danh mục thành công', category }, 201)
})

export const updateCategoryAdmin = asyncHandler(async (req: Request, res: Response) => {
  const category = await updateCategory(req.params.id as string, req.body, req.file)
  sendSuccess(res, { message: 'Cập nhật danh mục thành công', category })
})

export const deleteCategoryAdmin = asyncHandler(async (req: Request, res: Response) => {
  await deleteCategory(req.params.id as string)
  sendSuccess(res, { message: 'Xóa danh mục thành công' })
})

export const toggleCategoryStatusAdmin = asyncHandler(async (req: Request, res: Response) => {
  const category = await toggleCategoryStatus(req.params.id as string)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', category })
})
