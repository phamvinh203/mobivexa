import prisma from '../config/db'
import { Prisma } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { isPrismaError } from '../helpers/prisma_error'
import { resolveUniqueSlug } from '../utils/slug'
import { parseSearch } from '../utils/search'
import type {
  CreateBlogCategoryBody,
  UpdateBlogCategoryBody,
  CreateBlogTagBody,
  UpdateBlogTagBody,
  BlogTagListQuery,
} from '../types/blog.type'

// ─── Category: helpers ────────────────────────────────────────────────────────

const findCategoryBySlug = (slug: string) => prisma.blogCategory.findUnique({ where: { slug }, select: { id: true } })

async function findBlogCategoryOrThrow(id: string) {
  const category = await prisma.blogCategory.findUnique({ where: { id } })
  if (!category) throw new AppError(404, 'Danh mục không tồn tại')
  return category
}

async function assertCategoryNameFree(name: string, excludeId?: string) {
  const found = await prisma.blogCategory.findUnique({ where: { name }, select: { id: true } })
  if (found && found.id !== excludeId) throw new AppError(409, 'Tên danh mục đã tồn tại')
}

// Tối đa 2 cấp (BR-blog-004): cha được gán phải là gốc (không có parentId riêng),
// và danh mục đang có con thì không được gán cha (sẽ tạo cấp 3).
async function assertValidParent(tx: Prisma.TransactionClient, parentId: string, selfId?: string) {
  if (parentId === selfId) throw new AppError(400, 'Danh mục không thể là cha của chính nó')

  const parent = await tx.blogCategory.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } })
  if (!parent) throw new AppError(400, 'Danh mục cha không tồn tại')
  if (parent.parentId) throw new AppError(400, 'Danh mục chỉ hỗ trợ tối đa 2 cấp')

  if (selfId) {
    const childCount = await tx.blogCategory.count({ where: { parentId: selfId } })
    if (childCount > 0) throw new AppError(400, 'Danh mục chỉ hỗ trợ tối đa 2 cấp')
  }
}

// ─── Category: public ─────────────────────────────────────────────────────────

// GET /api/blog/categories — chỉ active, phẳng; FE tự dựng cây + tự áp luật ẩn
// nhánh con khi cha inactive (BR-blog-030, hiện thực thuần FE — DEC-blog-29).
export function getPublicBlogCategories() {
  return prisma.blogCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

// ─── Category: admin ──────────────────────────────────────────────────────────

export function getAdminBlogCategories() {
  return prisma.blogCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          children: true,
          // Chỉ đếm bài CHƯA xoá mềm (DEC-blog-27, BR-blog-005)
          posts: { where: { deletedAt: null } },
        },
      },
    },
  })
}

