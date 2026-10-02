import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import prisma from '../config/db'
import { Prisma, BlogPostStatus, BlogContentType } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { isPrismaError } from '../helpers/prisma_error'
import { uploadEntityImage, destroyImage } from '../config/cloudinary'
import { resolveUniqueSlug } from '../utils/slug'
import { sanitizeBlogHtml, htmlToText, computeReadingTime, truncatePlainText, escapeXml } from '../utils/blog_html'
import { parsePagination, paginationMeta, LIMITS } from '../utils/pagination'
import { parseSearch, toTsQuery } from '../utils/search'
import type {
  CreatePostBody,
  UpdatePostBody,
  UpdatePostStatusBody,
  AdminPostListQuery,
  PublicPostListQuery,
  SearchQuery,
  ProductOptionsQuery,
} from '../types/blog.type'

// ═══════════════════════════════════════════════════════════════════════════════
// 0. Cấu hình domain canonical — resolveSiteUrl() KHÔNG BAO GIỜ throw (QA-A-001,
//    NFR-blog-013). Nguồn sự thật DUY NHẤT cho canonical/OG/preview/sitemap/RSS —
//    mọi nơi khác trong service này đọc SITE_URL, KHÔNG tự đọc process.env.FRONTEND_URL.
// ═══════════════════════════════════════════════════════════════════════════════

export function resolveSiteUrl(raw: string | undefined): string | null {
  const candidates = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (let i = 0; i < candidates.length; i++) {
    let origin: string | null = null
    try {
      const url = new URL(candidates[i] as string)
      if (url.protocol === 'http:' || url.protocol === 'https:') origin = url.origin
    } catch {
      origin = null
    }
    if (origin) {
      if (i > 0) {
        console.warn(`[Blog] Phần tử đầu FRONTEND_URL không hợp lệ — dùng ${origin} làm domain canonical, kiểm tra lại cấu hình`)
      }
      return origin
    }
  }

  console.warn('[Blog] FRONTEND_URL trống hoặc không hợp lệ — sitemap/RSS trả 503, canonical/previewUrl trả null')
  return null
}

export const SITE_URL = resolveSiteUrl(process.env.FRONTEND_URL)

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Điều kiện "đang công khai" + lazy publish (ADR-blog-002)
// ═══════════════════════════════════════════════════════════════════════════════

export const PUBLIC_POST_WHERE = { status: BlogPostStatus.PUBLISHED, deletedAt: null } satisfies Prisma.BlogPostWhereInput

// Promote-on-read: chạy ở ĐẦU mọi handler đọc/đổi trạng thái bài viết (public + admin).
// Lỗi ở đây chỉ warn, không chặn lượt đọc — bài sẽ được thăng hạng ở lượt sau.
export async function publishDueScheduledPosts(now: Date = new Date()): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE blog_posts
      SET status = 'PUBLISHED',
          "publishedAt" = COALESCE("publishedAt", "scheduledAt"),
          "scheduledAt" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE status = 'SCHEDULED'
        AND "scheduledAt" <= ${now}
        AND "deletedAt" IS NULL
    `
  } catch (err) {
    console.warn('[Blog] publishDueScheduledPosts lỗi:', err)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BR-blog-007 — trường bắt buộc để công khai (dùng chung publish guard + missingForPublish)
// ═══════════════════════════════════════════════════════════════════════════════

interface PublishCheckFields {
  title: string
  slug: string
  contentHtml: string
  categoryId: string | null
  contentType: string | null
  coverImageUrl: string | null
}

const PUBLISH_FIELD_LABELS: Record<string, string> = {
  title: 'Tiêu đề',
  slug: 'Slug',
  contentHtml: 'Nội dung',
  categoryId: 'Danh mục',
  contentType: 'Loại nội dung',
  coverImage: 'Ảnh đại diện',
}

function computeMissingForPublish(post: PublishCheckFields): string[] {
  const missing: string[] = []
  if (!post.title?.trim()) missing.push('title')
  if (!post.slug?.trim()) missing.push('slug')
  // Nội dung không rỗng = có chữ HOẶC có <img> sau sanitize (data-model.md I-2)
  const hasContent = /<img[\s/]/i.test(post.contentHtml ?? '') || htmlToText(post.contentHtml ?? '').length > 0
  if (!hasContent) missing.push('contentHtml')
  if (!post.categoryId) missing.push('categoryId')
  if (!post.contentType) missing.push('contentType')
  if (!post.coverImageUrl) missing.push('coverImage')
  return missing
}

function missingFieldsMessage(missing: string[]): string {
  return `Chưa đủ điều kiện xuất bản, còn thiếu: ${missing.map((m) => PUBLISH_FIELD_LABELS[m]).join(', ')}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SEO — 1 nguồn tính title/description/canonical/ogImage (BR-blog-017/018)
// ═══════════════════════════════════════════════════════════════════════════════

interface SeoSourceFields {
  title: string
  slug: string
  excerpt: string | null
  contentHtml: string
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords?: string | null
  canonicalUrl: string | null
  coverImageUrl?: string | null
}

