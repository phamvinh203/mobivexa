import prisma from '../config/db'
import { Prisma, OrderStatus, PaymentStatus } from '../generated/prisma/client'
import { LOW_STOCK_THRESHOLD } from './product.service'

// ─── Hằng số nghiệp vụ ────────────────────────────────────────────────────────

const REVENUE_DAYS       = 30 // biểu đồ doanh thu: 29 ngày trước → hôm nay
const TOP_PRODUCTS_LIMIT = 5
const LOW_STOCK_LIMIT    = 5
const DAY_MS             = 86_400_000

// VN = UTC+7 và không có DST nên offset cố định — cộng 7h là ra "đồng hồ VN"
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

// Đơn tính vào DOANH THU: đã thanh toán và chưa bị hủy. Đơn PAID rồi hủy nghĩa là
// đã hoàn tiền / hoàn kho — nếu vẫn tính tiền thì doanh thu bị khai khống.
// (Chốt cứng: paymentStatus = PAID và status != CANCELLED)
const REVENUE_ORDER_WHERE: Prisma.OrderWhereInput = {
  paymentStatus: PaymentStatus.PAID,
  status: { not: OrderStatus.CANCELLED },
}

// ─── Helper ───────────────────────────────────────────────────────────────────

// Đầu ngày theo giờ VN, trả về mốc UTC tương ứng.
// Thủ thuật timezone: cộng 7h vào timestamp UTC → được "đồng hồ VN" nhưng vẫn biểu
// diễn dưới dạng UTC; setUTCHours(0,0,0,0) cắt về 00:00 ngày theo giờ VN; trừ lại
// 7h về mốc UTC thật. Nhờ VN không có DST, dịch bucket bằng +24h luôn trôi đúng
// một ngày lịch VN — không cần DATE_TRUNC raw SQL theo timezone của Postgres.
function startOfVnDay(at: Date): Date {
  const vnClock = new Date(at.getTime() + VN_OFFSET_MS)
  vnClock.setUTCHours(0, 0, 0, 0)
  return new Date(vnClock.getTime() - VN_OFFSET_MS)
}

