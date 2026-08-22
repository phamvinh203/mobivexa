import { randomBytes } from 'crypto'
import prisma from '../config/db'
import { Prisma, OrderStatus, PaymentStatus, type OrderItem } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { isPrismaError } from '../helpers/prisma_error'
import { parsePagination, paginationMeta } from '../utils/pagination'
import { dateRange } from '../utils/date_range'
import { computeDiscount, checkCouponUsable, normalizeCode, toRule, toCheckInput } from '../utils/discount'
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

// Luồng chuyển trạng thái hợp lệ — nguồn sự thật duy nhất.
// Admin panel soi gương bảng này ở components/Order/orderStatus.ts để chỉ hiện
// bước chuyển hợp lệ — sửa ở đây thì sửa cả bên đó, nếu không menu sẽ mời admin
// bấm một bước rồi ăn 400.
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]:   [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPING,  OrderStatus.CANCELLED],
  [OrderStatus.SHIPPING]:  [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
}

// Trạng thái đơn được đọc ở ngoài transaction, nên giữa lúc đọc và lúc ghi vẫn
// còn khe cho một request khác chen vào. Mọi lệnh ghi trạng thái đều kèm
// `status` trong WHERE để chỉ request ghi trước là khớp; request sau nhận P2025
// — đơn vẫn tồn tại (đã check 404 trước đó), chỉ là trạng thái đã đổi.
function asConflict(err: unknown): never {
  if (isPrismaError(err, 'P2025')) {
    throw new AppError(409, 'Đơn hàng vừa được cập nhật ở nơi khác, vui lòng tải lại')
  }
  throw err
}

// Đơn tối thiểu để huỷ: id để ghi, status làm guard, items để hoàn kho. Nhận cả
// record thay vì ba tham số rời — không thể lỡ ghép id của đơn này với status
// của đơn kia. Structural chứ không phải Order đầy đủ vì updateOrderStatus lấy
// đơn qua `select` hẹp.
type CancellableOrder = {
  id: string
  status: OrderStatus
  items: Pick<OrderItem, 'variantId' | 'quantity'>[]
}

// Huỷ đơn và hoàn kho trong cùng một transaction.
//
// Guard `status` ở đây là chốt chặn hoàn kho HAI LẦN: hai request huỷ song song
// đều thấy đơn còn huỷ được, nhưng chỉ một cái ghi được trạng thái và đi tiếp
// xuống phần increment. Không có guard thì cả hai cùng cộng kho, tồn kho phình
// lên so với thực tế.
async function cancelAndRestoreStock(order: CancellableOrder, cancelReason?: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.order
      .update({
        where:   { id: order.id, status: order.status },
        data:    { status: OrderStatus.CANCELLED, cancelReason },
        include: ORDER_INCLUDE,
      })
      .catch(asConflict)

    // Gộp theo số lượng rồi bắn updateMany, thay vì một update mỗi dòng.
    // Promise.all ở đây sẽ là ảo tưởng: interactive transaction chạy trên đúng
    // một connection nên các lệnh vẫn nối đuôi nhau — gom lại mới thật sự bớt
    // round-trip, và đơn thường toàn quantity=1 nên còn đúng MỘT lệnh.
    const idsByQuantity = new Map<number, string[]>()
    for (const { variantId, quantity } of order.items) {
      // null khi biến thể đã bị xoá (onDelete: SetNull) — không còn kho để hoàn
      if (variantId === null) continue
      idsByQuantity.set(quantity, [...(idsByQuantity.get(quantity) ?? []), variantId])
    }

    for (const [quantity, ids] of idsByQuantity) {
      await tx.productVariant.updateMany({
        where: { id: { in: ids } },
        data:  { stock: { increment: quantity } },
      })
    }

    // Hoàn lượt mã. Không cần guard chống hoàn hai lần: lệnh update ở trên đã có
    // guard `status`, nên chỉ đúng một request đi được tới đây.
    const usage = await tx.couponUsage.findUnique({ where: { orderId: order.id } })
    if (usage) {
      await tx.couponUsage.delete({
        where: { couponId_userId: { couponId: usage.couponId, userId: usage.userId } },
      })
      // gt: 0 là chốt phòng thân để số đếm không bao giờ âm
      await tx.coupon.updateMany({
        where: { id: usage.couponId, usedCount: { gt: 0 } },
        data:  { usedCount: { decrement: 1 } },
      })
    }

    return updated
  })
}

// ─── Tạo đơn hàng ─────────────────────────────────────────────────────────────

// Export để coupon.service dùng lại: preview mã phải tính subtotal từ ĐÚNG bộ
// hàng mà createOrder sẽ tính, nếu không preview và đặt hàng ra hai con số khác nhau.
export async function resolveItems(userId: string, itemsInput?: OrderItemInput[]) {
  if (itemsInput && itemsInput.length > 0) return itemsInput

  const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: true } })
  if (!cart || cart.items.length === 0) throw new AppError(400, 'Giỏ hàng trống, không thể đặt hàng')

  return cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }))
}

