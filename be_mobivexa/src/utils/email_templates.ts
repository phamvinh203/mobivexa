import { OrderStatus, PaymentMethod, PaymentStatus } from '../generated/prisma/client'
import { formatVnd } from './discount'

// ─── Kiểu dữ liệu đầu vào ─────────────────────────────────────────────────────
//
// Template nhận dữ liệu ĐÃ MAP SẠNG number (không Prisma.Decimal) và chuỗi đã
// ghép sẵn, nên không import gì từ Prisma ngoài enum để dựng nhãn. Service gọi
// chịu trách nhiệm convert — template thuần là hàm dựng chuỗi HTML.

export type OrderItemEmail = {
  productName: string
  sku:        string
  variant:    string | null // "Đen / 128GB" — đã ghép từ color/storage/ram ở service
  quantity:   number
  unitPrice:  number
  subtotal:   number
}

export type OrderEmailData = {
  id:              string
  orderCode:       string
  customerName:    string
  shippingAddress: string
  items:           OrderItemEmail[]
  subtotal:        number
  shippingFee:     number
  discount:        number
  total:           number
  paymentMethod:   PaymentMethod
  paymentStatus:   PaymentStatus
  status:          OrderStatus
  paidAt:          Date | null
  cancelReason:    string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const vnd = (amount: number): string => formatVnd(amount) + '₫'

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// productName/customerName/cancelReason/address đều do người dùng nhập — chèn
// vào HTML phải escape, nếu không một sản phẩm tên "<script>" là lỗ hổng chèn
// HTML/JS ngay trong email client.
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Link xem đơn trên web khách — route chi tiết đơn trong AppRouter.tsx của
// web_mobivexa: `/tai-khoan/don-hang/:orderId`. Origin lấy phần tử đầu hợp lệ
// trong FRONTEND_URL (danh sách phân tách bởi dấu phẩy, cùng quy ước với
// resolveSiteUrl của blog). Không có origin hợp lệ → trả null, template bỏ nút
// bấm thay vì render link hỏng.
function orderDetailUrl(orderId: string): string | null {
  const candidates = (process.env.FRONTEND_URL ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return `${url.origin}/tai-khoan/don-hang/${orderId}`
      }
    } catch {
      // Phần tử không parse được URL — thử phần tử kế tiếp
    }
  }
  return null
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]:   'Chờ xác nhận',
  [OrderStatus.CONFIRMED]: 'Đã xác nhận',
  [OrderStatus.SHIPPING]:  'Đang giao hàng',
  [OrderStatus.DELIVERED]: 'Đã giao hàng',
  [OrderStatus.CANCELLED]: 'Đã hủy',
}

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  [PaymentStatus.UNPAID]:   'Chưa thanh toán',
  [PaymentStatus.PAID]:     'Đã thanh toán',
  [PaymentStatus.REFUNDED]: 'Đã hoàn tiền',
}

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  [PaymentMethod.COD]:           'COD — thanh toán khi nhận hàng',
  [PaymentMethod.BANK_TRANSFER]: 'Chuyển khoản ngân hàng',
}

// ─── Khối HTML dùng chung ─────────────────────────────────────────────────────
//
// Email client không ăn external CSS → mọi style đều inline. Bố cục dùng table
// thay vì flex/grid vì một số client (Outlook cũ) bỏ flex.

function wrapInLayout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#333;font-size:14px;line-height:1.6">
      <h2 style="margin:0 0 4px;color:#111">${title}</h2>
      ${bodyHtml}
      <p style="margin-top:24px;font-size:12px;color:#999">Email tự động từ Mobivexa — vui lòng không trả lời email này.</p>
    </div>
  `
}

function buildItemsTable(data: OrderEmailData): string {
  const rows = data.items
    .map((item) => {
      const variant = item.variant ? ` • ${escapeHtml(item.variant)}` : ''
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">
            ${escapeHtml(item.productName)}
            <br><span style="color:#999;font-size:12px">SKU: ${escapeHtml(item.sku)}${variant}</span>
          </td>
          <td align="center" style="padding:8px;border-bottom:1px solid #eee">×${item.quantity}</td>
          <td align="right" style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap">${vnd(item.unitPrice)}</td>
          <td align="right" style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap">${vnd(item.subtotal)}</td>
        </tr>`
    })
    .join('')

  // Dòng giảm giá chỉ hiện khi có giảm — đơn không mã nhìn cho gọn.
  const discountRow = data.discount > 0
    ? `<tr><td colspan="3" align="right" style="padding:4px 8px">Giảm giá</td><td align="right" style="padding:4px 8px;white-space:nowrap">−${vnd(data.discount)}</td></tr>`
    : ''

  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr>
          <th align="left"  style="padding:8px;border-bottom:2px solid #eee">Sản phẩm</th>
          <th align="center" style="padding:8px;border-bottom:2px solid #eee">SL</th>
          <th align="right" style="padding:8px;border-bottom:2px solid #eee">Đơn giá</th>
          <th align="right" style="padding:8px;border-bottom:2px solid #eee">Tạm tính</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot style="font-size:13px">
        <tr><td colspan="3" align="right" style="padding:4px 8px">Tạm tính</td><td align="right" style="padding:4px 8px;white-space:nowrap">${vnd(data.subtotal)}</td></tr>
        <tr><td colspan="3" align="right" style="padding:4px 8px">Phí vận chuyển</td><td align="right" style="padding:4px 8px;white-space:nowrap">${vnd(data.shippingFee)}</td></tr>
        ${discountRow}
        <tr><td colspan="3" align="right" style="padding:8px;font-weight:bold">Tổng cộng</td><td align="right" style="padding:8px;font-weight:bold;font-size:16px;white-space:nowrap">${vnd(data.total)}</td></tr>
      </tfoot>
    </table>`
}

// Phương thức + trạng thái thanh toán + trạng thái đơn + địa chỉ giao.
function buildOrderInfo(data: OrderEmailData): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
      <tr><td style="padding:4px 8px;color:#888;width:160px">Mã đơn hàng</td><td style="padding:4px 8px;font-weight:bold">${escapeHtml(data.orderCode)}</td></tr>
      <tr><td style="padding:4px 8px;color:#888">Phương thức thanh toán</td><td style="padding:4px 8px">${PAYMENT_METHOD_LABEL[data.paymentMethod]}</td></tr>
      <tr><td style="padding:4px 8px;color:#888">Trạng thái thanh toán</td><td style="padding:4px 8px">${PAYMENT_STATUS_LABEL[data.paymentStatus]}</td></tr>
      <tr><td style="padding:4px 8px;color:#888">Trạng thái đơn</td><td style="padding:4px 8px">${STATUS_LABEL[data.status]}</td></tr>
      <tr><td style="padding:4px 8px;color:#888">Địa chỉ nhận hàng</td><td style="padding:4px 8px">${escapeHtml(data.shippingAddress || '—')}</td></tr>
    </table>`
}

