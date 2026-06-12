import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import {
  listProducts,
  getProductBySlug,
  getFeaturedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  toggleProductFeatured,
  addVariant,
  updateVariant,
  deleteVariant,
  addProductImages,
  deleteProductImage,
  setProductImageCover,
  getInventory,
} from '../services/product.service'

// ─── Public ─────────────────────────────────────────────────────────────────

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listProducts(req.query)
  sendSuccess(res, result)
})

export const featured = asyncHandler(async (_req: Request, res: Response) => {
  const products = await getFeaturedProducts()
  sendSuccess(res, { products })
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const product = await getProductBySlug(req.params.slug as string)
  sendSuccess(res, { product })
})

// ─── Admin: Product ───────────────────────────────────────────────────────────

export const create = asyncHandler(async (req: Request, res: Response) => {
  const product = await createProduct(req.body, req.files as Express.Multer.File[])
  sendSuccess(res, { message: 'Tạo sản phẩm thành công', product }, 201)
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const product = await updateProduct(req.params.id as string, req.body, req.files as Express.Multer.File[])
  sendSuccess(res, { message: 'Cập nhật sản phẩm thành công', product })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteProduct(req.params.id as string)
  sendSuccess(res, { message: 'Xóa sản phẩm thành công' })
})

export const toggleStatus = asyncHandler(async (req: Request, res: Response) => {
  const product = await toggleProductStatus(req.params.id as string)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', product })
})

export const toggleFeatured = asyncHandler(async (req: Request, res: Response) => {
  const product = await toggleProductFeatured(req.params.id as string)
  sendSuccess(res, { message: 'Cập nhật nổi bật thành công', product })
})

// ─── Admin: Product Images ────────────────────────────────────────────────────

export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[]
  if (!files?.length) {
    res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 ảnh' })
    return
  }
  const result = await addProductImages(req.params.id as string, files)
  sendSuccess(res, { message: `Đã thêm ${result.count} ảnh`, count: result.count }, 201)
})

export const removeImage = asyncHandler(async (req: Request, res: Response) => {
  await deleteProductImage(req.params.id as string, req.params.imageId as string)
  sendSuccess(res, { message: 'Đã xóa ảnh' })
})

export const setCover = asyncHandler(async (req: Request, res: Response) => {
  const images = await setProductImageCover(req.params.id as string, req.params.imageId as string)
  sendSuccess(res, { message: 'Đã đặt làm ảnh bìa', images })
})

// ─── Admin: Variant ─────────────────────────────────────────────────────────

export const createVariant = asyncHandler(async (req: Request, res: Response) => {
  const variant = await addVariant(req.params.id as string, req.body)
  sendSuccess(res, { message: 'Thêm phiên bản thành công', variant }, 201)
})

export const editVariant = asyncHandler(async (req: Request, res: Response) => {
  const variant = await updateVariant(req.params.id as string, req.params.variantId as string, req.body)
  sendSuccess(res, { message: 'Cập nhật phiên bản thành công', variant })
})

export const removeVariant = asyncHandler(async (req: Request, res: Response) => {
  await deleteVariant(req.params.id as string, req.params.variantId as string)
  sendSuccess(res, { message: 'Xóa phiên bản thành công' })
})

// ─── Admin: Stock ─────────────────────────────────────────────────────────────

export const patchStock = asyncHandler(async (req: Request, res: Response) => {
  const variant = await updateVariant(req.params.id as string, req.params.variantId as string, { stock: Number(req.body.stock) })
  sendSuccess(res, { message: 'Cập nhật tồn kho thành công', variant })
})

// ─── Admin: Inventory ─────────────────────────────────────────────────────────

export const inventory = asyncHandler(async (req: Request, res: Response) => {
  const result = await getInventory(req.query)
  sendSuccess(res, result)
})
