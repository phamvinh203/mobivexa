import prisma from '../config/db'
import { AppError } from '../helpers/app_error'
import type { AddCartItemBody, UpdateCartItemBody } from '../types/cart.type'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fetchCart(cartId: string) {
  return prisma.cart.findUnique({ where: { id: cartId }, include: CART_INCLUDE })
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

export function getCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: CART_INCLUDE,
  })
}

export async function addItem(userId: string, body: AddCartItemBody) {
  const { variantId, quantity } = body

  // Variant check and cart upsert are independent — run in parallel
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

  return fetchCart(cart.id)
}

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
  return fetchCart(cart.id)
}

export async function removeItem(userId: string, itemId: string) {
  const cart = await getCartOrThrow(userId)
  await findOwnedItem(cart.id, itemId)
  await prisma.cartItem.delete({ where: { id: itemId } })
  return fetchCart(cart.id)
}

export async function clearCart(userId: string) {
  await prisma.cartItem.deleteMany({ where: { cart: { userId } } })
}
