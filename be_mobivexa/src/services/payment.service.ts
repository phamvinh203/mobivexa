import prisma from '../config/db'
import { AppError } from '../helpers/app_error'
import { PaymentStatus, OrderStatus, PaymentMethod } from '../generated/prisma/client'
import type { SePayWebhookPayload } from '../types/payment.type'

const BANK_ID      = process.env.SEPAY_BANK_ID       ?? ''
const ACCOUNT_NO   = process.env.SEPAY_ACCOUNT_NUMBER ?? ''
const ACCOUNT_NAME = process.env.SEPAY_ACCOUNT_NAME   ?? ''

// Compiled once at module load — reused on every webhook call
const ORDER_CODE_RE = /ORD-\d{8}-[0-9A-F]{6}/i

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQrUrl(orderCode: string, amount: number): string {
  const params = new URLSearchParams({
    amount:      String(amount),
    addInfo:     orderCode,
    accountName: ACCOUNT_NAME,
  })
  return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.jpg?${params}`
}

// ─── Service functions ────────────────────────────────────────────────────────

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

export async function processSePayWebhook(payload: SePayWebhookPayload) {
  if (payload.transferType !== 'in') return { handled: false }

  const match = payload.content.match(ORDER_CODE_RE)
  if (!match) return { handled: false }

  const orderCode = match[0].toUpperCase()
  const order = await prisma.order.findUnique({
    where: { orderCode },
    select: { id: true, total: true, paymentStatus: true, status: true },
  })

  if (!order || order.paymentStatus === PaymentStatus.PAID) return { handled: false }

  const expectedAmount = Number(order.total)
  if (payload.transferAmount !== expectedAmount) return { handled: false }

  // Validate date before issuing the DB write
  const paidAt = new Date(payload.transactionDate)
  if (isNaN(paidAt.getTime())) return { handled: false }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paidAt,
      ...(order.status === OrderStatus.PENDING && { status: OrderStatus.CONFIRMED }),
    },
  })

  return { handled: true, orderCode }
}

// ─── Admin: thống kê thanh toán ──────────────────────────────────────────────

// Tổng hợp số liệu thanh toán cho dashboard admin:
// - revenue: tổng tiền đã thu (PAID)
// - pending: chưa thanh toán (count + amount)
// - refunded: đã hoàn tiền (count + amount)
// - awaitingBankTransfer: chờ đối soát CK (BANK_TRANSFER + UNPAID — chờ webhook SePay)
export async function getPaymentStats() {
  const [paidAgg, unpaidAgg, refundedAgg, awaitingAgg] = await Promise.all([
    prisma.order.aggregate({ where: { paymentStatus: PaymentStatus.PAID }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate({ where: { paymentStatus: PaymentStatus.UNPAID }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate({ where: { paymentStatus: PaymentStatus.REFUNDED }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate(
      { where: { paymentStatus: PaymentStatus.UNPAID, paymentMethod: PaymentMethod.BANK_TRANSFER }, _sum: { total: true }, _count: true },
    ),
  ])

  // _sum.total là Prisma.Decimal (Money) → convert sang number.
  const toAmount = (agg: { _sum: { total: unknown } }) => Number(agg._sum.total ?? 0)

  return {
    revenue: toAmount(paidAgg),
    pending: { count: unpaidAgg._count, amount: toAmount(unpaidAgg) },
    refunded: { count: refundedAgg._count, amount: toAmount(refundedAgg) },
    awaitingBankTransfer: { count: awaitingAgg._count, amount: toAmount(awaitingAgg) },
  }
}
