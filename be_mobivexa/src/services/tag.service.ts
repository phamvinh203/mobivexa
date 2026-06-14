import prisma from '../config/db'
import { AppError } from '../helpers/app_error'
import { generateUniqueSlug, slugTaken } from '../utils/slug'

const findBySlug = (slug: string) => prisma.tag.findUnique({ where: { slug }, select: { id: true } })

export function getTags() {
  return prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { productTags: true } } },
  })
}

export async function createTag(name: string, slug?: string) {
  const trimmed = name.trim()
  const exists = await prisma.tag.findUnique({ where: { name: trimmed }, select: { id: true } })
  if (exists) throw new AppError(409, 'Tag đã tồn tại')

  const finalSlug = await generateUniqueSlug(slug || trimmed, slugTaken(findBySlug))
  return prisma.tag.create({ data: { name: trimmed, slug: finalSlug } })
}

export async function deleteTag(id: string) {
  const tag = await prisma.tag.findUnique({ where: { id }, select: { id: true } })
  if (!tag) throw new AppError(404, 'Tag không tồn tại')
  // productTags có onDelete: Cascade nên gỡ tag khỏi sản phẩm tự động
  await prisma.tag.delete({ where: { id } })
}
