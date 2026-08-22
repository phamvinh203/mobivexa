import prisma from '../config/db'
import { Prisma, CouponType } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { isPrismaError } from '../helpers/prisma_error'
import { parsePagination, paginationMeta, LIMITS } from '../utils/pagination'
import { computeDiscount, checkCouponUsable, normalizeCode, toRule, toCheckInput } from '../utils/discount'
import { resolveItems } from './order.service'
import type { CreateCouponBody, UpdateCouponBody, AdminCouponListQuery } from '../types/coupon.type'
import type { OrderItemInput } from '../types/order.type'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// normalizeCode nay sống ở utils/discount, cạnh những hàm luật thuần nó phục vụ,
// để order.service dùng được mà không phải import ngược service này. Giữ lối vào
// cũ ở đây cho nơi nào đang import từ coupon.service.
export { normalizeCode }

async function findCouponOrThrow(id: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id } })
  if (!coupon) throw new AppError(404, 'Mã giảm giá không tồn tại')
  return coupon
}

// Dựng data cho create/update từ body. Trả về object chỉ chứa field được gửi lên,
// nên dùng chung được cho cả hai (update không đụng field vắng mặt).
function couponData(body: UpdateCouponBody) {
  const data: Prisma.CouponUncheckedUpdateInput = {}

  // Nullability của schema là luật phân nhóm ở đây, không phải sự tiện tay.
  //
  // Cột NOT NULL dùng `!= null` (lỏng, bắt cả null lẫn undefined): body vá lẻ gửi
  // null lên thì KHÔNG BAO GIỜ được ghi xuống. Dùng `!== undefined` như trước là
  // lọt, mà lọt im lặng: new Date(null) ra 1970-01-01 — một Date HỢP LỆ chứ không
  // phải NaN — nên Prisma nhận và mã hẹn lịch thành dùng được ngay; còn
  // normalizeCode(null) thì nổ TypeError thành 500.
  if (body.code          != null) data.code          = normalizeCode(body.code)
  if (body.type          != null) data.type          = body.type
  if (body.value         != null) data.value         = body.value
  if (body.minOrderValue != null) data.minOrderValue = body.minOrderValue
  if (body.startsAt      != null) data.startsAt      = new Date(body.startsAt)
  if (body.endsAt        != null) data.endsAt        = new Date(body.endsAt)
  if (body.isActive      != null) data.isActive      = body.isActive

  // Cột nullable giữ `!== undefined`: null ở đây là thao tác XOÁ hợp lệ, và là
  // cách duy nhất admin gỡ trần giảm hay bỏ giới hạn lượt dùng.
  if (body.description !== undefined) data.description = body.description
  if (body.maxDiscount !== undefined) data.maxDiscount = body.maxDiscount
  if (body.usageLimit  !== undefined) data.usageLimit  = body.usageLimit

  // FIXED không có trần giảm — validator đã chặn việc GỬI maxDiscount kèm FIXED,
  // nhưng đổi type từ PERCENT sang FIXED mà không gửi maxDiscount thì trần cũ vẫn
  // nằm đó. Xoá luôn cho sạch.
  if (body.type === CouponType.FIXED) data.maxDiscount = null

  return data
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listCoupons(query: AdminCouponListQuery) {
  const { page, limit } = parsePagination(query, LIMITS.DEFAULT, LIMITS.MAX)

  const where: Prisma.CouponWhereInput = {}

  // Code luôn viết hoa trong DB nên chuẩn hoá đầu vào rồi so thẳng, không cần
  // mode: 'insensitive' (vốn kéo theo ILIKE và không dùng được index).
  const search = query.search?.trim()
  if (search) where.code = { contains: normalizeCode(search) }

  if (query.isActive === 'true')  where.isActive = true
  if (query.isActive === 'false') where.isActive = false

  const now = new Date()
  switch (query.status) {
    case 'running':
      where.isActive = true
      where.startsAt = { lte: now }
      where.endsAt   = { gte: now }
      break
    case 'scheduled':
      where.startsAt = { gt: now }
      break
    case 'expired':
      where.endsAt = { lt: now }
      break
  }

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: { _count: { select: { usages: true } } },
    }),
    prisma.coupon.count({ where }),
  ])

  return { coupons, pagination: paginationMeta(page, limit, total) }
}

export async function getCouponById(id: string) {
  const coupon = await prisma.coupon.findUnique({
    where:   { id },
    include: { _count: { select: { usages: true } } },
  })
  if (!coupon) throw new AppError(404, 'Mã giảm giá không tồn tại')
  return coupon
}