function buildSeo(post: SeoSourceFields) {
  const title = post.seoTitle || post.title
  const description = post.seoDescription || post.excerpt || truncatePlainText(htmlToText(post.contentHtml), 160)
  const canonicalUrl = post.canonicalUrl || (SITE_URL ? `${SITE_URL}/tin-tuc/${post.slug}` : null)
  return { title, description, keywords: post.seoKeywords ?? null, canonicalUrl, ogImage: post.coverImageUrl ?? null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Shape trả về — PostCard / PostPublicDetail / AdminPostListItem / AdminPostDetail
// ═══════════════════════════════════════════════════════════════════════════════

const POST_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImageUrl: true,
  contentType: true,
  authorDisplayName: true,
  publishedAt: true,
  readingTimeMinutes: true,
  viewCount: true,
  category: { select: { id: true, name: true, slug: true, isActive: true } },
} satisfies Prisma.BlogPostSelect

interface PostCardRow {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverImageUrl: string | null
  contentType: BlogContentType | null
  authorDisplayName: string
  publishedAt: Date | null
  readingTimeMinutes: number
  viewCount: number
  category: { id: string; name: string; slug: string; isActive: boolean } | null
}

function toPostCard(row: PostCardRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    coverImageUrl: row.coverImageUrl,
    contentType: row.contentType,
    category: row.category,
    authorName: row.authorDisplayName,
    publishedAt: row.publishedAt,
    readingTimeMinutes: row.readingTimeMinutes,
    viewCount: row.viewCount,
  }
}

// Bài liên quan (BR-blog-019): curated trước (chỉ giữ bài còn công khai, đúng thứ tự
// admin chọn), tự bổ sung bài PUBLISHED cùng category cho đủ tối đa 6 nếu còn thiếu.
async function buildRelatedPosts(selfId: string, categoryId: string | null, curatedIds: string[]) {
  const uniqueCurated = [...new Set(curatedIds)]
  let ordered: PostCardRow[] = []

  if (uniqueCurated.length > 0) {
    const rows = await prisma.blogPost.findMany({
      where: { id: { in: uniqueCurated }, ...PUBLIC_POST_WHERE },
      select: POST_CARD_SELECT,
    })
    const byId = new Map(rows.map((r) => [r.id, r]))
    ordered = uniqueCurated.map((id) => byId.get(id)).filter((r): r is PostCardRow => !!r)
  }

  if (ordered.length < 6 && categoryId) {
    const excludeIds = [selfId, ...ordered.map((r) => r.id)]
    const extra = await prisma.blogPost.findMany({
      where: { categoryId, ...PUBLIC_POST_WHERE, id: { notIn: excludeIds } },
      orderBy: { publishedAt: 'desc' },
      take: 6 - ordered.length,
      select: POST_CARD_SELECT,
    })
    ordered = [...ordered, ...extra]
  }

  return ordered.map(toPostCard)
}

interface RelatedProductLink {
  sortOrder: number
  product: {
    id: string
    name: string
    slug: string
    isActive: boolean
    images: { url: string }[]
    variants: { salePrice: Prisma.Decimal; originalPrice: Prisma.Decimal }[]
  }
}

function toRelatedProduct(link: RelatedProductLink) {
  const p = link.product
  const variant = p.variants[0]
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: p.images[0]?.url ?? null,
    salePrice: variant ? variant.salePrice.toString() : null,
    originalPrice: variant ? variant.originalPrice.toString() : null,
  }
}

const POST_DETAIL_INCLUDE = {
  category: { include: { parent: { select: { name: true, slug: true, isActive: true } } } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  faqs: { orderBy: { sortOrder: 'asc' } },
  relatedPosts: { orderBy: { sortOrder: 'asc' }, select: { relatedPostId: true } },
  products: {
    orderBy: { sortOrder: 'asc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          images: { where: { isCover: true }, take: 1, select: { url: true } },
          variants: { where: { isActive: true }, orderBy: { salePrice: 'asc' }, take: 1, select: { salePrice: true, originalPrice: true } },
        },
      },
    },
  },
} satisfies Prisma.BlogPostInclude

type PostWithDetailInclude = Prisma.BlogPostGetPayload<{ include: typeof POST_DETAIL_INCLUDE }>

async function buildPostPublicDetail(post: PostWithDetailInclude) {
  const relatedPosts = await buildRelatedPosts(
    post.id,
    post.categoryId,
    post.relatedPosts.map((r) => r.relatedPostId),
  )
  const relatedProducts = post.products.filter((l) => l.product.isActive).map(toRelatedProduct)

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImageUrl: post.coverImageUrl,
    contentType: post.contentType,
    category: post.category
      ? {
          id: post.category.id,
          name: post.category.name,
          slug: post.category.slug,
          isActive: post.category.isActive,
          parent: post.category.parent
            ? { name: post.category.parent.name, slug: post.category.parent.slug, isActive: post.category.parent.isActive }
            : null,
        }
      : null,
    authorName: post.authorDisplayName,
    publishedAt: post.publishedAt,
    readingTimeMinutes: post.readingTimeMinutes,
    viewCount: post.viewCount,
    contentHtml: post.contentHtml,
    updatedAt: post.updatedAt,
    tags: post.tags.map((t) => t.tag),
    faqs: post.faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
    relatedPosts,
    relatedProducts,
    seo: buildSeo(post),
  }
}

