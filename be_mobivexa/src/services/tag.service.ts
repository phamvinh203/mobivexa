import prisma from '../config/db'
import { AppError } from '../helpers/app_error'
import { generateUniqueSlug, slugTaken } from '../utils/slug'

const findBySlug = (slug: string) => prisma.tag.findUnique({ where: { slug }, select: { id: true } })

// Cache in-memory một entry cho getTags: tag không có trạng thái ẩn/hiện nên
// public và admin dùng chung một danh sách, mà storefront gọi ở mọi trang —
// TTL 60s cắt bớt round-trip Postgres (mô phỏng inventorySummaryCache ở
// product.service). _count productTags đổi khi sản phẩm gắn/gỡ tag: chấp nhận
// trễ tối đa 60s, mutation tag thì set null ngay để thấy kết quả tức thì.
let publicTagsCache: { data: Awaited<ReturnType<typeof findTags>>; expiresAt: number } | null = null
const PUBLIC_TAGS_TTL_MS = 60_000
// Cache tắt hẳn trong test — cùng logic skip của rate limiter: các case trong
// cùng file mock findMany khác nhau, cache sống qua các case sẽ khiến case sau
// đọc kết quả của case trước.
const CACHE_SKIP_IN_TEST = process.env.NODE_ENV === 'test'

function findTags() {
  return prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { productTags: true } } },
  })
}

export async function getTags() {
  const now = Date.now()
  if (!CACHE_SKIP_IN_TEST && publicTagsCache && now < publicTagsCache.expiresAt) {
    return publicTagsCache.data
  }
  const data = await findTags()
  publicTagsCache = { data, expiresAt: now + PUBLIC_TAGS_TTL_MS }
  return data
}

export async function createTag(name: string, slug?: string) {
  const trimmed = name.trim()
  const exists = await prisma.tag.findUnique({ where: { name: trimmed }, select: { id: true } })
  if (exists) throw new AppError(409, 'Tag đã tồn tại')

  const finalSlug = await generateUniqueSlug(slug || trimmed, slugTaken(findBySlug))
  const tag = await prisma.tag.create({ data: { name: trimmed, slug: finalSlug } })
  publicTagsCache = null
  return tag
}

export async function deleteTag(id: string) {
  const tag = await prisma.tag.findUnique({ where: { id }, select: { id: true } })
  if (!tag) throw new AppError(404, 'Tag không tồn tại')
  // productTags có onDelete: Cascade nên gỡ tag khỏi sản phẩm tự động
  await prisma.tag.delete({ where: { id } })
  publicTagsCache = null
}
