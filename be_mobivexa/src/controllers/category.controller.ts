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

export const listCategories = asyncHandler(async (_req, res) => {
  const categories = await getCategories()
  sendSuccess(res, { categories })
})

export const getCategory = asyncHandler(async (req, res) => {
  const category = await getCategoryBySlug(req.params.slug)
  sendSuccess(res, { category })
})

// ─── Admin ──────────────────────────────────────────────────────────────────

export const listCategoriesAdmin = asyncHandler(async (_req, res) => {
  const categories = await getCategories(true)
  sendSuccess(res, { categories })
})

export const createCategoryAdmin = asyncHandler(async (req, res) => {
  const category = await createCategory(req.body, req.file)
  sendSuccess(res, { message: 'Tạo danh mục thành công', category }, 201)
})

export const updateCategoryAdmin = asyncHandler(async (req, res) => {
  const category = await updateCategory(req.params.id, req.body, req.file)
  sendSuccess(res, { message: 'Cập nhật danh mục thành công', category })
})

export const deleteCategoryAdmin = asyncHandler(async (req, res) => {
  await deleteCategory(req.params.id)
  sendSuccess(res, { message: 'Xóa danh mục thành công' })
})

export const toggleCategoryStatusAdmin = asyncHandler(async (req, res) => {
  const category = await toggleCategoryStatus(req.params.id)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', category })
})
