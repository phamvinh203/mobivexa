import { randomBytes } from 'crypto'
import prisma from '../config/db'
import { Prisma, OrderStatus, PaymentStatus } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { parsePagination, paginationMeta } from '../utils/pagination'
import type {
  CreateOrderBody,
  OrderItemInput,
  OrderListQuery,
  AdminOrderListQuery,
  UpdateOrderStatusBody,
  UpdatePaymentStatusBody,
} from '../types/order.type'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORDER_INCLUDE = {
  items: true,
} satisfies Prisma.OrderInclude

function generateOrderCode(): string {
  const ymd  = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = randomBytes(3).toString('hex').toUpperCase()
  return `ORD-${ymd}-${rand}`
}

async function findOrderOrThrow(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
  if (!order) throw new AppError(404, 'Đơn hàng không tồn tại')
  return order
}

// Ownership check đẩy xuống DB — tránh fetch lãng phí khi không phải chủ đơn
async function findOwnedOrderOrThrow(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: ORDER_INCLUDE })
  if (!order) throw new AppError(404, 'Đơn hàng không tồn tại')
  return order
}

// Luồng chuyển trạng thái hợp lệ — nguồn sự thật duy nhất
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]:   [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPING,  OrderStatus.CANCELLED],
  [OrderStatus.SHIPPING]:  [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
}

// ─── Tạo đơn hàng ─────────────────────────────────────────────────────────────

async function resolveItems(userId: string, itemsInput?: OrderItemInput[]) {
  if (itemsInput && itemsInput.length > 0) return itemsInput

  const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: true } })
  if (!cart || cart.items.length === 0) throw new AppError(400, 'Giỏ hàng trống, không thể đặt hàng')

  return cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }))
}

export async function createOrder(userId: string, body: CreateOrderBody) {
  const { addressId, paymentMethod = 'COD', note, items: itemsInput } = body

  const [address, resolvedItems] = await Promise.all([
    prisma.address.findFirst({ where: { id: addressId, userId } }),
    resolveItems(userId, itemsInput),
  ])

  if (!address) throw new AppError(404, 'Địa chỉ không tồn tại')

  const variantIds = resolvedItems.map((i) => i.variantId)
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: { select: { name: true } } },
  })

  const variantMap = new Map(variants.map((v) => [v.id, v]))
  for (const { variantId, quantity } of resolvedItems) {
    const v = variantMap.get(variantId)
    if (!v)          throw new AppError(400, `Sản phẩm không tồn tại: ${variantId}`)
    if (!v.isActive) throw new AppError(400, `Sản phẩm đã ngừng bán: ${v.sku}`)
    // Stock sẽ được kiểm tra atomic bên trong transaction — không check ở đây để tránh race condition
  }

  const orderItems = resolvedItems.map(({ variantId, quantity }) => {
    const v = variantMap.get(variantId)!
    const unitPrice = Number(v.salePrice)
    return {
      variantId,
      productName: v.product.name,
      sku:         v.sku,
      color:       v.color ?? undefined,
      storage:     v.storage ?? undefined,
      ram:         v.ram ?? undefined,
      unitPrice,
      quantity,
      subtotal:    unitPrice * quantity,
    }
  })

  const subtotal    = orderItems.reduce((sum, i) => sum + i.subtotal, 0)
  const shippingFee = 0
  const discount    = 0
  const total       = subtotal + shippingFee - discount

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderCode:        generateOrderCode(),
        userId,
        shippingName:     address.fullName,
        shippingPhone:    address.phone,
        shippingProvince: address.province,
        shippingDistrict: address.district,
        shippingWard:     address.ward,
        shippingDetail:   address.streetDetail,
        subtotal,
        shippingFee,
        discount,
        total,
        paymentMethod,
        note,
        items: { create: orderItems },
      },
      include: ORDER_INCLUDE,
    })

    // Atomic check-and-decrement: updateMany với WHERE stock >= quantity
    // Nếu count === 0 → stock vừa bị lấy bởi request song song → rollback
    await Promise.all(
      resolvedItems.map(async ({ variantId, quantity }) => {
        const result = await tx.productVariant.updateMany({
          where: { id: variantId, stock: { gte: quantity } },
          data:  { stock: { decrement: quantity } },
        })
        if (result.count === 0) {
          const v = variantMap.get(variantId)
          throw new AppError(400, `Sản phẩm "${v?.sku ?? variantId}" không đủ hàng`)
        }
      })
    )

    if (!itemsInput || itemsInput.length === 0) {
      await tx.cartItem.deleteMany({ where: { cart: { userId } } })
    }

    return order
  })
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export async function listMyOrders(userId: string, query: OrderListQuery) {
  const { page, limit } = parsePagination(query)

  const where: Prisma.OrderWhereInput = { userId }
  if (query.status) where.status = query.status

  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: ORDER_INCLUDE }),
    prisma.order.count({ where }),
  ])

  return { orders, pagination: paginationMeta(page, limit, total) }
}

