import prisma from '../config/db'
import { AppError } from '../helpers/app_error'
import { isPrismaError } from '../helpers/prisma_error'
import { Prisma, PaymentStatus, OrderStatus, PaymentMethod, SePayTxStatus } from '../generated/prisma/client'
import { parsePagination, paginationMeta } from '../utils/pagination'
import { ORDER_CODE_RE } from '../utils/order_code'
import { dateRange } from '../utils/date_range'
import type {
  SePayWebhookPayload,
  SePayApiTransaction,
  NormalizedSePayTx,
  TransactionListQuery,
  MatchTransactionBody,
} from '../types/payment.type'

const BANK_ID      = process.env.SEPAY_BANK_ID        ?? ''
const ACCOUNT_NO   = process.env.SEPAY_ACCOUNT_NUMBER ?? ''
const ACCOUNT_NAME = process.env.SEPAY_ACCOUNT_NAME   ?? ''

const SEPAY_API_URL   = process.env.SEPAY_API_URL   ?? 'https://my.sepay.vn'
const SEPAY_API_TOKEN = process.env.SEPAY_API_TOKEN ?? ''

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQrUrl(orderCode: string, amount: number): string {
  const params = new URLSearchParams({
    amount:      String(amount),
    addInfo:     orderCode,
    accountName: ACCOUNT_NAME,
  })
  return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.jpg?${params}`
}

// Decimal không serialize thành number qua JSON nên phải convert tay.
// (Các query đọc đã omit rawPayload nên không cần loại ở đây.)
const serializeTx = <T extends { transferAmount: Prisma.Decimal }>(tx: T) =>
  ({ ...tx, transferAmount: Number(tx.transferAmount) })

// ─── Chuẩn hoá giao dịch ──────────────────────────────────────────────────────

function normalizeWebhook(p: SePayWebhookPayload): NormalizedSePayTx {
  return {
    sepayId:         Number(p.id),
    gateway:         p.gateway || 'unknown',
    accountNumber:   p.accountNumber || null,
    transferType:    p.transferType,
    transferAmount:  Number(p.transferAmount),
    content:         p.content || '',
    referenceCode:   p.referenceCode || null,
    transactionDate: new Date(p.transactionDate),
    source:          'WEBHOOK',
    raw:             p,
  }
}

// UserAPI trả shape khác webhook: snake_case và tách amount_in / amount_out
function normalizeApiTx(t: SePayApiTransaction): NormalizedSePayTx {
  const amountIn  = Number(t.amount_in)  || 0
  const amountOut = Number(t.amount_out) || 0
  const isIn      = amountIn > 0

  return {
    sepayId:         Number(t.id),
    gateway:         t.bank_brand_name || 'unknown',
    accountNumber:   t.account_number || null,
    transferType:    isIn ? 'in' : 'out',
    transferAmount:  isIn ? amountIn : amountOut,
    content:         t.transaction_content ?? '',
    referenceCode:   t.reference_number ?? null,
    transactionDate: new Date(t.transaction_date),
    source:          'SYNC',
    raw:             t,
  }
}

// ─── Ghi nhận giao dịch (dùng chung cho webhook + sync) ───────────────────────

type IngestResult = {
  handled: boolean
  duplicate?: boolean
  orderCode?: string
  status?: SePayTxStatus
  reason?: string
}

function txBaseData(tx: NormalizedSePayTx) {
  return {
    sepayId:         tx.sepayId,
    gateway:         tx.gateway,
    accountNumber:   tx.accountNumber,
    transferType:    tx.transferType,
    transferAmount:  new Prisma.Decimal(tx.transferAmount),
    content:         tx.content,
    referenceCode:   tx.referenceCode,
    transactionDate: tx.transactionDate,
    source:          tx.source,
    rawPayload:      tx.raw as Prisma.InputJsonValue,
  }
}

// Đánh dấu đơn đã thanh toán theo cách chống race: chỉ update khi còn UNPAID.
// count === 0 nghĩa là một giao dịch khác vừa thanh toán đơn này trước đó.
// PENDING → CONFIRMED đi kèm để không phải update status ở bước riêng.
type OrderPaidCtx = { id: string; status: OrderStatus }
function markOrderPaid(t: Prisma.TransactionClient, order: OrderPaidCtx, paidAt: Date) {
  return t.order.updateMany({
    where: { id: order.id, paymentStatus: PaymentStatus.UNPAID },
    data:  {
      paymentStatus: PaymentStatus.PAID,
      paidAt,
      ...(order.status === OrderStatus.PENDING && { status: OrderStatus.CONFIRMED }),
    },
  })
}

// Ghi giao dịch không khớp đơn — KHÔNG nuốt im lặng, để admin xử lý tay
// qua GET /admin/payment/transactions/unmatched.
async function recordUnresolved(
  tx: NormalizedSePayTx,
  status: SePayTxStatus,
  reason: string,
  orderCode?: string
): Promise<IngestResult> {
  await prisma.sePayTransaction.create({
    data: { ...txBaseData(tx), status, note: reason, orderCode: orderCode ?? null },
  })
  return { handled: false, status, reason, orderCode }
}

async function resolveAndRecord(tx: NormalizedSePayTx): Promise<IngestResult> {
  if (tx.transferType !== 'in') {
    return recordUnresolved(tx, SePayTxStatus.IGNORED, 'Giao dịch tiền ra')
  }

  const match = tx.content.match(ORDER_CODE_RE)
  if (!match) {
    return recordUnresolved(tx, SePayTxStatus.UNMATCHED, 'Không tìm thấy mã đơn trong nội dung chuyển khoản')
  }

  const orderCode = match[0].toUpperCase()
  const order = await prisma.order.findUnique({
    where:  { orderCode },
    select: { id: true, total: true, paymentStatus: true, status: true },
  })

  if (!order) {
    return recordUnresolved(tx, SePayTxStatus.UNMATCHED, `Không tìm thấy đơn hàng ${orderCode}`, orderCode)
  }
  if (order.paymentStatus === PaymentStatus.PAID) {
    return recordUnresolved(tx, SePayTxStatus.UNMATCHED, 'Đơn hàng đã được thanh toán trước đó', orderCode)
  }

  const expected = Number(order.total)
  if (tx.transferAmount !== expected) {
    return recordUnresolved(
      tx,
      SePayTxStatus.UNMATCHED,
      `Số tiền không khớp: nhận ${tx.transferAmount}, cần ${expected}`,
      orderCode
    )
  }

  return prisma.$transaction(async (t) => {
    const { count } = await markOrderPaid(t, order, tx.transactionDate)

    if (count === 0) {
      await t.sePayTransaction.create({
        data: {
          ...txBaseData(tx),
          status:    SePayTxStatus.UNMATCHED,
          orderCode,
          note:      'Đơn vừa được thanh toán bởi giao dịch khác',
        },
      })
      return { handled: false, status: SePayTxStatus.UNMATCHED, orderCode }
    }

    await t.sePayTransaction.create({
      data: { ...txBaseData(tx), status: SePayTxStatus.MATCHED, orderId: order.id, orderCode },
    })
    return { handled: true, status: SePayTxStatus.MATCHED, orderCode }
  })
}

async function ingestTransaction(tx: NormalizedSePayTx): Promise<IngestResult> {
  if (!Number.isFinite(tx.sepayId)) {
    return { handled: false, reason: 'Payload thiếu id giao dịch' }
  }
  if (isNaN(tx.transactionDate.getTime())) {
    return { handled: false, reason: 'transactionDate không hợp lệ' }
  }

  // SePay retry webhook khi nhận non-2xx → cùng một giao dịch có thể tới nhiều lần
  const existing = await prisma.sePayTransaction.findUnique({
    where:  { sepayId: tx.sepayId },
    select: { status: true, orderCode: true },
  })
  if (existing) {
    return { handled: false, duplicate: true, status: existing.status, orderCode: existing.orderCode ?? undefined }
  }

  try {
    return await resolveAndRecord(tx)
  } catch (err) {
    // Hai webhook trùng bắn song song lọt qua findUnique ở trên → unique index chặn
    if (isPrismaError(err, 'P2002')) {
      return { handled: false, duplicate: true }
    }
    throw err
  }
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export async function getOrderPaymentInfo(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, orderCode: true, total: true, paymentMethod: true, paymentStatus: true },
  })

  if (!order) throw new AppError(404, 'Đơn hàng không tồn tại')
  if (order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
    throw new AppError(400, 'Đơn hàng không dùng phương thức chuyển khoản ngân hàng')
  }
  if (order.paymentStatus === PaymentStatus.PAID) {
    throw new AppError(400, 'Đơn hàng đã được thanh toán')
  }

  const amount = Number(order.total)

  return {
    bankId:      BANK_ID,
    accountNo:   ACCOUNT_NO,
    accountName: ACCOUNT_NAME,
    amount,
    content:     order.orderCode,
    qrUrl:       buildQrUrl(order.orderCode, amount),
  }
}

// Endpoint nhẹ cho FE polling trong lúc hiển thị QR — chỉ select vài cột,
// không kéo theo items như GET /orders/:id.
export async function getOrderPaymentStatus(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where:  { id: orderId, userId },
    select: { id: true, orderCode: true, paymentStatus: true, status: true, paidAt: true },
  })

  if (!order) throw new AppError(404, 'Đơn hàng không tồn tại')

  return {
    orderId:       order.id,
    orderCode:     order.orderCode,
    paymentStatus: order.paymentStatus,
    orderStatus:   order.status,
    paidAt:        order.paidAt,
    isPaid:        order.paymentStatus === PaymentStatus.PAID,
  }
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export function processSePayWebhook(payload: SePayWebhookPayload) {
  return ingestTransaction(normalizeWebhook(payload))
}

// ─── Admin: đối soát giao dịch ────────────────────────────────────────────────

export async function listTransactions(query: TransactionListQuery) {
  const { page, limit } = parsePagination(query)

  const where: Prisma.SePayTransactionWhereInput = {}
  if (query.status)    where.status          = query.status
  if (query.orderCode) where.orderCode       = query.orderCode.toUpperCase()
  const range = dateRange(query.from, query.to)
  if (range)           where.transactionDate = range

  const [rows, total] = await Promise.all([
    prisma.sePayTransaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      omit:    { rawPayload: true },
    }),
    prisma.sePayTransaction.count({ where }),
  ])

  return {
    transactions: rows.map(serializeTx),
    pagination:   paginationMeta(page, limit, total),
  }
}

// Gán tay một giao dịch chưa khớp vào đơn hàng — dùng khi khách ghi sai nội dung
// chuyển khoản hoặc chuyển lệch số tiền.
export async function matchTransaction(txId: string, body: MatchTransactionBody, adminId: string) {
  const tx = await prisma.sePayTransaction.findUnique({ where: { id: txId } })
  if (!tx) throw new AppError(404, 'Giao dịch không tồn tại')
  if (tx.status === SePayTxStatus.MATCHED) throw new AppError(400, 'Giao dịch đã được gán đơn')
  if (tx.transferType !== 'in') throw new AppError(400, 'Không thể gán giao dịch tiền ra vào đơn hàng')

  const orderCode = body.orderCode.toUpperCase()
  const order = await prisma.order.findUnique({
    where:  { orderCode },
    select: { id: true, total: true, paymentStatus: true, status: true },
  })
  if (!order) throw new AppError(404, `Không tìm thấy đơn hàng ${orderCode}`)
  if (order.paymentStatus === PaymentStatus.PAID) throw new AppError(400, 'Đơn hàng đã được thanh toán')

  const amount   = Number(tx.transferAmount)
  const expected = Number(order.total)
  if (amount !== expected && !body.force) {
    throw new AppError(
      400,
      `Số tiền lệch: giao dịch ${amount}, đơn hàng ${expected}. Gửi force=true để xác nhận gán.`
    )
  }

  return prisma.$transaction(async (t) => {
    const { count } = await markOrderPaid(t, order, tx.transactionDate)
    if (count === 0) throw new AppError(409, 'Đơn hàng vừa được thanh toán bởi giao dịch khác')

    const updated = await t.sePayTransaction.update({
      where: { id: txId },
      data:  {
        status:    SePayTxStatus.MATCHED,
        orderId:   order.id,
        orderCode,
        note:      amount !== expected ? `Gán tay dù lệch tiền (${amount} / ${expected})` : 'Gán tay bởi admin',
        matchedBy: adminId,
        matchedAt: new Date(),
      },
      omit: { rawPayload: true },
    })

    return serializeTx(updated)
  })
}

// Kéo lại giao dịch từ SePay UserAPI — dùng khi nghi ngờ webhook bị rớt.
// Giao dịch đã ghi nhận sẽ bị bỏ qua nhờ unique sepayId, nên chạy lại vô hại.
export async function syncFromSePay(opts: { limit?: number; from?: string; to?: string } = {}) {
  if (!SEPAY_API_TOKEN) throw new AppError(500, 'Chưa cấu hình SEPAY_API_TOKEN')

  const params = new URLSearchParams({ limit: String(Math.min(opts.limit ?? 50, 200)) })
  if (ACCOUNT_NO) params.set('account_number', ACCOUNT_NO)
  if (opts.from)  params.set('transaction_date_min', opts.from)
  if (opts.to)    params.set('transaction_date_max', opts.to)

  let res: globalThis.Response
  try {
    res = await fetch(`${SEPAY_API_URL}/userapi/transactions/list?${params}`, {
      headers: { Authorization: `Bearer ${SEPAY_API_TOKEN}` },
      signal:  AbortSignal.timeout(15_000),
    })
  } catch {
    throw new AppError(502, 'Không kết nối được tới SePay API')
  }

  if (!res.ok) throw new AppError(502, `SePay API trả về lỗi ${res.status}`)

  const data = (await res.json()) as { transactions?: SePayApiTransaction[] }
  const list = data.transactions ?? []

  const summary = { fetched: list.length, matched: 0, unmatched: 0, ignored: 0, duplicate: 0 }

  // Tuần tự chứ không Promise.all — tránh hai giao dịch cùng gán một đơn song song
  for (const item of list) {
    const result = await ingestTransaction(normalizeApiTx(item))
    if (result.duplicate)                            summary.duplicate++
    else if (result.status === SePayTxStatus.MATCHED)  summary.matched++
    else if (result.status === SePayTxStatus.IGNORED)  summary.ignored++
    else                                               summary.unmatched++
  }

  return summary
}

// ─── Admin: thống kê thanh toán ──────────────────────────────────────────────

// Tổng hợp số liệu thanh toán cho dashboard admin:
// - revenue: tổng tiền đã thu (PAID)
// - pending: chưa thanh toán (count + amount)
// - refunded: đã hoàn tiền (count + amount)
// - awaitingBankTransfer: chờ đối soát CK (BANK_TRANSFER + UNPAID — chờ webhook SePay)
// - unmatchedTransactions: tiền đã về nhưng chưa gán được đơn — cần admin xử lý
export async function getPaymentStats() {
  const [paidAgg, unpaidAgg, refundedAgg, awaitingAgg, unmatchedAgg] = await Promise.all([
    prisma.order.aggregate({ where: { paymentStatus: PaymentStatus.PAID }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate({ where: { paymentStatus: PaymentStatus.UNPAID }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate({ where: { paymentStatus: PaymentStatus.REFUNDED }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate(
      { where: { paymentStatus: PaymentStatus.UNPAID, paymentMethod: PaymentMethod.BANK_TRANSFER }, _sum: { total: true }, _count: true },
    ),
    prisma.sePayTransaction.aggregate(
      { where: { status: SePayTxStatus.UNMATCHED }, _sum: { transferAmount: true }, _count: true },
    ),
  ])

  // _sum.total là Prisma.Decimal (Money) → convert sang number.
  const toAmount = (agg: { _sum: { total: unknown } }) => Number(agg._sum.total ?? 0)

  return {
    revenue: toAmount(paidAgg),
    pending: { count: unpaidAgg._count, amount: toAmount(unpaidAgg) },
    refunded: { count: refundedAgg._count, amount: toAmount(refundedAgg) },
    awaitingBankTransfer: { count: awaitingAgg._count, amount: toAmount(awaitingAgg) },
    unmatchedTransactions: {
      count:  unmatchedAgg._count,
      amount: Number(unmatchedAgg._sum.transferAmount ?? 0),
    },
  }
}
