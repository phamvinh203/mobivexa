import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import { AppError } from '../helpers/app_error'
import { BLOG_CONTENT_TYPES, BLOG_CONTENT_TYPE_LABEL } from '../types/blog.type'
import * as service from '../services/blog.service'
import * as taxonomy from '../services/blog_taxonomy.service'

// ─── Public: /api/blog ─────────────────────────────────────────────────────────

export const listPosts = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPublicPosts(req.query)
  sendSuccess(res, result)
})

export const search = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.searchPosts(req.query)
  sendSuccess(res, result)
})

export const getPostBySlug = asyncHandler(async (req: Request, res: Response) => {
  const post = await service.getPostBySlugPublic(req.params.slug as string)
  sendSuccess(res, { post })
})

export const viewPost = asyncHandler(async (req: Request, res: Response) => {
  await service.incrementPostView(req.params.slug as string)
  res.status(204).end()
})

export const getPreview = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getPostByPreviewToken(req.params.token as string)
  sendSuccess(res, result)
})

export const listPublicCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await taxonomy.getPublicBlogCategories()
  sendSuccess(res, { categories })
})

export const listContentTypes = asyncHandler(async (_req: Request, res: Response) => {
  const contentTypes = BLOG_CONTENT_TYPES.map((value) => ({ value, label: BLOG_CONTENT_TYPE_LABEL[value] }))
  sendSuccess(res, { contentTypes })
})

export const sitemap = asyncHandler(async (_req: Request, res: Response) => {
  const xml = await service.generateSitemapXml()
  res.set('Content-Type', 'application/xml; charset=utf-8')
  res.set('Cache-Control', 'public, max-age=600')
  res.send(xml)
})

export const rss = asyncHandler(async (_req: Request, res: Response) => {
  const xml = await service.generateRssXml()
  res.set('Content-Type', 'application/rss+xml; charset=utf-8')
  res.set('Cache-Control', 'public, max-age=600')
  res.send(xml)
})

// ─── Admin: Posts ───────────────────────────────────────────────────────────────

export const listPostsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPostsAdmin(req.query)
  sendSuccess(res, result)
})

export const getPostByIdAdmin = asyncHandler(async (req: Request, res: Response) => {
  const post = await service.getPostByIdAdmin(req.params.id as string)
  sendSuccess(res, { post })
})

export const createPost = asyncHandler(async (req: Request, res: Response) => {
  const post = await service.createPost(req.body, req.user!.userId)
  sendSuccess(res, { message: 'Tạo bài viết thành công', post }, 201)
})

export const updatePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await service.updatePost(req.params.id as string, req.body, req.user!.userId)
  sendSuccess(res, { message: 'Cập nhật bài viết thành công', post })
})

export const updatePostStatus = asyncHandler(async (req: Request, res: Response) => {
  const post = await service.updatePostStatus(req.params.id as string, req.body, req.user!.userId)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', post })
})

export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  await service.deletePost(req.params.id as string, req.user!.userId)
  sendSuccess(res, { message: 'Xoá bài viết thành công' })
})

export const updatePostCover = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError(400, 'Ảnh đại diện là bắt buộc')
  const post = await service.updatePostCover(req.params.id as string, req.file, req.user!.userId)
  sendSuccess(res, { message: 'Cập nhật ảnh đại diện thành công', post })
})

export const deletePostCover = asyncHandler(async (req: Request, res: Response) => {
  await service.deletePostCover(req.params.id as string, req.user!.userId)
  sendSuccess(res, { message: 'Đã xoá ảnh đại diện' })
})

export const createPreviewToken = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.createPreviewToken(req.params.id as string)
  sendSuccess(res, result)
})

export const uploadContentImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError(400, 'Ảnh là bắt buộc')
  const result = await service.uploadBlogContentImage(req.file)
  sendSuccess(res, result, 201)
})

export const productOptions = asyncHandler(async (req: Request, res: Response) => {
  const products = await service.getBlogProductOptions(req.query)
  sendSuccess(res, { products })
})

// ─── Admin: Categories & Tags ───────────────────────────────────────────────────

export const listCategoriesAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await taxonomy.getAdminBlogCategories()
  sendSuccess(res, { categories })
})

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await taxonomy.createBlogCategory(req.body)
  sendSuccess(res, { message: 'Tạo danh mục thành công', category }, 201)
})

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await taxonomy.updateBlogCategory(req.params.id as string, req.body)
  sendSuccess(res, { message: 'Cập nhật danh mục thành công', category })
})

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await taxonomy.deleteBlogCategory(req.params.id as string)
  sendSuccess(res, { message: 'Xoá danh mục thành công' })
})

export const toggleCategoryStatus = asyncHandler(async (req: Request, res: Response) => {
  const category = await taxonomy.toggleBlogCategoryStatus(req.params.id as string)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', category })
})

export const listTags = asyncHandler(async (req: Request, res: Response) => {
  const tags = await taxonomy.getBlogTags(req.query)
  sendSuccess(res, { tags })
})

export const createTag = asyncHandler(async (req: Request, res: Response) => {
  const tag = await taxonomy.createBlogTag(req.body)
  sendSuccess(res, { message: 'Tạo tag thành công', tag }, 201)
})

export const updateTag = asyncHandler(async (req: Request, res: Response) => {
  const tag = await taxonomy.updateBlogTag(req.params.id as string, req.body)
  sendSuccess(res, { message: 'Cập nhật tag thành công', tag })
})

export const deleteTag = asyncHandler(async (req: Request, res: Response) => {
  await taxonomy.deleteBlogTag(req.params.id as string)
  sendSuccess(res, { message: 'Xoá tag thành công' })
})