export async function createOrder(userId: string, body: CreateOrderBody) {
  const { addressId, paymentMethod = 'COD', note, items: itemsInput, couponCode } = body

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
  for (const { variantId } of resolvedItems) {
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

  // Kiểm tra mã NGOÀI transaction: hỏng ở đây thì chưa ghi gì, và thông điệp lỗi
  // đủ cụ thể để khách sửa. Trong transaction chỉ còn phần chống đua.
  let coupon: Awaited<ReturnType<typeof prisma.coupon.findUnique>> = null
  let discount = 0

  if (couponCode) {
    const normalized = normalizeCode(couponCode)

    const [found, usage] = await Promise.all([
      prisma.coupon.findUnique({ where: { code: normalized } }),
      prisma.couponUsage.findFirst({ where: { userId, coupon: { code: normalized } } }),
    ])

    // toCheckInput/toRule dùng CHUNG với previewCoupon, không chép lại: preview và
    // đặt hàng phải ra cùng một con số cho cùng một giỏ, đúng lý do resolveItems
    // được export.
    const check = checkCouponUsable(found && toCheckInput(found), usage !== null, subtotal)
    if (!check.ok) throw new AppError(400, check.reason)

    coupon = found
    discount = computeDiscount(toRule(found!), subtotal)
  }

  const total = subtotal + shippingFee - discount

  // Đơn 0đ đã thanh toán xong ngay lúc sinh ra: không còn gì để thu, trên COD
  // cũng như trên chuyển khoản. Trước khi có mã giảm giá, discount luôn là 0 nên
  // total = 0 là bất khả; giờ PERCENT value=100 (spec cho phép) và FIXED bị
  // computeDiscount kẹp trần bằng subtotal đều dẫn tới đó.
  //
  // Để nguyên UNPAID là kẹt đơn VĨNH VIỄN, không phải chỉ khó chịu: getOrderPaymentInfo
  // dựng link VietQR với amount=0 — một yêu cầu chuyển khoản không tồn tại — còn
  // resolveAndRecord chỉ khớp khi transferAmount === total, tức đòi một giao dịch
  // 0đ mà ngân hàng không bao giờ sinh ra. Đơn nằm đó tới khi admin lật tay.
  //
  // `status` vẫn để mặc định PENDING: đã trả tiền không có nghĩa là đã duyệt đơn,
  // admin xác nhận như mọi đơn khác.
  const settled = total === 0

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        ...(settled && { paymentStatus: PaymentStatus.PAID, paidAt: new Date() }),
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
        couponCode: coupon?.code ?? null,
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

    if (coupon) {
      // Guard usedCount < usageLimit là chốt chống vượt hạn: usageLimit đọc được
      // ở bước kiểm tra, nên nếu một transaction khác vừa tăng usedCount chạm trần
      // thì WHERE không khớp và count === 0. Đúng khuôn đang dùng cho tồn kho.
      if (coupon.usageLimit !== null) {
        const { count } = await tx.coupon.updateMany({
          where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } },
          data:  { usedCount: { increment: 1 } },
        })
        if (count === 0) throw new AppError(409, 'Mã giảm giá vừa hết lượt sử dụng')
      } else {
        // updateMany chứ không update, cùng lý do như nhánh trên: mã bị admin xoá
        // xen vào giữa lúc kiểm và lúc ghi thì update ném P2025 không ai bắt và
        // hoá thành 500. Nhánh này không có trần để chặn nên count = 0 là chuyện
        // bình thường, không cần đọc.
        await tx.coupon.updateMany({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } })
      }

      // P2002 nghĩa là chính khách này vừa đặt một đơn khác cùng mã ở request song
      // song. Khoá chính (couponId, userId) là thứ chặn, không phải logic ứng dụng.
      try {
        await tx.couponUsage.create({ data: { couponId: coupon.id, userId, orderId: order.id } })
      } catch (err) {
        if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Bạn đã sử dụng mã này rồi')
        throw err
      }
    }

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

  return cancelAndRestoreStock(order, reason ?? 'Khách hàng hủy đơn')
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listOrders(query: AdminOrderListQuery) {
  const { page, limit } = parsePagination(query)

  const where: Prisma.OrderWhereInput = {}

  // Mã đơn dạng ORD-20260817-A1B2C3 — admin thường chỉ nhớ đuôi hoặc ngày, nên
  // khớp một phần (contains) thay vì bằng tuyệt đối. Không dùng full-text như
  // tìm tên sản phẩm vì mã không phải là từ, tokenizer sẽ không tách ra được.
  const search = query.search?.trim()
  if (search)              where.orderCode     = { contains: search, mode: 'insensitive' }

  if (query.status)        where.status        = query.status
  if (query.userId)        where.userId        = query.userId
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus
  const range = dateRange(query.from, query.to)
  if (range)               where.createdAt     = range

  // List chỉ cần SỐ LƯỢNG items (không cần chi tiết) → dùng _count thay vì items:true
  // để tránh hydrate toàn bộ OrderItem[] (productName, sku, giá...) cho mỗi đơn.
  const adminListInclude = {
    _count: { select: { items: true } },
    user: { select: { id: true, fullName: true, email: true } },
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: adminListInclude }),
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

  if (body.status === OrderStatus.CANCELLED) {
    return cancelAndRestoreStock(order, body.cancelReason ?? undefined)
  }

  // Guard status như nhánh huỷ: hai admin bấm hai nút khác nhau cùng lúc thì chỉ
  // bước ghi trước có hiệu lực, bước sau nhận 409 thay vì nhảy cóc trạng thái.
  return prisma.order
    .update({
      where:   { id: orderId, status: order.status },
      data:    { status: body.status },
      include: ORDER_INCLUDE,
    })
    .catch(asConflict)
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
