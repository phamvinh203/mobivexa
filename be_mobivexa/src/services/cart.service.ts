import prisma from '../config/db'
import { AppError } from '../helpers/app_error'
import type { AddCartItemBody, UpdateCartItemBody } from '../types/cart.type'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Full include — chỉ dùng cho GET /cart (trang giỏ hàng)
const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: { where: { isCover: true }, take: 1, select: { url: true } },
            },
          },
        },
      },
    },
  },
}

// Lean response — trả về sau mutations (add/update/remove)
// Frontend dùng để cập nhật badge, không cần load lại toàn bộ cart
async function fetchCartSummary(cartId: string) {
  const itemCount = await prisma.cartItem.count({ where: { cartId } })
  return { cartId, itemCount }
}

async function getCartOrThrow(userId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId } })
  if (!cart) throw new AppError(404, 'Giỏ hàng không tồn tại')
  return cart
}

async function findOwnedItem(cartId: string, itemId: string) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId } })
  if (!item) throw new AppError(404, 'Không tìm thấy sản phẩm trong giỏ hàng')
  return item
}

// ─── Service functions ────────────────────────────────────────────────────────

// GET /cart — trả full data với 4 cấp join (chỉ gọi khi user vào trang giỏ hàng)
export function getCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: CART_INCLUDE,
  })
}

// POST /cart/items — trả lean summary sau khi thêm
export async function addItem(userId: string, body: AddCartItemBody) {
  const { variantId, quantity } = body

  const [variant, cart] = await Promise.all([
    prisma.productVariant.findUnique({ where: { id: variantId }, select: { id: true, isActive: true, stock: true } }),
    prisma.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } }),
  ])

  if (!variant || !variant.isActive) throw new AppError(404, 'Sản phẩm không tồn tại hoặc đã ngừng bán')
  if (variant.stock < quantity) throw new AppError(400, `Sản phẩm không đủ hàng (còn ${variant.stock})`)

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    select: { id: true, quantity: true },
  })

  if (existing) {
    const newQty = existing.quantity + quantity
    if (newQty > variant.stock) throw new AppError(400, `Số lượng vượt quá tồn kho (còn ${variant.stock})`)
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } })
  } else {
    await prisma.cartItem.create({ data: { cartId: cart.id, variantId, quantity } })
  }

  return fetchCartSummary(cart.id)
}

// PUT /cart/items/:id — trả lean summary sau khi cập nhật
export async function updateItem(userId: string, itemId: string, body: UpdateCartItemBody) {
  const cart = await getCartOrThrow(userId)
  const item = await findOwnedItem(cart.id, itemId)

  const variant = await prisma.productVariant.findUnique({
    where: { id: item.variantId },
    select: { stock: true },
  })
  if (!variant || body.quantity > variant.stock) {
    throw new AppError(400, `Số lượng vượt quá tồn kho${variant ? ` (còn ${variant.stock})` : ''}`)
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: body.quantity } })
  return fetchCartSummary(cart.id)
}

// DELETE /cart/items/:id — trả lean summary sau khi xóa
export async function removeItem(userId: string, itemId: string) {
  const cart = await getCartOrThrow(userId)
  await findOwnedItem(cart.id, itemId)
  await prisma.cartItem.delete({ where: { id: itemId } })
  return fetchCartSummary(cart.id)
}

export async function clearCart(userId: string) {
  await prisma.cartItem.deleteMany({ where: { cart: { userId } } })
}