const ADMIN_DETAIL_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, fullName: true } },
  updatedBy: { select: { id: true, fullName: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  products: {
    orderBy: { sortOrder: 'asc' },
    include: {
      product: { select: { id: true, name: true, slug: true, isActive: true, images: { where: { isCover: true }, take: 1, select: { url: true } } } },
    },
  },
  relatedPosts: {
    orderBy: { sortOrder: 'asc' },
    include: { relatedPost: { select: { id: true, title: true, slug: true, status: true, deletedAt: true } } },
  },
  faqs: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.BlogPostInclude

type AdminPostRow = Prisma.BlogPostGetPayload<{ include: typeof ADMIN_DETAIL_INCLUDE }>

function toAdminPostDetail(post: AdminPostRow) {
  const { deletedAt: _deletedAt, tags, products, relatedPosts, faqs, category, author, updatedBy, ...rest } = post

  return {
    ...rest,
    category,
    author,
    updatedBy,
    tags: tags.map((t) => t.tag),
    products: products.map((l) => ({
      id: l.product.id,
      name: l.product.name,
      slug: l.product.slug,
      imageUrl: l.product.images[0]?.url ?? null,
      isActive: l.product.isActive,
      sortOrder: l.sortOrder,
    })),
    relatedPosts: relatedPosts
      .filter((r) => !r.relatedPost.deletedAt)
      .map((r) => ({ id: r.relatedPost.id, title: r.relatedPost.title, slug: r.relatedPost.slug, status: r.relatedPost.status, sortOrder: r.sortOrder })),
    faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, sortOrder: f.sortOrder })),
    missingForPublish: computeMissingForPublish(post),
  }
}

const ADMIN_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  scheduledAt: true,
  publishedAt: true,
  contentType: true,
  coverImageUrl: true,
  authorDisplayName: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  author: { select: { id: true, fullName: true } },
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.BlogPostSelect

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Public — /api/blog
// ═══════════════════════════════════════════════════════════════════════════════

export async function listPublicPosts(query: PublicPostListQuery) {
  await publishDueScheduledPosts()
  const { page, limit } = parsePagination(query, LIMITS.BLOG_PUBLIC, LIMITS.MAX)

  const where: Prisma.BlogPostWhereInput = { ...PUBLIC_POST_WHERE }
  let categoryPayload: unknown
  let tagPayload: unknown

  // RVW-001: Express 5 trả mảng khi query key lặp (?category=a&category=b) — đưa thẳng
  // mảng vào Prisma where sẽ ném PrismaClientValidationError → 500. Chuẩn hoá qua
  // parseSearch (lấy phần tử đầu) trước khi dùng, đúng quy ước contract Mục 0.
  const categorySlug = parseSearch(query.category)
  const tagSlug = parseSearch(query.tag)

  if (categorySlug) {
    const category = await prisma.blogCategory.findFirst({
      where: { slug: categorySlug, isActive: true },
      include: {
        parent: { select: { name: true, slug: true, isActive: true } },
        // RVW-002: contract 2.1 chỉ liệt kê danh mục con ĐANG active — con đã tắt vẫn có
        // trang riêng bị 404 (findFirst ở trên lọc isActive:true), nên không được phép lộ
        // trong menu/breadcrumb ở đây (không ảnh hưởng việc bài của nó vẫn hiện — xem childIds).
        children: { where: { isActive: true }, select: { name: true, slug: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      },
    })
    if (!category) throw new AppError(404, 'Danh mục không tồn tại')

    const childIds = await prisma.blogCategory.findMany({ where: { parentId: category.id }, select: { id: true } })
    where.categoryId = { in: [category.id, ...childIds.map((c) => c.id)] }
    categoryPayload = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parent: category.parent,
      children: category.children,
    }
  }

  if (tagSlug) {
    const tag = await prisma.blogTag.findUnique({ where: { slug: tagSlug } })
    if (!tag) throw new AppError(404, 'Tag không tồn tại')
    where.tags = { some: { tagId: tag.id } }
    tagPayload = { id: tag.id, name: tag.name, slug: tag.slug }
  }

  const [rows, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: POST_CARD_SELECT,
    }),
    prisma.blogPost.count({ where }),
  ])

  return {
    posts: rows.map(toPostCard),
    pagination: paginationMeta(page, limit, total),
    ...(categoryPayload ? { category: categoryPayload } : {}),
    ...(tagPayload ? { tag: tagPayload } : {}),
  }
}