function buildViewOrderLink(data: OrderEmailData): string {
  const url = orderDetailUrl(data.id)
  if (!url) return ''
  return `
    <p style="margin:24px 0">
      <a href="${url}" style="background-color:#2563eb;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;display:inline-block">Xem chi tiết đơn hàng</a>
    </p>`
}

function greeting(data: OrderEmailData): string {
  return `<p style="margin:12px 0">Xin chào <strong>${escapeHtml(data.customerName)}</strong>,</p>`
}

// ─── Ba template ──────────────────────────────────────────────────────────────

// Mốc 1 — khách vừa đặt hàng thành công.
export function buildOrderCreatedEmail(data: OrderEmailData): { subject: string; html: string } {
  const subject = `Mobivexa - Đơn hàng ${data.orderCode} đã được ghi nhận`
  const html = wrapInLayout(
    'Đơn hàng của bạn đã được ghi nhận',
    `
      ${greeting(data)}
      <p style="margin:12px 0">Cảm ơn bạn đã đặt hàng tại <strong>Mobivexa</strong>. Đơn hàng <strong>${escapeHtml(data.orderCode)}</strong> của bạn đã được ghi nhận và đang chờ xác nhận.</p>
      ${buildItemsTable(data)}
      ${buildOrderInfo(data)}
      ${buildViewOrderLink(data)}
    `
  )
  return { subject, html }
}

// Mốc 2 — đơn chuyển sang PAID (webhook SePay / gán tay giao dịch / admin PATCH).
export function buildOrderPaidEmail(data: OrderEmailData): { subject: string; html: string } {
  const paidLine = data.paidAt
    ? `<p style="margin:12px 0">Thời gian xác nhận: <strong>${formatDateTime(data.paidAt)}</strong></p>`
    : ''
  const subject = `Mobivexa - Đơn hàng ${data.orderCode} đã được thanh toán`
  const html = wrapInLayout(
    'Thanh toán thành công',
    `
      ${greeting(data)}
      <p style="margin:12px 0">Chúng tôi đã nhận được thanh toán cho đơn hàng <strong>${escapeHtml(data.orderCode)}</strong> với số tiền <strong>${vnd(data.total)}</strong>. Đơn hàng sẽ được xử lý và giao tới bạn sớm nhất.</p>
      ${paidLine}
      ${buildItemsTable(data)}
      ${buildOrderInfo(data)}
      ${buildViewOrderLink(data)}
    `
  )
  return { subject, html }
}

// Mốc 3 — đơn chuyển sang CANCELLED (khách tự hủy hoặc admin đổi trạng thái).
export function buildOrderCancelledEmail(data: OrderEmailData): { subject: string; html: string } {
  // Đơn hủy mà đã thu tiền thì phải nói rõ chuyện hoàn tiền — nếu không khách
  // đọc mail chỉ thấy "đã hủy" và tưởng mất tiền.
  const refundNote = data.paymentStatus === PaymentStatus.PAID
    ? '<p style="margin:12px 0;padding:12px;background-color:#fff7ed;border-left:4px solid #f59e0b">Đơn hàng đã được thanh toán trước đó — bộ phận chăm sóc khách hàng sẽ liên hệ với bạn để hoàn tiền.</p>'
    : ''
  const reasonLine = data.cancelReason
    ? `<p style="margin:12px 0">Lý do hủy: <em>${escapeHtml(data.cancelReason)}</em></p>`
    : ''
  const subject = `Mobivexa - Đơn hàng ${data.orderCode} đã bị hủy`
  const html = wrapInLayout(
    'Đơn hàng đã bị hủy',
    `
      ${greeting(data)}
      <p style="margin:12px 0">Đơn hàng <strong>${escapeHtml(data.orderCode)}</strong> của bạn đã bị hủy. Rất tiếc vì sự bất tiện này.</p>
      ${reasonLine}
      ${refundNote}
      ${buildItemsTable(data)}
      ${buildOrderInfo(data)}
      ${buildViewOrderLink(data)}
    `
  )
  return { subject, html }
}
