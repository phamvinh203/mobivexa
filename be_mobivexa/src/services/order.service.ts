import prisma from '../config/db'
import { Prisma, OrderStatus, PaymentMethod, PaymentStatus, type Coupon, type OrderItem } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { isPrismaError } from '../helpers/prisma_error'
import { parsePagination, paginationMeta } from '../utils/pagination'
import { dateRange } from '../utils/date_range'
import { parseSearch, firstQueryValue } from '../utils/search'
import { evaluateCoupon, normalizeCode } from '../utils/discount'
import { generateOrderCode } from '../utils/order_code'
import { inBackground } from '../utils/background'
import { sendOrderCancelledEmail, sendOrderCreatedEmail, sendOrderPaidEmail } from './order_email.service'
import type {
  CreateOrderBody,
  OrderItemInput,
  OrderListQuery,
  AdminOrderListQuery,
  UpdateOrderStatusBody,
  UpdatePaymentStatusBody,
} from '../types/order.type'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// items kèm ảnh của phiên bản đã mua — FE (web + admin) dựng ô thumb trong
// lịch sử đơn: ưu tiên variant.imageUrl, rỗng/null thì rơi về ảnh bìa sản phẩm.
// Chỉ select URL chứ không hydrate cả variant (giá, tồn kho...) vì mọi dữ liệu
// còn lại của dòng hàng đã là snapshot trên OrderItem.
// images sắp isCover desc, sortOrder asc để phần tử [0] luôn là ảnh bìa — khớp
// cách getCoverImageUrl bên FE chọn ảnh (find(isCover) ?? images[0]).
const ORDER_INCLUDE = {
  items: {
    include: {
      variant: {
        select: {
          imageUrl: true,
          product: {
            select: {
              images: {
                orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
                select: { url: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderInclude

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

// Whitelist tham số enum từ query string (?status, ?paymentMethod, ?paymentStatus).
//
// Kiểu TS trên OrderListQuery chỉ là nói mồm — runtime client gửi gì cũng nhận:
// ?status=GARBAGE rơi thẳng vào where làm Prisma nổ lỗi enum không ai bắt, thành
// 500. Sai giá trị là lỗi của client → 400 kèm danh sách giá trị hợp lệ để tự sửa;
// rỗng/chuỗi trắng coi như không lọc, giữ hành vi cũ.
function parseEnumParam<T extends string>(raw: unknown, allowed: readonly T[], label: string): T | undefined {
  const value = firstQueryValue(raw)?.trim()
  if (value === undefined || value === '') return undefined
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new AppError(400, `${label} không hợp lệ. Giá trị hợp lệ: ${allowed.join(', ')}`)
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
  const updated = await prisma.$transaction(async (tx) => {
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

  // Mail "đã hủy" — fire-and-forget SAU khi transaction đã commit. Đây là điểm
  // chuyển trạng thái CHUNG nên cả hai đường hủy (khách tự hủy qua cancelMyOrder
  // lẫn admin qua updateOrderStatus) tự phủ ở đây; guard `status` trong WHERE của
  // lệnh update đảm bảo chỉ request hủy THẬT SỰ thành công mới tới được dòng này
  // (request đua sau nhận P2025 → asConflict ném ra trước khi tới hook).
  inBackground(sendOrderCancelledEmail(updated.id), '[Email] Gửi mail hủy đơn lỗi (không ảnh hưởng việc hủy đơn):')

  return updated
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

// ─── Các bước của createOrder ─────────────────────────────────────────────────
//
// createOrder chỉ điều phối; từng bước tách ra hàm riêng để đọc tuần tự theo thứ tự
// chạy: dựng dòng đơn → định giá mã → (trong transaction) ghi đơn, giữ kho, ghi nhận
// mã, dọn giỏ.

// Một dòng của đơn: snapshot giá/tên/SKU tại lúc mua, không đọc lại từ variant về sau.
type OrderLine = {
  variantId: string
  productName: string
  sku: string
  color: string | undefined
  storage: string | undefined
  ram: string | undefined
  unitPrice: number
  quantity: number
  subtotal: number
}

// Biến từng dòng mua thành dòng đơn; ném 400 ở dòng ĐẦU TIÊN không mua được.
async function buildOrderLines(items: OrderItemInput[]): Promise<OrderLine[]> {
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: { product: { select: { name: true, isActive: true } } },
  })
  const variantById = new Map(variants.map((v) => [v.id, v]))

  return items.map(({ variantId, quantity }) => {
    const v = variantById.get(variantId)
    if (!v) throw new AppError(400, `Sản phẩm không tồn tại: ${variantId}`)
    // Ẩn ở cấp product hay cấp variant đều là ngừng bán: product ẩn thì mọi
    // variant của nó không được mua nữa, variant ẩn chỉ chặn riêng nó.
    if (!v.product.isActive || !v.isActive) throw new AppError(400, `Sản phẩm đã ngừng bán: ${v.sku}`)
    // salePrice = 0 là quy ước "chưa có giá bán" (validator admin vẫn chấp nhận):
    // để lọt thì unitPrice = 0 → total = 0 → đơn tự động PAID mà không thu được
    // đồng nào. Chặn ở biên mua hàng, KHÔNG fallback về originalPrice.
    const unitPrice = Number(v.salePrice)
    if (unitPrice <= 0) throw new AppError(400, `Sản phẩm chưa có giá bán: ${v.product.name}`)
    // Stock sẽ được kiểm tra atomic bên trong transaction — không check ở đây để tránh race condition

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
}

// Kiểm tra mã NGOÀI transaction: hỏng ở đây thì chưa ghi gì, và thông điệp lỗi đủ
// cụ thể để khách sửa. Trong transaction chỉ còn phần chống đua (redeemCoupon).
async function priceCoupon(userId: string, couponCode: string | undefined, subtotal: number) {
  if (!couponCode) return { coupon: null, discount: 0 }

  const normalized = normalizeCode(couponCode)

  const [found, usage] = await Promise.all([
    prisma.coupon.findUnique({ where: { code: normalized } }),
    prisma.couponUsage.findFirst({ where: { userId, coupon: { code: normalized } } }),
  ])

  // evaluateCoupon dùng CHUNG với previewCoupon, không chép lại: preview và đặt
  // hàng phải ra cùng một con số cho cùng một giỏ, đúng lý do resolveItems được
  // export.
  const evaluation = evaluateCoupon(found, usage !== null, subtotal)
  if (!evaluation.ok) throw new AppError(400, evaluation.reason)

  return { coupon: found, discount: evaluation.discount }
}

// orderCode có đuôi random 6 ký tự hex — trùng là hiếm nhưng có thật khi ngày đó
// có nhiều đơn. P2002 ở đây là xui, không phải lỗi nghiệp vụ: regenerate và thử
// lại, tối đa 3 lần. Hết lượt vẫn trùng (hay lỗi khác) thì thả gốc bay lên như
// mọi lỗi hệ thống khác.
async function insertOrder(tx: Prisma.TransactionClient, data: Omit<Prisma.OrderUncheckedCreateInput, 'orderCode'>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await tx.order.create({ data: { ...data, orderCode: generateOrderCode() }, include: ORDER_INCLUDE })
    } catch (err) {
      if (!isPrismaError(err, 'P2002') || attempt >= 3) throw err
    }
  }
}

// Atomic check-and-decrement: updateMany với WHERE stock >= quantity
// Nếu count === 0 → stock vừa bị lấy bởi request song song → rollback
async function reserveStock(tx: Prisma.TransactionClient, lines: OrderLine[]) {
  await Promise.all(
    lines.map(async ({ variantId, quantity, sku }) => {
      const result = await tx.productVariant.updateMany({
        where: { id: variantId, stock: { gte: quantity } },
        data:  { stock: { decrement: quantity } },
      })
      if (result.count === 0) throw new AppError(400, `Sản phẩm "${sku}" không đủ hàng`)
    })
  )
}

// Ghi nhận việc dùng mã trong transaction: tăng usedCount + tạo CouponUsage.
async function redeemCoupon(tx: Prisma.TransactionClient, coupon: Coupon, userId: string, orderId: string) {
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
    await tx.couponUsage.create({ data: { couponId: coupon.id, userId, orderId } })
  } catch (err) {
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Bạn đã sử dụng mã này rồi')
    throw err
  }
}

export async function createOrder(userId: string, body: CreateOrderBody) {
  const { addressId, paymentMethod = 'COD', note, items: itemsInput, couponCode } = body

  const [address, resolvedItems] = await Promise.all([
    prisma.address.findFirst({ where: { id: addressId, userId } }),
    resolveItems(userId, itemsInput),
  ])

  if (!address) throw new AppError(404, 'Địa chỉ không tồn tại')

  const lines       = await buildOrderLines(resolvedItems)
  const subtotal    = lines.reduce((sum, l) => sum + l.subtotal, 0)
  const shippingFee = 0
  const { coupon, discount } = await priceCoupon(userId, couponCode, subtotal)

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

  const created = await prisma.$transaction(async (tx) => {
    const order = await insertOrder(tx, {
      ...(settled && { paymentStatus: PaymentStatus.PAID, paidAt: new Date() }),
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
      items: { create: lines },
    })

    await reserveStock(tx, lines)
    if (coupon) await redeemCoupon(tx, coupon, userId, order.id)

    if (!itemsInput || itemsInput.length === 0) {
      // Chỉ xoá đúng những item đã vào đơn: đặt "mua ngay" một món từ giỏ (hoặc
      // giỏ có món hết hàng bị chặn ở bước validate) thì các món còn lại trong
      // giỏ phải nguyên vẹn, không bị cuốn theo mất hết.
      await tx.cartItem.deleteMany({
        where: { cart: { userId }, variantId: { in: lines.map((l) => l.variantId) } },
      })
    }

    return order
  })

  // Mail "đơn mới" — fire-and-forget SAU khi transaction đã commit: hỏng SMTP
  // hay timeout mailer chỉ log lỗi, không bao giờ được rollback đơn đã đặt.
  // Đơn 0đ tự động PAID ngay lúc sinh ra (settled) — mail này hiện sẵn trạng
  // thái "Đã thanh toán" nên KHÔNG phát thêm mail mốc 2, tránh khách nhận hai
  // mail cho một sự kiện.
  inBackground(sendOrderCreatedEmail(created.id), '[Email] Gửi mail đơn mới lỗi (không ảnh hưởng việc đặt hàng):')

  return created
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export async function listMyOrders(userId: string, query: OrderListQuery) {
  const { page, limit } = parsePagination(query)

  const where: Prisma.OrderWhereInput = { userId }
  const status = parseEnumParam(query.status, Object.values(OrderStatus), 'Trạng thái đơn hàng')
  if (status) where.status = status

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
  // Chỉ đọc đúng phần cancelAndRestoreStock cần (CancellableOrder): bản đầy đủ kèm
  // ORDER_INCLUDE do chính lệnh update trong transaction trả về, đọc thêm ở đây là phí.
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, status: true, items: { select: { variantId: true, quantity: true } } },
  })
  if (!order) throw new AppError(404, 'Đơn hàng không tồn tại')

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
  const search = parseSearch(query.search)
  if (search)              where.orderCode     = { contains: search, mode: 'insensitive' }

  const status        = parseEnumParam(query.status,        Object.values(OrderStatus),   'Trạng thái đơn hàng')
  const paymentMethod = parseEnumParam(query.paymentMethod, Object.values(PaymentMethod), 'Phương thức thanh toán')
  const paymentStatus = parseEnumParam(query.paymentStatus, Object.values(PaymentStatus), 'Trạng thái thanh toán')
  if (status)        where.status        = status
  if (query.userId)  where.userId        = query.userId
  if (paymentMethod) where.paymentMethod = paymentMethod
  if (paymentStatus) where.paymentStatus = paymentStatus
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
  // Lean existence check — kèm paymentStatus hiện tại để mail chỉ đi khi trạng
  // thái THẬT SỰ chuyển sang PAID (endpoint này không có guard chống double-pay
  // sẵn như markOrderPaid của luồng SePay).
  const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, paymentStatus: true } })
  if (!existing) throw new AppError(404, 'Đơn hàng không tồn tại')

  // Chuyển THỰC SỰ sang PAID (trước đó chưa PAID). Chỉ lúc này mới ghi paidAt — như
  // webhook SePay và gán tay giao dịch — còn PATCH PAID lặp lại không được đè mốc
  // thanh toán gốc.
  const becamePaid = body.paymentStatus === PaymentStatus.PAID && existing.paymentStatus !== PaymentStatus.PAID
  // Admin lật PAID → UNPAID là sửa nhầm: xoá mốc thanh toán để màn đơn không hiện
  // "Thanh toán lúc X" cạnh badge Chưa thanh toán. REFUNDED thì giữ — tiền đã thu
  // rồi mới hoàn nên paidAt vẫn là sự thật.
  const revertedToUnpaid = body.paymentStatus === PaymentStatus.UNPAID && existing.paymentStatus === PaymentStatus.PAID

  const updated = await prisma.order.update({
    where: { id: orderId },
    data:  {
      paymentStatus: body.paymentStatus,
      ...(becamePaid && { paidAt: new Date() }),
      ...(revertedToUnpaid && { paidAt: null }),
    },
    include: ORDER_INCLUDE,
  })

  // Mail "đã thanh toán" — chỉ khi chuyển thực sự sang PAID; UNPAID/REFUNDED không
  // sinh mail. Hai admin PATCH song song vẫn còn khe hở nhỏ vì đây là đường admin
  // tần suất thấp và không có guard CAS — chấp nhận được, hàm gửi mail tự kiểm lại
  // trạng thái PAID trước khi gửi.
  if (becamePaid) {
    inBackground(sendOrderPaidEmail(orderId), '[Email] Gửi mail đã thanh toán lỗi (không ảnh hưởng cập nhật):')
  }

  return updated
}