// Full-text 'simple' trên title (A) + excerpt (B), HOẶC khớp tên tag — cắt trang ở
// ứng dụng rồi hydrate bằng findMany, cùng cách product search đang làm.
export async function searchPosts(query: SearchQuery) {
  await publishDueScheduledPosts()

  const q = parseSearch(query.q)
  if (!q) throw new AppError(400, 'Vui lòng nhập từ khoá tìm kiếm')
  if (q.length > 100) throw new AppError(400, 'Từ khoá tối đa 100 ký tự')

  const { page, limit } = parsePagination(query, LIMITS.BLOG_PUBLIC, LIMITS.MAX)
  const tsQuery = toTsQuery(q)
  if (!tsQuery) return { posts: [], pagination: paginationMeta(page, limit, 0), q }

  const rows = await prisma.$queryRaw<{ id: string | null; total: number }[]>`
    WITH q AS (SELECT to_tsquery('simple', ${tsQuery}) AS query),
    tag_hit AS (
      SELECT DISTINCT pt."postId" AS id FROM blog_post_tags pt
      JOIN blog_tags t ON t.id = pt."tagId", q
      WHERE to_tsvector('simple', t.name) @@ q.query
    ),
    matches AS (
      SELECT p.id, p."publishedAt",
             ts_rank(setweight(to_tsvector('simple', p.title), 'A') ||
                     setweight(to_tsvector('simple', coalesce(p.excerpt, '')), 'B'), q.query)
             + CASE WHEN p.id IN (SELECT id FROM tag_hit) THEN 0.2 ELSE 0 END AS score
      FROM blog_posts p, q
      WHERE p.status = 'PUBLISHED' AND p."deletedAt" IS NULL
        AND ((setweight(to_tsvector('simple', p.title), 'A') ||
              setweight(to_tsvector('simple', coalesce(p.excerpt, '')), 'B')) @@ q.query
             OR p.id IN (SELECT id FROM tag_hit))
    ),
    page AS (
      SELECT id, "publishedAt", score
      FROM matches
      ORDER BY score DESC, "publishedAt" DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    ),
    total AS (
      SELECT COUNT(*)::int AS total FROM matches
    )
    SELECT page.id, total.total
    FROM total LEFT JOIN page ON TRUE
    ORDER BY page.score DESC, page."publishedAt" DESC
  `
  const total = Number(rows[0]?.total ?? 0)
  const pageIds = rows.flatMap((r) => (r.id ? [r.id] : []))
  if (pageIds.length === 0) return { posts: [], pagination: paginationMeta(page, limit, total), q }

  // RVW-011: bài bị gỡ/xoá đúng giữa lúc raw SQL chạy và lúc hydrate vẫn phải bị loại —
  // dùng chung PUBLIC_POST_WHERE, không để lọt điều kiện công khai thứ hai.
  const found = await prisma.blogPost.findMany({ where: { id: { in: pageIds }, ...PUBLIC_POST_WHERE }, select: POST_CARD_SELECT })
  const byId = new Map(found.map((f) => [f.id, f]))
  const posts = pageIds.map((id) => byId.get(id)).filter((p): p is PostCardRow => !!p).map(toPostCard)

  return { posts, pagination: paginationMeta(page, limit, total), q }
}

export async function getPostBySlugPublic(slug: string) {
  await publishDueScheduledPosts()
  const post = await prisma.blogPost.findFirst({ where: { slug, ...PUBLIC_POST_WHERE }, include: POST_DETAIL_INCLUDE })
  if (!post) throw new AppError(404, 'Không tìm thấy bài viết')
  return buildPostPublicDetail(post)
}

// Tăng viewCount bằng SQL nguyên tử — KHÔNG qua prisma.update() vì @updatedAt sẽ đổi
// theo mỗi lượt xem, làm lastmod sitemap nhảy vô nghĩa (data-model.md 7.4).
export async function incrementPostView(slug: string): Promise<void> {
  await publishDueScheduledPosts()
  const count = await prisma.$executeRaw`
    UPDATE blog_posts SET "viewCount" = "viewCount" + 1
    WHERE slug = ${slug} AND status = 'PUBLISHED' AND "deletedAt" IS NULL`
  if (count === 0) throw new AppError(404, 'Không tìm thấy bài viết')
}

export async function getBlogProductOptions(query: ProductOptionsQuery) {
  const q = parseSearch(query.q)
  if (!q) throw new AppError(400, 'Vui lòng nhập từ khoá tìm kiếm')
  if (q.length > 100) throw new AppError(400, 'Từ khoá tối đa 100 ký tự')
  const { limit } = parsePagination(query, 10, 20)

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [{ name: { contains: q, mode: 'insensitive' } }, { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } }],
    },
    take: limit,
    select: { id: true, name: true, slug: true, isActive: true, images: { where: { isCover: true }, take: 1, select: { url: true } } },
  })

  return products.map((p) => ({ id: p.id, name: p.name, slug: p.slug, imageUrl: p.images[0]?.url ?? null, isActive: p.isActive }))
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Preview (ADR-blog-006) — JWT ký bằng khoá dẫn xuất từ JWT_ACCESS_SECRET
// ═══════════════════════════════════════════════════════════════════════════════

function previewSecret(): Buffer {
  const base = process.env.JWT_ACCESS_SECRET
  if (!base) throw new Error('JWT_ACCESS_SECRET chưa được cấu hình')
  return crypto.createHmac('sha256', base).update('blog-preview').digest()
}

export async function createPreviewToken(id: string) {
  const post = await prisma.blogPost.findFirst({ where: { id, deletedAt: null }, select: { id: true } })
  if (!post) throw new AppError(404, 'Bài viết không tồn tại')

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  const token = jwt.sign({ sub: post.id, typ: 'blog-preview' }, previewSecret(), { algorithm: 'HS256', expiresIn: '1h' })

  return {
    token,
    previewUrl: SITE_URL ? `${SITE_URL}/tin-tuc/xem-truoc/${token}` : null,
    expiresAt: expiresAt.toISOString(),
  }
}

