import prisma from '../config/db'
import { uploadEntityImage, destroyImage } from '../config/cloudinary'
import { AppError } from '../helpers/app_error'
import { generateUniqueSlug, slugTaken } from '../utils/slug'
import type { CreateCategoryBody, UpdateCategoryBody } from '../types/category.type'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const findBySlug = (slug: string) => prisma.category.findUnique({ where: { slug }, select: { id: true } })

async function findCategoryOrThrow(id: string) {
  const category = await prisma.category.findUnique({ where: { id } })
  if (!category) throw new AppError(404, 'Danh mục không tồn tại')
  return category
}

async function assertParentExists(parentId: string, selfId?: string) {
  if (parentId === selfId) throw new AppError(400, 'Danh mục không thể là cha của chính nó')
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } })
  if (!parent) throw new AppError(400, 'Danh mục cha không tồn tại')
  if (!selfId) return

  // Đi ngược lên gốc: nếu gặp lại chính nó thì phép gán này tạo chu trình, và mọi
  // chỗ duyệt cây từ gốc xuống (flattenTree ở admin, children ở storefront) sẽ mất
  // sạch nhánh đó. `seen` để không treo vòng lặp nếu DB đã lỡ có chu trình sẵn.
  const seen = new Set<string>([parent.id])
  let cursor = parent.parentId
  while (cursor) {
    if (cursor === selfId) throw new AppError(400, 'Không thể chuyển danh mục vào bên trong nhánh con của chính nó')
    if (seen.has(cursor)) break
    seen.add(cursor)
    const next = await prisma.category.findUnique({ where: { id: cursor }, select: { parentId: true } })
    cursor = next?.parentId ?? null
  }
}

// ─── Public ─────────────────────────────────────────────────────────────────

// Danh sách category (mặc định chỉ lấy active cho client; admin truyền includeInactive=true).
// Bản admin kèm _count children/products để UI khoá sẵn nút xoá cho danh mục còn ràng buộc,
// thay vì để người dùng bấm xoá rồi mới nhận 409 từ deleteCategory.
export function getCategories(includeInactive = false) {
  if (includeInactive) {
    return prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { children: true, products: true } } },
    })
  }

  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
  })
  if (!category) throw new AppError(404, 'Danh mục không tồn tại')
  return category
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function createCategory(body: CreateCategoryBody, file?: Express.Multer.File) {
  const { name, slug, description, parentId, sortOrder, isActive } = body

  if (parentId) await assertParentExists(parentId)

  const finalSlug = await generateUniqueSlug(slug || name, slugTaken(findBySlug))

  let image: { url: string; publicId: string } | null = null
  if (file) image = await uploadEntityImage(file.buffer, 'categories')

  return prisma.category.create({
    data: {
      name: name.trim(),
      slug: finalSlug,
      description,
      parentId: parentId || null,
      sortOrder: sortOrder != null ? Number(sortOrder) : 0,
      isActive: isActive != null ? String(isActive) !== 'false' : true,
      imageUrl: image?.url,
      imagePublicId: image?.publicId,
    },
  })
}

export async function updateCategory(id: string, body: UpdateCategoryBody, file?: Express.Multer.File) {
  const category = await findCategoryOrThrow(id)
  const { name, slug, description, parentId, sortOrder, isActive } = body

  // Rỗng/null = đưa về danh mục gốc, không phải một parentId cần kiểm tra tồn tại.
  if (parentId) await assertParentExists(parentId, id)

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name.trim()
  // Slug rỗng = yêu cầu sinh lại từ tên, đúng như placeholder ở form đang hứa.
  // Không có nhánh này thì generateUniqueSlug('') sẽ tạo ra slug rỗng.
  if (slug !== undefined) {
    const base = slug.trim() || name?.trim() || category.name
    data.slug = await generateUniqueSlug(base, slugTaken(findBySlug, id))
  }
  // Chuỗi rỗng nghĩa là admin đã xoá trắng ô mô tả → lưu NULL thay vì ''.
  if (description !== undefined) data.description = description || null
  if (parentId !== undefined) data.parentId = parentId || null
  if (sortOrder !== undefined) data.sortOrder = Number(sortOrder)
  if (isActive !== undefined) data.isActive = String(isActive) !== 'false'

  if (file) {
    const image = await uploadEntityImage(file.buffer, 'categories')
    data.imageUrl = image.url
    data.imagePublicId = image.publicId
    // Xóa ảnh cũ là dọn dẹp nền — không chặn response (destroyImage tự nuốt lỗi)
    if (category.imagePublicId) void destroyImage(category.imagePublicId)
  }

  return prisma.category.update({ where: { id }, data })
}

export async function deleteCategory(id: string) {
  const category = await findCategoryOrThrow(id)

  const [childCount, productCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ])
  if (childCount > 0) throw new AppError(409, 'Không thể xóa: danh mục còn chứa danh mục con')
  if (productCount > 0) throw new AppError(409, 'Không thể xóa: danh mục còn chứa sản phẩm')

  await prisma.category.delete({ where: { id } })
  if (category.imagePublicId) void destroyImage(category.imagePublicId)
}

export async function toggleCategoryStatus(id: string) {
  const category = await findCategoryOrThrow(id)
  return prisma.category.update({
    where: { id },
    data: { isActive: !category.isActive },
  })
}