export async function createCoupon(body: CreateCouponBody) {
  try {
    return await prisma.coupon.create({
      data: couponData(body) as Prisma.CouponUncheckedCreateInput,
    })
  } catch (err) {
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Mã giảm giá đã tồn tại')
    throw err
  }
}

export async function updateCoupon(id: string, body: UpdateCouponBody) {
  const current = await findCouponOrThrow(id)

  // Cổng thứ hai cho hai luật phụ thuộc `type`. Validator là middleware, không đọc
  // được DB nên chỉ so được với `type` GỬI LÊN — update bỏ trống `type` là lọt cả
  // hai: PUT {value:150} trên mã PERCENT đang lưu, hay PUT {maxDiscount:...} trên
  // mã FIXED đang lưu. Ở đây đã có bản ghi trong tay nên chốt được theo type THỰC.
  const type  = body.type ?? current.type
  const value = Number(body.value ?? current.value)

  if (type === CouponType.PERCENT && value > 100) {
    throw new AppError(400, 'Giảm theo phần trăm không được vượt quá 100')
  }

  // Chỉ chặn khi ĐẶT trần thật. maxDiscount = null là thao tác xoá trần hợp lệ,
  // và couponData cũng tự set null khi đổi sang FIXED — chặn cả hai ca đó thì
  // không ai gỡ được trần cũ nữa.
  if (type === CouponType.FIXED && body.maxDiscount !== undefined && body.maxDiscount !== null) {
    throw new AppError(400, 'Mã giảm số tiền cố định không có trần giảm')
  }

  try {
    return await prisma.coupon.update({ where: { id }, data: couponData(body) })
  } catch (err) {
    if (isPrismaError(err, 'P2002')) throw new AppError(409, 'Mã giảm giá đã tồn tại')
    throw err
  }
}

export async function toggleCouponStatus(id: string) {
  const { isActive } = await findCouponOrThrow(id)
  return prisma.coupon.update({ where: { id }, data: { isActive: !isActive } })
}

export async function deleteCoupon(id: string) {
  // Chặn xoá khi đã có người dùng dù onDelete: Cascade sẽ tự dọn — xoá mã đang
  // chạy làm khách đang giữ mã mất mã giữa chừng, và mất luôn khả năng đối chiếu.
  const used = await prisma.couponUsage.count({ where: { couponId: id } })
  if (used > 0) throw new AppError(409, 'Mã đã có người sử dụng, hãy tắt thay vì xoá')

  try {
    await prisma.coupon.delete({ where: { id } })
  } catch (err) {
    if (isPrismaError(err, 'P2025')) throw new AppError(404, 'Mã giảm giá không tồn tại')
    throw err
  }
}

// ─── Customer ─────────────────────────────────────────────────────────────────

// Trả về CẢ subtotal lẫn cờ "có món không mua được", không phải mỗi con số:
// preview phải từ chối được cả giỏ, mà chỉ nhìn subtotal thì không phân biệt nổi
// "giỏ rẻ" với "giỏ có hàng đã ngừng bán".
type CartValuation = { subtotal: number; unavailable: boolean }

// Tính subtotal từ chính bộ hàng sẽ được đặt. KHÔNG nhận subtotal từ client —
// nhận là mời người ta gửi subtotal: 999999999 để qua ải minOrderValue.
async function subtotalOf(userId: string, items?: OrderItemInput[]): Promise<CartValuation> {
  // Preview là endpoint KIỂM TRA, không phải endpoint ĐẶT HÀNG: giỏ trống là một
  // trạng thái bình thường để đứng đó thử mã, không phải lỗi. resolveItems ném
  // AppError(400, 'Giỏ hàng trống, không thể đặt hàng') vì nó sinh ra cho luồng
  // đặt hàng — thả lỗi đó bay lên là vừa bắn thông báo của luồng đặt hàng vào mặt
  // người chỉ vừa gõ mã, vừa phá hợp đồng "preview luôn trả 200, client đọc cờ
  // `valid`" — chính thứ khiến FE không phải phân nhánh theo bốn mã HTTP.
  //
  // Nuốt thành subtotal 0 rồi để checkCouponUsable phán như mọi ca khác: mã có
  // sàn đơn thì trả lý do "đơn tối thiểu", mã không sàn thì valid với discount 0
  // — mã đúng là hợp lệ, chỉ là chưa có gì để giảm.
  //
  // Chỉ nuốt AppError, và đó là tín hiệu nghiệp vụ DUY NHẤT resolveItems ném ra.
  // Lỗi hạ tầng (Prisma chết) không phải AppError nên vẫn bay lên thành 500, đúng
  // như nó phải thế: trả subtotal 0 im lặng khi DB hỏng thì khách đọc được "chưa
  // đạt đơn tối thiểu" trong khi sự thật là hệ thống đang gãy.
  const resolved: OrderItemInput[] = await resolveItems(userId, items).catch((err) => {
    if (err instanceof AppError) return []
    throw err
  })

  // `in: []` là một lượt truy vấn chắc chắn không trả về gì.
  if (resolved.length === 0) return { subtotal: 0, unavailable: false }

  // Lấy kèm isActive: createOrder ném 400 cho biến thể đã ngừng bán, nên preview
  // phải THẤY được điều đó mới nói không y hệt. Thiếu cột này thì hàng ngừng bán
  // được tính nguyên giá và preview hứa một khoản giảm không đặt hàng nổi.
  const variants = await prisma.productVariant.findMany({
    where:  { id: { in: resolved.map((i) => i.variantId) } },
    select: { id: true, salePrice: true, isActive: true },
  })
  const byId = new Map(variants.map((v) => [v.id, v]))

  let subtotal    = 0
  let unavailable = false

  for (const item of resolved) {
    const variant = byId.get(item.variantId)

    // Đúng hai ca createOrder ném 400: biến thể không còn tồn tại, và biến thể đã
    // ngừng bán. Ghi cờ rồi bỏ qua — KHÔNG cộng nguyên giá (nói dối về giỏ), cũng
    // KHÔNG lặng lẽ tính 0 như `?? 0` cũ (giấu luôn việc có món hỏng).
    if (!variant || !variant.isActive) {
      unavailable = true
      continue
    }

    subtotal += Number(variant.salePrice) * item.quantity
  }

  return { subtotal, unavailable }
}