export async function getPostByPreviewToken(token: string) {
  let payload: { sub: string; typ: string; exp: number }
  try {
    payload = jwt.verify(token, previewSecret(), { algorithms: ['HS256'] }) as typeof payload
  } catch {
    throw new AppError(404, 'Liên kết xem trước không hợp lệ hoặc đã hết hạn')
  }
  if (payload.typ !== 'blog-preview' || !payload.sub) {
    throw new AppError(404, 'Liên kết xem trước không hợp lệ hoặc đã hết hạn')
  }

  await publishDueScheduledPosts()

  const post = await prisma.blogPost.findFirst({ where: { id: payload.sub, deletedAt: null }, include: POST_DETAIL_INCLUDE })
  if (!post) throw new AppError(404, 'Không tìm thấy bài viết')

  const detail = await buildPostPublicDetail(post)
  return {
    post: detail,
    preview: { status: post.status, scheduledAt: post.scheduledAt, expiresAt: new Date(payload.exp * 1000).toISOString() },
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Sitemap & RSS (ADR-blog-004)
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateSitemapXml(): Promise<string> {
  await publishDueScheduledPosts()
  if (!SITE_URL) throw new AppError(503, 'Chưa cấu hình FRONTEND_URL nên chưa tạo được sitemap/RSS')

  const [posts, categories] = await Promise.all([
    prisma.blogPost.findMany({ where: PUBLIC_POST_WHERE, select: { slug: true, updatedAt: true, canonicalUrl: true } }),
    prisma.blogCategory.findMany({ where: { isActive: true }, select: { slug: true } }),
  ])

  // BR-blog-029: loại bài cross-post có canonical trỏ site khác — không tự quảng bá
  // URL không phải của mình trong sitemap của hệ thống.
  const includedPosts = posts.filter((p) => {
    if (!p.canonicalUrl) return true
    try {
      return new URL(p.canonicalUrl).origin === SITE_URL
    } catch {
      return true
    }
  })

  const urls: string[] = []
  const homeLastmod = includedPosts.reduce<Date | null>((max, p) => (!max || p.updatedAt > max ? p.updatedAt : max), null)
  urls.push(`<url><loc>${escapeXml(`${SITE_URL}/tin-tuc`)}</loc>${homeLastmod ? `<lastmod>${homeLastmod.toISOString()}</lastmod>` : ''}</url>`)
  for (const c of categories) {
    urls.push(`<url><loc>${escapeXml(`${SITE_URL}/tin-tuc/danh-muc/${c.slug}`)}</loc></url>`)
  }
  for (const p of includedPosts) {
    urls.push(`<url><loc>${escapeXml(`${SITE_URL}/tin-tuc/${p.slug}`)}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
}

export async function generateRssXml(): Promise<string> {
  await publishDueScheduledPosts()
  if (!SITE_URL) throw new AppError(503, 'Chưa cấu hình FRONTEND_URL nên chưa tạo được sitemap/RSS')

  const posts = await prisma.blogPost.findMany({
    where: PUBLIC_POST_WHERE,
    orderBy: { publishedAt: 'desc' },
    take: 20,
    select: {
      id: true, title: true, slug: true, excerpt: true, contentHtml: true,
      seoTitle: true, seoDescription: true, canonicalUrl: true, publishedAt: true, updatedAt: true,
      category: { select: { name: true } },
    },
  })

  // publishedAt có thể null với bài status=PUBLISHED dữ liệu legacy (dù luồng đăng
  // bài thường luôn set) — fallback về updatedAt thay vì cast ép kiểu gây TypeError.
  const items = posts.map((p) => {
    const seo = buildSeo(p)
    const link = seo.canonicalUrl ?? `${SITE_URL}/tin-tuc/${p.slug}`
    return [
      '    <item>',
      `      <title>${escapeXml(seo.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="false">${escapeXml(p.id)}</guid>`,
      `      <pubDate>${(p.publishedAt ?? p.updatedAt).toUTCString()}</pubDate>`,
      `      <description>${escapeXml(seo.description)}</description>`,
      `      <category>${escapeXml(p.category?.name ?? '')}</category>`,
      '    </item>',
    ].join('\n')
  })

  const lastBuildDate = (posts[0]?.publishedAt ?? posts[0]?.updatedAt ?? new Date()).toUTCString()

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>Tin tức Mobivexa</title>',
    `    <link>${escapeXml(`${SITE_URL}/tin-tuc`)}</link>`,
    '    <description>Tin công nghệ, đánh giá, thủ thuật và tư vấn chọn mua điện thoại từ Mobivexa</description>',
    '    <language>vi</language>',
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    items.join('\n'),
    '  </channel>',
    '</rss>',
  ].join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Admin — CRUD bài viết
// ═══════════════════════════════════════════════════════════════════════════════

const findPostBySlug = (slug: string) => prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })

async function resolveUserFullName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } })
  return user?.fullName ?? 'Đội ngũ Mobivexa'
}

async function assertCategoryExists(id: string) {
  const found = await prisma.blogCategory.findUnique({ where: { id }, select: { id: true } })
  if (!found) throw new AppError(400, 'Danh mục không tồn tại')
}

async function assertTagsExist(ids: string[]) {
  if (ids.length === 0) return
  const count = await prisma.blogTag.count({ where: { id: { in: ids } } })
  if (count !== ids.length) throw new AppError(400, 'Tag không tồn tại')
}

async function assertProductsExist(ids: string[]) {
  if (ids.length === 0) return
  const count = await prisma.product.count({ where: { id: { in: ids } } })
  if (count !== ids.length) throw new AppError(400, 'Sản phẩm liên quan không tồn tại')
}

async function assertRelatedPostsValid(selfId: string | undefined, ids: string[]) {
  if (ids.length === 0) return
  if (selfId && ids.includes(selfId)) throw new AppError(400, 'Bài viết không thể liên quan tới chính nó')
  const count = await prisma.blogPost.count({ where: { id: { in: ids }, deletedAt: null } })
  if (count !== ids.length) throw new AppError(400, 'Bài viết liên quan không tồn tại')
}

function dedupe(ids: string[] | undefined): string[] {
  return ids ? [...new Set(ids)] : []
}

function handleWriteError(err: unknown): never {
  if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Slug đã được sử dụng bởi bài viết khác')
  if (isPrismaError(err, 'P2003')) {
    throw new AppError(409, 'Dữ liệu liên kết (danh mục, tag, sản phẩm hoặc bài liên quan) vừa bị thay đổi, vui lòng tải lại và lưu lại')
  }
  if (isPrismaError(err, 'P2025')) {
    throw new AppError(409, 'Bài viết vừa được thay đổi trạng thái, vui lòng tải lại và lưu lại')
  }
  throw err
}

export async function listPostsAdmin(query: AdminPostListQuery) {
  await publishDueScheduledPosts()
  const { page, limit } = parsePagination(query, LIMITS.BLOG_ADMIN, LIMITS.MAX)

  const where: Prisma.BlogPostWhereInput = { deletedAt: null }

  if (query.status) {
    if (!Object.values(BlogPostStatus).includes(query.status as BlogPostStatus)) throw new AppError(400, 'Trạng thái không hợp lệ')
    where.status = query.status as BlogPostStatus
  }
  // RVW-001: categoryId/authorId cũng phải qua parseSearch — key lặp trả mảng nếu không
  const categoryId = parseSearch(query.categoryId)
  if (categoryId) where.categoryId = categoryId
  if (query.contentType) {
    if (!Object.values(BlogContentType).includes(query.contentType as BlogContentType)) throw new AppError(400, 'Loại nội dung không hợp lệ')
    where.contentType = query.contentType as BlogContentType
  }
  const authorId = parseSearch(query.authorId)
  if (authorId) where.authorId = authorId

  const search = parseSearch(query.search)
  if (search) where.title = { contains: search, mode: 'insensitive' }

  const orderBy: Prisma.BlogPostOrderByWithRelationInput =
    query.sort === 'created' ? { createdAt: 'desc' } : query.sort === 'published' ? { publishedAt: 'desc' } : { updatedAt: 'desc' }

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, select: ADMIN_LIST_SELECT }),
    prisma.blogPost.count({ where }),
  ])

  return { posts, pagination: paginationMeta(page, limit, total) }
}

export async function getPostByIdAdmin(id: string) {
  await publishDueScheduledPosts()
  const post = await prisma.blogPost.findFirst({ where: { id, deletedAt: null }, include: ADMIN_DETAIL_INCLUDE })
  if (!post) throw new AppError(404, 'Bài viết không tồn tại')
  return toAdminPostDetail(post)
}

export async function createPost(body: CreatePostBody, callerId: string) {
  const title = (body.title ?? '').trim()
  if (!title) throw new AppError(400, 'Tiêu đề phải từ 1 đến 200 ký tự')

  const tagIds = dedupe(body.tagIds)
  const productIds = dedupe(body.productIds)
  const relatedPostIds = dedupe(body.relatedPostIds)
  const faqs = body.faqs ?? []

  const checks: Promise<void>[] = [assertTagsExist(tagIds), assertProductsExist(productIds), assertRelatedPostsValid(undefined, relatedPostIds)]
  if (body.categoryId) checks.push(assertCategoryExists(body.categoryId))
  await Promise.all(checks)

  const slug = await resolveUniqueSlug({
    base: title,
    provided: body.slug ?? undefined,
    findBySlug: findPostBySlug,
    conflictMessage: 'Slug đã được sử dụng bởi bài viết khác',
    fallbackBase: 'bai-viet',
  })

  const contentHtml = sanitizeBlogHtml(body.contentHtml ?? '')
  const readingTimeMinutes = body.readingTimeMinutes ?? computeReadingTime(contentHtml)
  const isReadingTimeManual = body.readingTimeMinutes != null
  const authorDisplayName = body.authorDisplayName?.trim() || (await resolveUserFullName(callerId))

  const data: Prisma.BlogPostCreateInput = {
    title,
    slug,
    excerpt: body.excerpt?.trim() || null,
    contentHtml,
    contentType: body.contentType ?? null,
    authorDisplayName,
    readingTimeMinutes,
    isReadingTimeManual,
    seoTitle: body.seoTitle?.trim() || null,
    seoDescription: body.seoDescription?.trim() || null,
    seoKeywords: body.seoKeywords?.trim() || null,
    canonicalUrl: body.canonicalUrl?.trim() || null,
    author: { connect: { id: callerId } },
    updatedBy: { connect: { id: callerId } },
    ...(body.categoryId ? { category: { connect: { id: body.categoryId } } } : {}),
    ...(tagIds.length ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
    ...(productIds.length ? { products: { create: productIds.map((productId, i) => ({ productId, sortOrder: i })) } } : {}),
    ...(relatedPostIds.length ? { relatedPosts: { create: relatedPostIds.map((relatedPostId, i) => ({ relatedPostId, sortOrder: i })) } } : {}),
    ...(faqs.length ? { faqs: { create: faqs.map((f, i) => ({ question: f.question.trim(), answer: f.answer.trim(), sortOrder: i })) } } : {}),
  }

  try {
    const post = await prisma.blogPost.create({ data, include: ADMIN_DETAIL_INCLUDE })
    return toAdminPostDetail(post)
  } catch (err) {
    handleWriteError(err)
  }
}

export async function updatePost(id: string, body: UpdatePostBody, callerId: string) {
  const post = await findAdminPostOrThrow(id)

  let tagIds: string[] | undefined
  let productIds: string[] | undefined
  let relatedPostIds: string[] | undefined
  const checks: Promise<void>[] = []

  if (body.tagIds !== undefined) {
    tagIds = dedupe(body.tagIds)
    checks.push(assertTagsExist(tagIds))
  }
  if (body.productIds !== undefined) {
    productIds = dedupe(body.productIds)
    checks.push(assertProductsExist(productIds))
  }
  if (body.relatedPostIds !== undefined) {
    relatedPostIds = dedupe(body.relatedPostIds)
    checks.push(assertRelatedPostsValid(id, relatedPostIds))
  }
  if (body.categoryId) checks.push(assertCategoryExists(body.categoryId))
  await Promise.all(checks)

  const data: Prisma.BlogPostUpdateInput = { updatedBy: { connect: { id: callerId } } }

  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) throw new AppError(400, 'Tiêu đề phải từ 1 đến 200 ký tự')
    data.title = title
  }

  if (body.slug !== undefined) {
    const provided = body.slug?.trim() || undefined
    const base = provided || body.title?.trim() || post.title
    data.slug = await resolveUniqueSlug({
      base,
      provided,
      excludeId: id,
      findBySlug: findPostBySlug,
      conflictMessage: 'Slug đã được sử dụng bởi bài viết khác',
      fallbackBase: 'bai-viet',
    })
  }

  let nextContentHtml = post.contentHtml
  if (body.contentHtml !== undefined) {
    nextContentHtml = sanitizeBlogHtml(body.contentHtml ?? '')
    data.contentHtml = nextContentHtml
  }

  if (body.readingTimeMinutes !== undefined) {
    if (body.readingTimeMinutes === null) {
      data.readingTimeMinutes = computeReadingTime(nextContentHtml)
      data.isReadingTimeManual = false
    } else {
      data.readingTimeMinutes = body.readingTimeMinutes
      data.isReadingTimeManual = true
    }
  } else if (body.contentHtml !== undefined && !post.isReadingTimeManual) {
    data.readingTimeMinutes = computeReadingTime(nextContentHtml)
  }

  if (body.excerpt !== undefined) data.excerpt = body.excerpt?.trim() || null
  if (body.categoryId !== undefined) data.category = body.categoryId ? { connect: { id: body.categoryId } } : { disconnect: true }
  if (body.contentType !== undefined) data.contentType = body.contentType
  if (body.authorDisplayName !== undefined) data.authorDisplayName = body.authorDisplayName?.trim() || (await resolveUserFullName(callerId))
  if (body.seoTitle !== undefined) data.seoTitle = body.seoTitle?.trim() || null
  if (body.seoDescription !== undefined) data.seoDescription = body.seoDescription?.trim() || null
  if (body.seoKeywords !== undefined) data.seoKeywords = body.seoKeywords?.trim() || null
  if (body.canonicalUrl !== undefined) data.canonicalUrl = body.canonicalUrl?.trim() || null

  // I-2: bài đang công khai/hẹn lịch không được mất trường bắt buộc sau khi áp thay đổi.
  if (post.status === BlogPostStatus.PUBLISHED || post.status === BlogPostStatus.SCHEDULED) {
    const merged: PublishCheckFields = {
      title: (data.title as string | undefined) ?? post.title,
      slug: (data.slug as string | undefined) ?? post.slug,
      contentHtml: nextContentHtml,
      categoryId: body.categoryId !== undefined ? body.categoryId : post.categoryId,
      contentType: body.contentType !== undefined ? (body.contentType as string | null) : post.contentType,
      coverImageUrl: post.coverImageUrl,
    }
    const missing = computeMissingForPublish(merged)
    if (missing.length > 0) throw new AppError(400, missingFieldsMessage(missing))
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (tagIds !== undefined) {
        await tx.blogPostTag.deleteMany({ where: { postId: id } })
        if (tagIds.length) await tx.blogPostTag.createMany({ data: tagIds.map((tagId) => ({ postId: id, tagId })) })
      }
      if (productIds !== undefined) {
        await tx.blogPostProduct.deleteMany({ where: { postId: id } })
        if (productIds.length) await tx.blogPostProduct.createMany({ data: productIds.map((productId, i) => ({ postId: id, productId, sortOrder: i })) })
      }
      if (relatedPostIds !== undefined) {
        await tx.blogRelatedPost.deleteMany({ where: { postId: id } })
        if (relatedPostIds.length) {
          await tx.blogRelatedPost.createMany({ data: relatedPostIds.map((relatedPostId, i) => ({ postId: id, relatedPostId, sortOrder: i })) })
        }
      }
      if (body.faqs !== undefined) {
        await tx.blogPostFaq.deleteMany({ where: { postId: id } })
        if (body.faqs.length) {
          await tx.blogPostFaq.createMany({ data: body.faqs.map((f, i) => ({ postId: id, question: f.question.trim(), answer: f.answer.trim(), sortOrder: i })) })
        }
      }
      return tx.blogPost.update({ where: { id, status: post.status, deletedAt: null }, data, include: ADMIN_DETAIL_INCLUDE })
    })
    return toAdminPostDetail(updated)
  } catch (err) {
    handleWriteError(err)
  }
}

const STATUS_LABEL: Record<BlogPostStatus, string> = {
  DRAFT: 'Nháp',
  SCHEDULED: 'Hẹn lịch',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Lưu trữ',
}

// Bảng chuyển trạng thái duy nhất (api-contract.md 3.5). SCHEDULED tự cho phép
// chuyển sang SCHEDULED (đổi giờ hẹn) — mọi self-transition khác đều 409.
const ALLOWED_STATUS_TRANSITIONS: Record<BlogPostStatus, BlogPostStatus[]> = {
  DRAFT: [BlogPostStatus.SCHEDULED, BlogPostStatus.PUBLISHED],
  SCHEDULED: [BlogPostStatus.DRAFT, BlogPostStatus.SCHEDULED],
  PUBLISHED: [BlogPostStatus.DRAFT, BlogPostStatus.ARCHIVED],
  ARCHIVED: [BlogPostStatus.DRAFT, BlogPostStatus.PUBLISHED],
}

export async function updatePostStatus(id: string, body: UpdatePostStatusBody, updatedById: string) {
  await publishDueScheduledPosts()

  const post = await findAdminPostOrThrow(id)

  const nextStatus = body.status
  if (!Object.values(BlogPostStatus).includes(nextStatus)) throw new AppError(400, 'Trạng thái không hợp lệ')

  if (!ALLOWED_STATUS_TRANSITIONS[post.status].includes(nextStatus)) {
    throw new AppError(409, `Không thể chuyển bài từ ${STATUS_LABEL[post.status]} sang ${STATUS_LABEL[nextStatus]}`)
  }

  const data: Prisma.BlogPostUncheckedUpdateManyInput = { status: nextStatus, updatedById }

  if (nextStatus === BlogPostStatus.SCHEDULED) {
    if (!body.scheduledAt) throw new AppError(400, 'Thời điểm hẹn lịch không hợp lệ')
    const scheduledAt = new Date(body.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) throw new AppError(400, 'Thời điểm hẹn lịch không hợp lệ')
    // Dung sai 60 giây bù lệch đồng hồ (BR-blog-028)
    if (scheduledAt.getTime() < Date.now() - 60_000) throw new AppError(400, 'Thời điểm hẹn lịch phải ở tương lai')
    data.scheduledAt = scheduledAt
  } else {
    data.scheduledAt = null
  }

  if (nextStatus === BlogPostStatus.PUBLISHED || nextStatus === BlogPostStatus.SCHEDULED) {
    const missing = computeMissingForPublish(post)
    if (missing.length > 0) throw new AppError(400, missingFieldsMessage(missing))
  }

  if (nextStatus === BlogPostStatus.PUBLISHED) {
    data.publishedAt = post.publishedAt ?? new Date()
  }

  // Guard status trong WHERE: 2 request đổi trạng thái cùng lúc chỉ 1 cái thắng,
  // cái sau nhận 409 thay vì ghi đè im lặng (data-model.md 7.3).
  const result = await prisma.blogPost.updateMany({ where: { id, status: post.status }, data })
  if (result.count === 0) {
    throw new AppError(409, `Không thể chuyển bài từ ${STATUS_LABEL[post.status]} sang ${STATUS_LABEL[nextStatus]}`)
  }

  return prisma.blogPost.findUnique({ where: { id }, select: { id: true, status: true, scheduledAt: true, publishedAt: true, updatedAt: true } })
}

export async function deletePost(id: string, updatedById: string): Promise<void> {
  const result = await prisma.blogPost.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date(), updatedById } })
  if (result.count === 0) throw new AppError(404, 'Bài viết không tồn tại')
}

async function findAdminPostOrThrow(id: string) {
  const post = await prisma.blogPost.findFirst({ where: { id, deletedAt: null } })
  if (!post) throw new AppError(404, 'Bài viết không tồn tại')
  return post
}

export async function updatePostCover(id: string, file: Express.Multer.File, updatedById: string) {
  const post = await findAdminPostOrThrow(id)
  const uploaded = await uploadEntityImage(file.buffer, 'blog/covers')

  try {
    const updated = await prisma.blogPost.update({
      where: { id },
      data: { coverImageUrl: uploaded.url, coverImagePublicId: uploaded.publicId, updatedById },
      select: { id: true, coverImageUrl: true, updatedAt: true },
    })
    if (post.coverImagePublicId) void destroyImage(post.coverImagePublicId)
    return updated
  } catch (err) {
    void destroyImage(uploaded.publicId)
    throw err
  }
}

export async function deletePostCover(id: string, updatedById: string): Promise<void> {
  const post = await findAdminPostOrThrow(id)
  if (post.status === BlogPostStatus.PUBLISHED || post.status === BlogPostStatus.SCHEDULED) {
    throw new AppError(400, missingFieldsMessage(['coverImage']))
  }

  const result = await prisma.blogPost.updateMany({
    where: { id, deletedAt: null, status: { in: [BlogPostStatus.DRAFT, BlogPostStatus.ARCHIVED] } },
    data: { coverImageUrl: null, coverImagePublicId: null, updatedById },
  })
  if (result.count === 0) throw new AppError(409, 'Bài viết vừa được thay đổi trạng thái, vui lòng tải lại')
  if (post.coverImagePublicId) void destroyImage(post.coverImagePublicId)
}

export async function uploadBlogContentImage(file: Express.Multer.File) {
  const uploaded = await uploadEntityImage(file.buffer, 'blog/content')
  return { url: uploaded.url, publicId: uploaded.publicId }
}
