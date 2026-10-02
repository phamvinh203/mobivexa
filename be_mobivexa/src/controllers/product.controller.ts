import { asyncHandler } from '../helpers/async_handler'
import { AppError } from '../helpers/app_error'
import { sendSuccess } from '../helpers/response'
import {
  listProducts,
  getProductBySlug,
  getProductById,
  getFeaturedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  toggleProductFeatured,
  addVariant,
  updateVariant,
  updateVariantStock,
  deleteVariant,
  addProductImages,
  deleteProductImage,
  setProductImageCover,
  replaceProductSpecs,
  getInventory,
} from '../services/product.service'

// ─── Public ─────────────────────────────────────────────────────────────────

export const list = asyncHandler(async (req, res) => {
  const result = await listProducts(req.query)
  sendSuccess(res, result)
})

export const listAdmin = asyncHandler(async (req, res) => {
  const result = await listProducts(req.query, { admin: true })
  sendSuccess(res, result)
})

export const getAdmin = asyncHandler(async (req, res) => {
  const product = await getProductById(req.params.id)
  sendSuccess(res, { product })
})

export const featured = asyncHandler(async (_req, res) => {
  const products = await getFeaturedProducts()
  sendSuccess(res, { products })
})

export const detail = asyncHandler(async (req, res) => {
  const product = await getProductBySlug(req.params.slug)
  sendSuccess(res, { product })
})

// ─── Admin: Product ───────────────────────────────────────────────────────────

export const create = asyncHandler(async (req, res) => {
  const product = await createProduct(req.body, req.files as Express.Multer.File[])
  sendSuccess(res, { message: 'Tạo sản phẩm thành công', product }, 201)
})

export const update = asyncHandler(async (req, res) => {
  const product = await updateProduct(req.params.id, req.body, req.files as Express.Multer.File[])
  sendSuccess(res, { message: 'Cập nhật sản phẩm thành công', product })
})

export const remove = asyncHandler(async (req, res) => {
  await deleteProduct(req.params.id)
  sendSuccess(res, { message: 'Xóa sản phẩm thành công' })
})

export const toggleStatus = asyncHandler(async (req, res) => {
  const product = await toggleProductStatus(req.params.id)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', product })
})

export const toggleFeatured = asyncHandler(async (req, res) => {
  const product = await toggleProductFeatured(req.params.id)
  sendSuccess(res, { message: 'Cập nhật nổi bật thành công', product })
})

// ─── Admin: Product Images ────────────────────────────────────────────────────

export const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files as Express.Multer.File[]
  if (!files?.length) throw new AppError(400, 'Vui lòng chọn ít nhất 1 ảnh')
  const result = await addProductImages(req.params.id, files)
  sendSuccess(res, { message: `Đã thêm ${result.count} ảnh`, count: result.count }, 201)
})

export const removeImage = asyncHandler(async (req, res) => {
  await deleteProductImage(req.params.id, req.params.imageId)
  sendSuccess(res, { message: 'Đã xóa ảnh' })
})

export const setCover = asyncHandler(async (req, res) => {
  const images = await setProductImageCover(req.params.id, req.params.imageId)
  sendSuccess(res, { message: 'Đã đặt làm ảnh bìa', images })
})

// ─── Admin: Product specs ─────────────────────────────────────────────────────

export const replaceSpecs = asyncHandler(async (req, res) => {
  const specs = await replaceProductSpecs(req.params.id, req.body.specs)
  sendSuccess(res, { message: 'Cập nhật thông số kỹ thuật thành công', specs })
})

// ─── Admin: Variant ─────────────────────────────────────────────────────────

export const createVariant = asyncHandler(async (req, res) => {
  const variant = await addVariant(req.params.id, req.body)
  sendSuccess(res, { message: 'Thêm phiên bản thành công', variant }, 201)
})

export const editVariant = asyncHandler(async (req, res) => {
  const variant = await updateVariant(req.params.id, req.params.variantId, req.body)
  sendSuccess(res, { message: 'Cập nhật phiên bản thành công', variant })
})

export const removeVariant = asyncHandler(async (req, res) => {
  await deleteVariant(req.params.id, req.params.variantId)
  sendSuccess(res, { message: 'Xóa phiên bản thành công' })
})

// ─── Admin: Stock ─────────────────────────────────────────────────────────────

export const patchStock = asyncHandler(async (req, res) => {
  const { expectedStock } = req.body
  const variant = await updateVariantStock(
    req.params.id,
    req.params.variantId,
    Number(req.body.stock),
    expectedStock === undefined ? undefined : Number(expectedStock),
  )
  sendSuccess(res, { message: 'Cập nhật tồn kho thành công', variant })
})

// ─── Admin: Inventory ─────────────────────────────────────────────────────────

export const inventory = asyncHandler(async (req, res) => {
  const result = await getInventory(req.query)
  sendSuccess(res, result)
})
