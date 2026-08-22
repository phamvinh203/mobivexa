import prisma from '../config/db'
import { Prisma } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { isPrismaError } from '../helpers/prisma_error'
import { parsePagination, paginationMeta, LIMITS } from '../utils/pagination'
import type { FavoriteListQuery } from '../types/favorite.type'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Trang yêu thích dùng lại đúng component card của trang listing, nên payload
// phải khớp listProducts (product.service.ts) — cùng bộ variant đang bán sắp
// theo giá và cùng ảnh bìa. Cắt bớt ở đây là card yêu thích thiếu swatch màu
// hoặc badge hết hàng so với card ngoài trang chủ.
const FAVORITE_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  brand:    { select: { id: true, name: true, slug: true } },
  variants: { where: { isActive: true }, orderBy: { salePrice: 'asc' as const } },
  images:   { where: { isCover: true }, take: 1 },
} satisfies Prisma.ProductSelect

// ─── Service functions ────────────────────────────────────────────────────────

export async function listFavorites(userId: string, query: FavoriteListQuery) {
  const { page, limit } = parsePagination(query, LIMITS.PRODUCT)

  // Sản phẩm bị admin ẩn thì rơi khỏi danh sách nhưng bản ghi vẫn nằm trong DB:
  // bật bán lại là khách thấy lại mục đã thích, không phải đi thích lại từ đầu.
  const where: Prisma.FavoriteWhereInput = { userId, product: { isActive: true } }

  const [favorites, total] = await Promise.all([
    prisma.favorite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      select:  { createdAt: true, product: { select: FAVORITE_PRODUCT_SELECT } },
    }),
    prisma.favorite.count({ where }),
  ])

  return { favorites, pagination: paginationMeta(page, limit, total) }
}

// Mảng id phẳng để FE tô trái tim trên mọi card mà không phải hỏi từng sản phẩm.
// Không phân trang: kể cả khách thích vài trăm món thì payload vẫn chỉ vài KB,
// và FE cần TRỌN danh sách mới đối chiếu đúng — trả một trang là tô thiếu.
export async function listFavoriteIds(userId: string) {
  const rows = await prisma.favorite.findMany({ where: { userId }, select: { productId: true } })
  return rows.map((r) => r.productId)
}

export async function addFavorite(userId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where:  { id: productId },
    select: { isActive: true },
  })
  if (!product?.isActive) throw new AppError(404, 'Sản phẩm không tồn tại hoặc đã ngừng bán')

  // P2002 = khoá chính (userId, productId) đã có, tức là đã thích rồi. Đây không
  // phải lỗi: trạng thái client muốn ("đã thích") vẫn đang đúng. Nuốt và báo
  // created=false, thay vì bắt FE xử lý 409 cho một cú double-tap.
  try {
    await prisma.favorite.create({ data: { userId, productId } })
    return { created: true }
  } catch (err) {
    if (isPrismaError(err, 'P2002')) return { created: false }
    throw err
  }
}

// deleteMany chứ không phải delete: bỏ thích món chưa từng thích chỉ trả count 0
// thay vì ném P2025. Idempotent cùng kiểu với addFavorite.
export async function removeFavorite(userId: string, productId: string) {
  await prisma.favorite.deleteMany({ where: { userId, productId } })
}