// Khóa ngày 'YYYY-MM-DD' theo giờ VN — định danh bucket trong revenue30d
function vnDateKey(at: Date): string {
  return new Date(at.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

// Đơn có được tính tiền không — dùng khi lọc trong JS sau khi fetch thô
function isRevenueOrder(o: { paymentStatus: PaymentStatus; status: OrderStatus }): boolean {
  return o.paymentStatus === PaymentStatus.PAID && o.status !== OrderStatus.CANCELLED
}

// ─── Types trả về (khớp hợp đồng FE) ──────────────────────────────────────────

type DayBucket = { date: string; revenue: number; orders: number }

export type DashboardStats = {
  today: { orders: number; revenue: number; newUsers: number }
  revenue30d: DayBucket[]
  ordersByStatus: { status: OrderStatus; count: number }[]
  topProducts: { productId: string; name: string; slug: string; sold: number; revenue: number }[]
  lowStock: { variantId: string; productName: string; sku: string; stock: number }[]
}

// ─── Dashboard thống kê admin ─────────────────────────────────────────────────
export async function getDashboardStats(): Promise<DashboardStats> {
  const now        = new Date()
  const todayStart = startOfVnDay(now)
  // Cửa sổ 30 ngày: bucket đầu = đầu ngày VN của "hôm 29 ngày trước", cuối = hôm nay
  const windowStart = startOfVnDay(new Date(now.getTime() - (REVENUE_DAYS - 1) * DAY_MS))

  const [newUsersToday, rangeOrders, statusGroups, topItemGroups, lowStockRows] = await Promise.all([
    // newUsers chỉ tính hôm nay — mốc riêng, không dùng chung cửa sổ 30 ngày
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),

    // Đơn trong 30 ngày: lấy thô 4 cột rồi gom bucket bằng JS. Dataset hiện tại nhỏ
    // nên scan thô rẻ và sạch hơn group-by-ngày bằng raw SQL (không phụ thuộc hàm
    // date riêng của Postgres khi xử lý timezone).
    prisma.order.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true, total: true, paymentStatus: true, status: true },
    }),

    // Group MỌI đơn theo trạng thái (mọi thời gian) — bucket count = 0 do FE-side
    // service tự nối đủ 5 trạng thái để donut vẽ đủ màu
    prisma.order.groupBy({ by: ['status'], _count: true }),

    // Top bán chạy: gom theo biến thể ngay ở DB, chỉ tính đơn đã PAID & không hủy.
    // orderBy _sum quantity + take 5 = top 5 theo số lượng bán.
    prisma.orderItem.groupBy({
      by: ['variantId'],
      where: { order: REVENUE_ORDER_WHERE, variantId: { not: null } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: TOP_PRODUCTS_LIMIT,
    }),

    // Tồn kho thấp: chỉ biến thể thuộc product isActive=true (sản phẩm ẩn thì
    // không có ý nghĩa nhập hàng), sắp stock tăng dần — nguy kịch nhất lên đầu
    prisma.productVariant.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD }, product: { isActive: true } },
      orderBy: { stock: 'asc' },
      take: LOW_STOCK_LIMIT,
      select: { id: true, sku: true, stock: true, product: { select: { name: true } } },
    }),
  ])

  // ── revenue30d: luôn đủ 30 bucket, ngày 0đ/0 đơn vẫn có mặt ──────────────────
  const revenue30d: DayBucket[] = []
  const byDay = new Map<string, DayBucket>()
  for (let i = 0; i < REVENUE_DAYS; i++) {
    const bucket: DayBucket = {
      date: vnDateKey(new Date(windowStart.getTime() + i * DAY_MS)),
      revenue: 0,
      orders: 0,
    }
    revenue30d.push(bucket)
    byDay.set(bucket.date, bucket)
  }
  for (const o of rangeOrders) {
    const bucket = byDay.get(vnDateKey(new Date(o.createdAt)))
    if (!bucket) continue // đơn ngoài cửa sổ (phòng khi where lệch) — bỏ qua
    bucket.orders++ // đếm MỌI đơn kể cả CANCELLED — bộ lọc PAID chỉ áp cho doanh thu
    if (isRevenueOrder(o)) bucket.revenue += Number(o.total)
  }

  // today rút từ bucket cuối (hôm nay) → summary luôn khớp điểm cuối của biểu đồ
  const todayBucket = revenue30d[revenue30d.length - 1]!

  // ── ordersByStatus: đủ 5 trạng thái kể cả count 0 để donut vẽ đủ màu ─────────
  const countByStatus = new Map<OrderStatus, number>(statusGroups.map(g => [g.status, g._count]))
  const ordersByStatus = Object.values(OrderStatus).map(status => ({
    status,
    count: countByStatus.get(status) ?? 0,
  }))

  // ── topProducts: map variantId → product (OrderItem không giữ productId) ─────
  const variantIds = topItemGroups.map(g => g.variantId).filter((id): id is string => id !== null)
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, product: { select: { id: true, name: true, slug: true } } },
      })
    : []
  const productByVariant = new Map(variants.map(v => [v.id, v.product]))

  // revenue = sum(subtotal): OrderItem.subtotal = unitPrice * quantity SNAPSHOT lúc
  // đặt hàng (xem order.service khi dựng items) nên sum(subtotal) ≡ sum(quantity ×
  // giá bán lúc đặt) — đúng hợp đồng mà không cần group thêm theo unitPrice.
  const topProducts = topItemGroups.flatMap(g => {
    const product = g.variantId ? productByVariant.get(g.variantId) : undefined
    if (!product) return [] // biến thể đã bị xóa (SetNull) — không map được về product
    return [
      {
        productId: product.id,
        name:      product.name,
        slug:      product.slug,
        sold:      g._sum.quantity ?? 0,
        revenue:   Number(g._sum.subtotal ?? 0),
      },
    ]
  })

  const lowStock = lowStockRows.map(v => ({
    variantId:    v.id,
    productName:  v.product.name,
    sku:          v.sku,
    stock:        v.stock,
  }))

  return {
    today: {
      orders:   todayBucket.orders,
      revenue:  todayBucket.revenue,
      newUsers: newUsersToday,
    },
    revenue30d,
    ordersByStatus,
    topProducts,
    lowStock,
  }
}