export async function createBlogCategory(body: CreateBlogCategoryBody) {
  const name = (body.name ?? '').trim()
  if (name.length < 2 || name.length > 100) throw new AppError(400, 'Tên danh mục phải từ 2 đến 100 ký tự')
  await assertCategoryNameFree(name)
  const slug = await resolveUniqueSlug({
    base: name,
    provided: body.slug ?? undefined,
    findBySlug: findCategoryBySlug,
    conflictMessage: 'Slug danh mục đã tồn tại',
    fallbackBase: 'danh-muc',
  })

  try {
    return await prisma.$transaction(async (tx) => {
      if (body.parentId) await assertValidParent(tx, body.parentId)
      return tx.blogCategory.create({
        data: {
          name,
          slug,
          description: body.description?.trim() || null,
          parentId: body.parentId || null,
          sortOrder: body.sortOrder != null ? Number(body.sortOrder) : 0,
          isActive: body.isActive != null ? String(body.isActive) !== 'false' : true,
        },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (err) {
    // RVW-004: race giữa assertCategoryNameFree/resolveUniqueSlug (đọc) và create (ghi) —
    // 2 request cùng tên/slug lọt qua kiểm tra trước thì unique constraint chặn ở đây.
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Tên hoặc slug danh mục đã tồn tại')
    // Cha vừa bị xoá đồng thời sau lúc assertValidParent kiểm tra (api-contract 4.1).
    if (isPrismaError(err, 'P2003')) throw new AppError(400, 'Danh mục cha không tồn tại')
    if (isPrismaError(err, 'P2034')) throw new AppError(409, 'Cây danh mục vừa được thay đổi, vui lòng tải lại và thử lại')
    throw err
  }
}

export async function updateBlogCategory(id: string, body: UpdateBlogCategoryBody) {
  const category = await findBlogCategoryOrThrow(id)

  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (name.length < 2 || name.length > 100) throw new AppError(400, 'Tên danh mục phải từ 2 đến 100 ký tự')
    await assertCategoryNameFree(name, id)
    data.name = name
  }

  if (body.parentId !== undefined) {
    data.parentId = body.parentId || null
  }

  if (body.slug !== undefined) {
    data.slug = await resolveUniqueSlug({
      base: (data.name as string) ?? category.name,
      provided: body.slug ?? undefined,
      excludeId: id,
      findBySlug: findCategoryBySlug,
      conflictMessage: 'Slug danh mục đã tồn tại',
      fallbackBase: 'danh-muc',
    })
  }

  if (body.description !== undefined) data.description = body.description?.trim() || null
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder)
  if (body.isActive !== undefined) data.isActive = String(body.isActive) !== 'false'

  try {
    return await prisma.$transaction(async (tx) => {
      if (body.parentId) await assertValidParent(tx, body.parentId, id)
      return tx.blogCategory.update({ where: { id }, data })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (err) {
    // RVW-004: race giữa assertCategoryNameFree/resolveUniqueSlug (đọc) và update (ghi)
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Tên hoặc slug danh mục đã tồn tại')
    // Cha vừa bị xoá đồng thời sau lúc assertValidParent kiểm tra (QA-A-002, api-contract 4.1)
    if (isPrismaError(err, 'P2003')) throw new AppError(400, 'Danh mục cha không tồn tại')
    if (isPrismaError(err, 'P2034')) throw new AppError(409, 'Cây danh mục vừa được thay đổi, vui lòng tải lại và thử lại')
    throw err
  }
}

export async function deleteBlogCategory(id: string) {
  await findBlogCategoryOrThrow(id)

  const [postCount, childCount] = await Promise.all([
    prisma.blogPost.count({ where: { categoryId: id, deletedAt: null } }),
    prisma.blogCategory.count({ where: { parentId: id } }),
  ])
  if (childCount > 0) throw new AppError(409, 'Không thể xoá: danh mục còn danh mục con')
  if (postCount > 0) throw new AppError(409, `Không thể xoá: danh mục đang có ${postCount} bài viết`)

  try {
    await prisma.$transaction([
      // Bài đã xoá mềm không tính vào điều kiện chặn nhưng vẫn tham chiếu categoryId
      // — tự gỡ trước khi xoá để không vi phạm FK RESTRICT (DEC-blog-27).
      prisma.blogPost.updateMany({ where: { categoryId: id, deletedAt: { not: null } }, data: { categoryId: null } }),
      prisma.blogCategory.delete({ where: { id } }),
    ])
  } catch (err) {
    if (isPrismaError(err, 'P2003')) {
      // Race: 1 bài sống vừa được gán vào danh mục này, hoặc 1 danh mục con vừa được
      // tạo/gán cha, ngay sau lúc đếm ở trên (QA-A-002, api-contract 4.1).
      throw new AppError(409, 'Không thể xoá: danh mục vừa được gán cho bài viết hoặc danh mục con, vui lòng tải lại')
    }
    throw err
  }
}

export async function toggleBlogCategoryStatus(id: string) {
  const category = await findBlogCategoryOrThrow(id)
  return prisma.blogCategory.update({ where: { id }, data: { isActive: !category.isActive } })
}

// ─── Tag: admin ───────────────────────────────────────────────────────────────

const findTagBySlug = (slug: string) => prisma.blogTag.findUnique({ where: { slug }, select: { id: true } })

async function assertTagNameFree(name: string, excludeId?: string) {
  const found = await prisma.blogTag.findUnique({ where: { name }, select: { id: true } })
  if (found && found.id !== excludeId) throw new AppError(409, 'Tag đã tồn tại')
}

export function getBlogTags(query: BlogTagListQuery) {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 100))
  // RVW-001: query key lặp (?search=a&search=b) trả mảng ở Express 5 — chuẩn hoá trước
  // khi đưa vào Prisma `contains`, không thì PrismaClientValidationError → 500.
  const search = parseSearch(query.search)

  return prisma.blogTag.findMany({
    where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
    take: limit,
    include: {
      // Chỉ đếm bài CHƯA xoá mềm — nhất quán với category._count.posts
      _count: { select: { posts: { where: { post: { deletedAt: null } } } } },
    },
  })
}

export async function createBlogTag(body: CreateBlogTagBody) {
  const name = (body.name ?? '').trim()
  if (name.length < 1 || name.length > 50) throw new AppError(400, 'Tên tag phải từ 1 đến 50 ký tự')
  await assertTagNameFree(name)

  const slug = await resolveUniqueSlug({
    base: name,
    provided: body.slug ?? undefined,
    findBySlug: findTagBySlug,
    conflictMessage: 'Slug tag đã tồn tại',
    fallbackBase: 'tag',
  })

  try {
    return await prisma.blogTag.create({ data: { name, slug } })
  } catch (err) {
    // RVW-004: race giữa assertTagNameFree/resolveUniqueSlug (đọc) và create (ghi)
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Tên hoặc slug tag đã tồn tại')
    throw err
  }
}

export async function updateBlogTag(id: string, body: UpdateBlogTagBody) {
  const tag = await prisma.blogTag.findUnique({ where: { id } })
  if (!tag) throw new AppError(404, 'Tag không tồn tại')

  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (name.length < 1 || name.length > 50) throw new AppError(400, 'Tên tag phải từ 1 đến 50 ký tự')
    await assertTagNameFree(name, id)
    data.name = name
  }

  if (body.slug !== undefined) {
    data.slug = await resolveUniqueSlug({
      base: (data.name as string) ?? tag.name,
      provided: body.slug ?? undefined,
      excludeId: id,
      findBySlug: findTagBySlug,
      conflictMessage: 'Slug tag đã tồn tại',
      fallbackBase: 'tag',
    })
  }

  try {
    return await prisma.blogTag.update({ where: { id }, data })
  } catch (err) {
    // RVW-004: race giữa assertTagNameFree/resolveUniqueSlug (đọc) và update (ghi)
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Tên hoặc slug tag đã tồn tại')
    throw err
  }
}

export async function deleteBlogTag(id: string) {
  const tag = await prisma.blogTag.findUnique({ where: { id }, select: { id: true } })
  if (!tag) throw new AppError(404, 'Tag không tồn tại')
  // blog_post_tags có onDelete: Cascade nên gỡ liên kết khỏi mọi bài tự động (BR-blog-006)
  await prisma.blogTag.delete({ where: { id } })
}
