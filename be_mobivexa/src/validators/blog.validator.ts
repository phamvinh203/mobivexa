import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { BLOG_CONTENT_TYPES, BLOG_POST_STATUSES } from '../types/blog.type'

const MAX_TAGS = 20
const MAX_PRODUCTS = 20
const MAX_RELATED_POSTS = 6
const MAX_FAQS = 15

// ─── Field-level checks (dùng lại cho cả create lẫn update) ────────────────────

function checkOptionalString(res: Response, value: unknown, label: string, max: number): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'string') {
    sendError(res, 400, `${label} không hợp lệ`)
    return false
  }
  if (value.length > max) {
    sendError(res, 400, `${label} tối đa ${max} ký tự`)
    return false
  }
  return true
}

function checkContentType(res: Response, value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (!BLOG_CONTENT_TYPES.includes(value as (typeof BLOG_CONTENT_TYPES)[number])) {
    sendError(res, 400, `Loại nội dung không hợp lệ. Các giá trị hợp lệ: ${BLOG_CONTENT_TYPES.join(', ')}`)
    return false
  }
  return true
}

function checkReadingTime(res: Response, value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 600) {
    sendError(res, 400, 'Thời gian đọc phải là số nguyên từ 1 đến 600')
    return false
  }
  return true
}

function checkCanonicalUrl(res: Response, value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (typeof value !== 'string' || value.length > 500) {
    sendError(res, 400, 'Canonical URL phải là URL http(s) hợp lệ')
    return false
  }
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('scheme')
  } catch {
    sendError(res, 400, 'Canonical URL phải là URL http(s) hợp lệ')
    return false
  }
  return true
}

function checkIdArray(res: Response, value: unknown, label: string, max: number): boolean {
  if (value === undefined) return true
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.trim().length === 0)) {
    sendError(res, 400, `${label} không hợp lệ`)
    return false
  }
  if (value.length > max) {
    sendError(res, 400, `Tối đa ${max} ${label.toLowerCase()}`)
    return false
  }
  return true
}

function checkFaqs(res: Response, value: unknown): boolean {
  if (value === undefined) return true
  if (!Array.isArray(value)) {
    sendError(res, 400, 'faqs không hợp lệ')
    return false
  }
  if (value.length > MAX_FAQS) {
    sendError(res, 400, 'Tối đa 15 câu hỏi FAQ cho mỗi bài')
    return false
  }
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      sendError(res, 400, 'faqs không hợp lệ')
      return false
    }
    const { question, answer } = item as Record<string, unknown>
    if (typeof question !== 'string' || question.trim().length < 1 || question.trim().length > 300) {
      sendError(res, 400, 'Câu hỏi FAQ phải từ 1 đến 300 ký tự')
      return false
    }
    if (typeof answer !== 'string' || answer.trim().length < 1 || answer.trim().length > 3000) {
      sendError(res, 400, 'Câu trả lời FAQ phải từ 1 đến 3000 ký tự')
      return false
    }
  }
  return true
}

function checkPostBody(req: Request, res: Response, { requireTitle }: { requireTitle: boolean }): boolean {
  const b = req.body ?? {}

  if (requireTitle) {
    if (typeof b.title !== 'string' || b.title.trim().length < 1 || b.title.trim().length > 200) {
      sendError(res, 400, 'Tiêu đề phải từ 1 đến 200 ký tự')
      return false
    }
  } else if (b.title !== undefined) {
    if (typeof b.title !== 'string' || b.title.trim().length < 1 || b.title.trim().length > 200) {
      sendError(res, 400, 'Tiêu đề phải từ 1 đến 200 ký tự')
      return false
    }
  }

  if (b.slug !== undefined && b.slug !== null && (typeof b.slug !== 'string' || b.slug.length > 200)) {
    sendError(res, 400, 'Slug không hợp lệ')
    return false
  }
  if (!checkOptionalString(res, b.excerpt, 'Tóm tắt', 500)) return false
  if (b.contentHtml !== undefined && b.contentHtml !== null && (typeof b.contentHtml !== 'string' || b.contentHtml.length > 200_000)) {
    sendError(res, 400, 'Nội dung quá dài')
    return false
  }
  if (b.categoryId !== undefined && b.categoryId !== null && typeof b.categoryId !== 'string') {
    sendError(res, 400, 'Danh mục không hợp lệ')
    return false
  }
  if (!checkContentType(res, b.contentType)) return false
  if (!checkOptionalString(res, b.authorDisplayName, 'Tên hiển thị tác giả', 100)) return false
  if (!checkReadingTime(res, b.readingTimeMinutes)) return false
  if (!checkOptionalString(res, b.seoTitle, 'SEO Title', 200)) return false
  if (!checkOptionalString(res, b.seoDescription, 'SEO Description', 320)) return false
  if (!checkOptionalString(res, b.seoKeywords, 'SEO Keywords', 255)) return false
  if (!checkCanonicalUrl(res, b.canonicalUrl)) return false
  if (!checkIdArray(res, b.tagIds, 'Tag', MAX_TAGS)) return false
  if (!checkIdArray(res, b.productIds, 'Sản phẩm liên quan', MAX_PRODUCTS)) return false
  if (!checkIdArray(res, b.relatedPostIds, 'Bài viết liên quan', MAX_RELATED_POSTS)) return false
  if (!checkFaqs(res, b.faqs)) return false

  return true
}

