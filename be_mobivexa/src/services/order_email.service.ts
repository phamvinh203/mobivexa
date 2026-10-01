import prisma from '../config/db'
import { OrderStatus, PaymentStatus, type Order, type OrderItem } from '../generated/prisma/client'
import { sendMail } from '../utils/mailer'
import {
  buildOrderCancelledEmail,
  buildOrderCreatedEmail,
  buildOrderPaidEmail,
  type OrderEmailData,
} from '../utils/email_templates'

// ─── Email thông báo đơn hàng ─────────────────────────────────────────────────
//
// Ba mốc gửi mail cho khách: đặt hàng mới / đã thanh toán / đã hủy. Nguyên tắc
// của cả module:
// 1. FIRE-AND-FORGET — các hàm ở đây CHỈ được gọi qua `void sendXxx(...).catch()`
//    tại điểm hook (sau khi response/transaction nghiệp vụ đã thành công). Lỗi
//    SMTP chết, timeout... ném lên trên cho hook .catch() + log, tuyệt đối không
//    được ảnh hưởng response hay rollback nghiệp vụ.
// 2. Mỗi hàm tự load lại đơn từ DB theo orderId (thay vì nhận object cồng kềnh
//    truyền qua các service) — vừa gọn chữ ký, vừa luôn đọc trạng thái MỚI NHẤT
//    sau khi commit.
// 3. Tái dụng transporter của utils/mailer — không tạo transport mới.

type OrderWithEmail = Order & { items: OrderItem[]; user: { email: string; fullName: string } }

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Công tắc đọc TẠI LÚC GỌI (không đọc lúc import) để đổi env giữa chừng vẫn có
// hiệu lực và test có thể stub. EMAIL_ORDER_ENABLED chỉ coi là TẮT khi đúng bằng
// 'false' — mọi giá trị khác (kể cả unset) là bật, tức mặc định bật. Thiếu
// SMTP_HOST thì mailer không có nơi nào để gửi → tắt luôn ở đây cho sạch.
function orderEmailEnabled(): boolean {
  return process.env.EMAIL_ORDER_ENABLED !== 'false' && !!process.env.SMTP_HOST
}

// Nhánh "bỏ qua im lặng" — log đúng một dòng debug rồi thoát, không throw.
function skipped(reason: string): void {
  console.log(`[Email] Bỏ qua gửi mail đơn hàng — ${reason}`)
}

async function loadOrderWithEmail(orderId: string): Promise<OrderWithEmail | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      user:  { select: { email: true, fullName: true } },
    },
  })
}

// Decimal của Prisma không serialize thành number — convert tay trước khi đưa
// vào template (template chỉ nhận number, xem email_templates.ts).
function toEmailData(order: OrderWithEmail): OrderEmailData {
  return {
    id:              order.id,
    orderCode:       order.orderCode,
    customerName:    order.user.fullName || order.shippingName,
    shippingAddress: [order.shippingDetail, order.shippingWard, order.shippingDistrict, order.shippingProvince]
      .filter(Boolean)
      .join(', '),
    items: order.items.map((item) => ({
      productName: item.productName,
      sku:         item.sku,
      variant:     [item.color, item.storage, item.ram].filter((v) => v !== null && v !== '').join(' / ') || null,
      quantity:    item.quantity,
      unitPrice:   Number(item.unitPrice),
      subtotal:    Number(item.subtotal),
    })),
    subtotal:      Number(order.subtotal),
    shippingFee:   Number(order.shippingFee),
    discount:      Number(order.discount),
    total:         Number(order.total),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status:        order.status,
    paidAt:        order.paidAt,
    cancelReason:  order.cancelReason,
  }
}

// ─── Ba mốc gửi ───────────────────────────────────────────────────────────────

// Mốc 1 — khách đặt hàng thành công (gọi sau khi transaction tạo đơn đã commit).
export async function sendOrderCreatedEmail(orderId: string): Promise<void> {
  if (!orderEmailEnabled()) return skipped('EMAIL_ORDER_ENABLED=false hoặc thiếu SMTP_HOST')

  const order = await loadOrderWithEmail(orderId)
  if (!order?.user?.email) return skipped(`không tìm thấy đơn ${orderId} hoặc email người nhận`)

  console.log(`[Email] Gửi mail đơn mới ${order.orderCode} → ${order.user.email}`)
  await sendMail({ to: order.user.email, ...buildOrderCreatedEmail(toEmailData(order)) })
  console.log(`[Email] Đã gửi mail đơn mới ${order.orderCode}`)
}

// Mốc 2 — đơn chuyển sang PAID (webhook SePay, gán tay giao dịch, admin PATCH).
export async function sendOrderPaidEmail(orderId: string): Promise<void> {
  if (!orderEmailEnabled()) return skipped('EMAIL_ORDER_ENABLED=false hoặc thiếu SMTP_HOST')

  const order = await loadOrderWithEmail(orderId)
  if (!order?.user?.email) return skipped(`không tìm thấy đơn ${orderId} hoặc email người nhận`)

  // Tự kiểm lại trạng thái theo DB: hook nằm sau guard chống double-pay nhưng
  // đọc DB lần nữa vẫn rẻ hơn một mail sai — đơn chưa PAID thật sự thì không gửi.
  if (order.paymentStatus !== PaymentStatus.PAID) {
    return skipped(`đơn ${order.orderCode} chưa ở trạng thái đã thanh toán`)
  }

  console.log(`[Email] Gửi mail đã thanh toán ${order.orderCode} → ${order.user.email}`)
  await sendMail({ to: order.user.email, ...buildOrderPaidEmail(toEmailData(order)) })
  console.log(`[Email] Đã gửi mail đã thanh toán ${order.orderCode}`)
}

// Mốc 3 — đơn chuyển sang CANCELLED (khách tự hủy hoặc admin đổi trạng thái).
export async function sendOrderCancelledEmail(orderId: string): Promise<void> {
  if (!orderEmailEnabled()) return skipped('EMAIL_ORDER_ENABLED=false hoặc thiếu SMTP_HOST')

  const order = await loadOrderWithEmail(orderId)
  if (!order?.user?.email) return skipped(`không tìm thấy đơn ${orderId} hoặc email người nhận`)

  // Chỉ gửi khi đơn THẬT SỰ đang ở CANCELLED — hook đã nằm sau guard chống hủy
  // hai lần, đây là lớp phòng thứ hai.
  if (order.status !== OrderStatus.CANCELLED) {
    return skipped(`đơn ${order.orderCode} không ở trạng thái đã hủy`)
  }

  console.log(`[Email] Gửi mail hủy đơn ${order.orderCode} → ${order.user.email}`)
  await sendMail({ to: order.user.email, ...buildOrderCancelledEmail(toEmailData(order)) })
  console.log(`[Email] Đã gửi mail hủy đơn ${order.orderCode}`)
}