export function getMyOrder(userId: string, orderId: string) {
  return findOwnedOrderOrThrow(userId, orderId)
}

export async function cancelMyOrder(userId: string, orderId: string, reason?: string) {
  const order = await findOwnedOrderOrThrow(userId, orderId)

  if (!VALID_TRANSITIONS[order.status].includes(OrderStatus.CANCELLED)) {
    throw new AppError(400, 'Không thể hủy đơn hàng ở trạng thái hiện tại')
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data:  { status: OrderStatus.CANCELLED, cancelReason: reason ?? 'Khách hàng hủy đơn' },
      include: ORDER_INCLUDE,
    })

    // Restore stock for each item
    await Promise.all(
      order.items.map((item) =>
        tx.productVariant.update({
          where: { id: item.variantId! },
          data:  { stock: { increment: item.quantity } },
        })
      )
    )

    return updated
  })
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listOrders(query: AdminOrderListQuery) {
  const { page, limit } = parsePagination(query)

  const where: Prisma.OrderWhereInput = {}
  if (query.status)        where.status        = query.status
  if (query.userId)        where.userId        = query.userId
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to   ? { lte: new Date(query.to)   } : {}),
    }
  }

  const adminInclude = { ...ORDER_INCLUDE, user: { select: { id: true, fullName: true, email: true } } }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: adminInclude }),
    prisma.order.count({ where }),
  ])

  return { orders, pagination: paginationMeta(page, limit, total) }
}

export function getOrder(orderId: string) {
  return findOrderOrThrow(orderId)
}

export async function updateOrderStatus(orderId: string, body: UpdateOrderStatusBody) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, items: { select: { variantId: true, quantity: true } } },
  })
  if (!order) throw new AppError(404, 'Đơn hàng không tồn tại')

  if (!VALID_TRANSITIONS[order.status].includes(body.status)) {
    throw new AppError(400, `Không thể chuyển từ "${order.status}" sang "${body.status}"`)
  }

  const data: Prisma.OrderUpdateInput = {
    status:       body.status,
    cancelReason: body.status === OrderStatus.CANCELLED ? (body.cancelReason ?? undefined) : undefined,
  }

  if (body.status !== OrderStatus.CANCELLED) {
    return prisma.order.update({ where: { id: orderId }, data, include: ORDER_INCLUDE })
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({ where: { id: orderId }, data, include: ORDER_INCLUDE })

    // Restore stock when admin cancels
    await Promise.all(
      order.items.map((item) =>
        tx.productVariant.update({
          where: { id: item.variantId! },
          data:  { stock: { increment: item.quantity } },
        })
      )
    )

    return updated
  })
}

export async function updatePaymentStatus(orderId: string, body: UpdatePaymentStatusBody) {
  // Lean existence check — không cần load items
  const exists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })
  if (!exists) throw new AppError(404, 'Đơn hàng không tồn tại')

  return prisma.order.update({
    where: { id: orderId },
    data:  { paymentStatus: body.paymentStatus },
    include: ORDER_INCLUDE,
  })
}