export function validateCreatePost(req: Request, res: Response, next: NextFunction): void {
  if (!checkPostBody(req, res, { requireTitle: true })) return
  next()
}

export function validateUpdatePost(req: Request, res: Response, next: NextFunction): void {
  if (!checkPostBody(req, res, { requireTitle: false })) return
  next()
}

export function validateUpdatePostStatus(req: Request, res: Response, next: NextFunction): void {
  const { status } = req.body ?? {}
  if (typeof status !== 'string' || !BLOG_POST_STATUSES.includes(status as (typeof BLOG_POST_STATUSES)[number])) {
    sendError(res, 400, 'Trạng thái không hợp lệ')
    return
  }
  next()
}

// ─── Category / Tag bài viết ────────────────────────────────────────────────────

// RVW-005: chỉ kiểm `name` là không đủ — `slug`/`description`/`parentId` sai kiểu (số,
// object...) làm service ném TypeError (`.trim is not a function`)/`PrismaClientValidationError`
// và rơi xuống 500 thay vì 400 theo đúng quy ước "Field kiểu sai → 400" (contract Mục 6).

function checkParentId(res: Response, value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'string' || value.trim().length === 0) {
    sendError(res, 400, 'Danh mục cha không hợp lệ')
    return false
  }
  return true
}

function checkSortOrder(res: Response, value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'string' && typeof value !== 'number') {
    sendError(res, 400, 'Thứ tự sắp xếp không hợp lệ')
    return false
  }
  if (!Number.isInteger(Number(value))) {
    sendError(res, 400, 'Thứ tự sắp xếp phải là số nguyên')
    return false
  }
  return true
}

function checkBooleanish(res: Response, value: unknown, label: string): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'boolean') return true
  if (typeof value === 'string' && (value === 'true' || value === 'false')) return true
  sendError(res, 400, `${label} không hợp lệ`)
  return false
}

function checkCategoryCommonFields(req: Request, res: Response): boolean {
  const { slug, description, parentId, sortOrder, isActive } = req.body ?? {}
  if (!checkOptionalString(res, slug, 'Slug', 200)) return false
  if (!checkOptionalString(res, description, 'Mô tả', 500)) return false
  if (!checkParentId(res, parentId)) return false
  if (!checkSortOrder(res, sortOrder)) return false
  if (!checkBooleanish(res, isActive, 'isActive')) return false
  return true
}

export function validateCreateBlogCategory(req: Request, res: Response, next: NextFunction): void {
  const { name } = req.body ?? {}
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    sendError(res, 400, 'Tên danh mục phải từ 2 đến 100 ký tự')
    return
  }
  if (!checkCategoryCommonFields(req, res)) return
  next()
}

export function validateUpdateBlogCategory(req: Request, res: Response, next: NextFunction): void {
  const { name } = req.body ?? {}
  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100)) {
    sendError(res, 400, 'Tên danh mục phải từ 2 đến 100 ký tự')
    return
  }
  if (!checkCategoryCommonFields(req, res)) return
  next()
}

export function validateCreateBlogTag(req: Request, res: Response, next: NextFunction): void {
  const { name, slug } = req.body ?? {}
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
    sendError(res, 400, 'Tên tag phải từ 1 đến 50 ký tự')
    return
  }
  if (!checkOptionalString(res, slug, 'Slug', 200)) return
  next()
}

export function validateUpdateBlogTag(req: Request, res: Response, next: NextFunction): void {
  const { name, slug } = req.body ?? {}
  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50)) {
    sendError(res, 400, 'Tên tag phải từ 1 đến 50 ký tự')
    return
  }
  if (!checkOptionalString(res, slug, 'Slug', 200)) return
  next()
}
