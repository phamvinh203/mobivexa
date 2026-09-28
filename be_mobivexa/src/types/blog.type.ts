import { BlogPostStatus, BlogContentType } from '../generated/prisma/client'

export { BlogPostStatus, BlogContentType }

// Derive từ Prisma enum — tự đồng bộ nếu enum thay đổi
export const BLOG_POST_STATUSES = Object.values(BlogPostStatus) as BlogPostStatus[]
export const BLOG_CONTENT_TYPES = Object.values(BlogContentType) as BlogContentType[]

// Nhãn tiếng Việt cố định 14 Content Type (DEC-blog-01, srs/blog-spec.md Mục 4.5)
export const BLOG_CONTENT_TYPE_LABEL: Record<BlogContentType, string> = {
  NEWS: 'Tin công nghệ',
  SMARTPHONE_NEWS: 'Tin smartphone',
  REVIEW: 'Review điện thoại',
  COMPARISON: 'So sánh sản phẩm/điện thoại',
  GUIDE: 'Hướng dẫn sử dụng',
  TIP_ANDROID: 'Thủ thuật Android',
  TIP_IPHONE: 'Thủ thuật iPhone',
  BUYING_ADVICE: 'Tư vấn mua điện thoại',
  TOP_LIST: 'Top điện thoại',
  PROMOTION: 'Khuyến mãi',
  BRAND_NEWS: 'Tin thương hiệu',
  ACCESSORY: 'Phụ kiện',
  KNOWLEDGE: 'Kiến thức công nghệ',
  FAQ: 'FAQ',
}

// ─── Bài viết ─────────────────────────────────────────────────────────────────

export interface BlogFaqInput {
  question: string
  answer: string
}

// Body chung cho POST/PUT bài viết (api-contract.md Mục 3.3/3.4). Mọi field optional
// vì PUT chỉ gửi field muốn đổi; POST chỉ `title` thực sự bắt buộc (FR-blog-001).
export interface CreatePostBody {
  title: string
  slug?: string | null
  excerpt?: string | null
  contentHtml?: string | null
  categoryId?: string | null
  contentType?: BlogContentType | null
  authorDisplayName?: string | null
  readingTimeMinutes?: number | null
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string | null
  canonicalUrl?: string | null
  tagIds?: string[]
  productIds?: string[]
  relatedPostIds?: string[]
  faqs?: BlogFaqInput[]
}

export type UpdatePostBody = Partial<CreatePostBody>

export interface UpdatePostStatusBody {
  status: BlogPostStatus
  scheduledAt?: string
}

export interface AdminPostListQuery {
  page?: string
  limit?: string
  status?: string
  categoryId?: string
  contentType?: string
  authorId?: string
  search?: string
  sort?: string // 'updated' (mặc định) | 'created' | 'published'
}

export interface PublicPostListQuery {
  page?: string
  limit?: string
  category?: string // slug danh mục
  tag?: string // slug tag
}

export interface SearchQuery {
  q?: string
  page?: string
  limit?: string
}

export interface ProductOptionsQuery {
  q?: string
  limit?: string
}

// ─── Danh mục & Tag bài viết ────────────────────────────────────────────────────

export interface CreateBlogCategoryBody {
  name: string
  slug?: string | null
  description?: string | null
  parentId?: string | null
  sortOrder?: number | string
  isActive?: boolean | string
}

export type UpdateBlogCategoryBody = Partial<CreateBlogCategoryBody>

export interface CreateBlogTagBody {
  name: string
  slug?: string | null
}

export type UpdateBlogTagBody = Partial<CreateBlogTagBody>

export interface BlogTagListQuery {
  search?: string
  limit?: string
}