export async function listActiveCoupons(userId: string) {
  const now = new Date()

  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt:   { gte: now },
    },
    orderBy: { endsAt: 'asc' },
  })

  // Một lượt truy vấn cho toàn bộ mã, không phải mỗi mã một lượt.
  const usages = await prisma.couponUsage.findMany({
    where:  { userId, couponId: { in: coupons.map((c) => c.id) } },
    select: { couponId: true },
  })
  const usedIds = new Set(usages.map((u) => u.couponId))

  // Mã đã dùng VẪN trả về, chỉ gắn cờ — để FE làm mờ kèm lý do, thay vì mã biến
  // mất khỏi danh sách mà khách không hiểu vì sao.
  return {
    coupons: coupons
      .filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit)
      .map((c) => ({ ...c, used: usedIds.has(c.id) })),
  }
}

export async function previewCoupon(userId: string, code: string, items?: OrderItemInput[]) {
  const normalized = normalizeCode(code)

  const [coupon, usage, { subtotal, unavailable }] = await Promise.all([
    prisma.coupon.findUnique({ where: { code: normalized } }),
    prisma.couponUsage.findFirst({ where: { userId, coupon: { code: normalized } } }),
    subtotalOf(userId, items),
  ])

  // Chặn TRƯỚC khi hỏi tới mã. Giỏ có món không mua được thì đơn này không đặt
  // được, mã tốt đến mấy cũng vậy — createOrder ném 400 cho đúng hai ca đó, nên
  // preview phải nói KHÔNG y hệt. Không thế thì: giỏ có A đang bán 1.000.000 và B
  // bị admin tắt sau khi đã vào giỏ 4.000.000 (CartItem chỉ cascade khi biến thể
  // bị XOÁ, nên B nằm lại), preview cộng đủ 5.000.000 rồi báo "giảm 500.000đ" —
  // và POST /api/orders trả 400. Con số vừa hứa với khách chưa bao giờ có thật.
  //
  // TỪ CHỐI chứ không LỌC. Lọc món hỏng ra rồi vẫn báo giảm giá là báo cho một
  // giỏ khách không mua được — vẫn là lời hứa suông, chỉ nói khẽ hơn. Đừng "tối
  // ưu" đoạn này thành filter.
  //
  // Lý do gọi đúng tên vấn đề: khách cần biết CÓ MÓN TRONG GIỎ không mua được,
  // chứ không phải tưởng mã giảm giá của mình hỏng.
  if (unavailable) {
    return {
      valid:    false,
      subtotal,
      discount: 0,
      total:    subtotal,
      reason:   'Giỏ hàng có sản phẩm không còn bán, vui lòng cập nhật giỏ hàng',
    }
  }

  const check = checkCouponUsable(coupon && toCheckInput(coupon), usage !== null, subtotal)

  if (!check.ok) {
    return { valid: false, subtotal, discount: 0, total: subtotal, reason: check.reason }
  }

  const discount = computeDiscount(toRule(coupon!), subtotal)
  return { valid: true, subtotal, discount, total: subtotal - discount }
}
