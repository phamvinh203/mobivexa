import prisma from '../config/db'
import type { Prisma } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import type { AddCartItemBody, UpdateCartItemBody } from '../types/cart.type'

// Cho phép helper chạy được cả với client thường lẫn client trong 1 transaction
// (tx) — cùng shape với các model delegate đang dùng (cart/cartItem).
type Db = typeof prisma | Prisma.TransactionClient

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
// Đổi tham số từ cartId sang userId: removeItem sau khi gộp lệnh không còn nắm
// cartId — một query lấy cả cartId lẫn số item thay vì hai query riêng.
async function fetchCartSummary(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: { id: true, _count: { select: { items: true } } },
  })
  // Chỉ gọi sau mutation thành công trên item của chính cart này → cart luôn tồn tại
  return { cartId: cart!.id, itemCount: cart!._count.items }
}

// Gộp ownership vào MỘT truy vấn thì "không khớp" gộp luôn hai ca: user chưa có
// giỏ, hoặc item không nằm trong giỏ của user. Đường lỗi là hiếm nên một query
// phân biệt thêm vẫn rẻ — giữ đúng hai thông báo cũ để FE không phải đổi.
async function itemNotFoundError(userId: string, db: Db = prisma): Promise<AppError> {
  const cart = await db.cart.findUnique({ where: { userId }, select: { id: true } })
  return cart
    ? new AppError(404, 'Không tìm thấy sản phẩm trong giỏ hàng')
    : new AppError(404, 'Giỏ hàng không tồn tại')
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
//
// Đọc tồn kho rồi tính quantity mới, ghi lại sau — kiểu check-then-act. Bọc cả
// khối trong 1 transaction để 2 request thêm-giỏ-hàng cùng lúc (cùng user, cùng
// variant — vd double-click) không cùng đọc một giá trị quantity cũ rồi ghi đè
// lên nhau (lost update). Đây KHÔNG phải là chốt chặn tồn kho cuối cùng — chốt
// thật nằm ở lúc tạo đơn (order.service.ts, updateMany với where stock >= qty).
export async function addItem(userId: string, body: AddCartItemBody) {
  const { variantId, quantity } = body

  return prisma.$transaction(async (tx) => {
    const [variant, cart] = await Promise.all([
      tx.productVariant.findUnique({ where: { id: variantId }, select: { id: true, isActive: true, stock: true } }),
      tx.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } }),
    ])

    if (!variant || !variant.isActive) throw new AppError(404, 'Sản phẩm không tồn tại hoặc đã ngừng bán')
    if (variant.stock < quantity) throw new AppError(400, `Sản phẩm không đủ hàng (còn ${variant.stock})`)

    const existing = await tx.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      select: { id: true, quantity: true },
    })

    if (existing) {
      const newQty = existing.quantity + quantity
      if (newQty > variant.stock) throw new AppError(400, `Số lượng vượt quá tồn kho (còn ${variant.stock})`)
      await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } })
    } else {
      await tx.cartItem.create({ data: { cartId: cart.id, variantId, quantity } })
    }

    const itemCount = await tx.cartItem.count({ where: { cartId: cart.id } })
    return { cartId: cart.id, itemCount }
  })
}

// PUT /cart/items/:id — trả lean summary sau khi cập nhật
//
// Cùng kiểu check-then-act như addItem — bọc transaction cho cùng lý do: 2 request
// sửa số lượng cùng lúc trên cùng item không được đọc chung 1 giá trị stock cũ.
export async function updateItem(userId: string, itemId: string, body: UpdateCartItemBody) {
  return prisma.$transaction(async (tx) => {
    // MỘT findFirst cho cả ownership lẫn tồn tại giỏ: WHERE chạm tới cart của
    // user nên item nằm trong giỏ người khác không bao giờ khớp (hai lệnh cũ
    // getCart → findOwnedItem gộp còn một)
    const item = await tx.cartItem.findFirst({ where: { id: itemId, cart: { userId } } })
    if (!item) throw await itemNotFoundError(userId, tx)

    const variant = await tx.productVariant.findUnique({
      where: { id: item.variantId },
      select: { stock: true },
    })
    if (!variant || body.quantity > variant.stock) {
      throw new AppError(400, `Số lượng vượt quá tồn kho${variant ? ` (còn ${variant.stock})` : ''}`)
    }

    await tx.cartItem.update({ where: { id: itemId }, data: { quantity: body.quantity } })
    const itemCount = await tx.cartItem.count({ where: { cartId: item.cartId } })
    return { cartId: item.cartId, itemCount }
  })
}

// DELETE /cart/items/:id — trả lean summary sau khi xóa
export async function removeItem(userId: string, itemId: string) {
  // deleteMany với ownership lồng trong WHERE: gộp ba lệnh cũ (getCart →
  // findOwnedItem → delete) thành một — item nằm giỏ người khác không bao giờ
  // bị đụng tới, và item đã bị xoá rồi cũng chỉ ra count 0 thay vì P2025.
  const { count } = await prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } })
  if (count === 0) throw await itemNotFoundError(userId)
  return fetchCartSummary(userId)
}

export async function clearCart(userId: string) {
  await prisma.cartItem.deleteMany({ where: { cart: { userId } } })
}
