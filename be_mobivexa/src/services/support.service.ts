import { randomUUID } from 'crypto'
import { Prisma, SupportSender, SupportTicketStatus } from '../generated/prisma/client'
import prisma from '../config/db'
import { AppError } from '../helpers/app_error'
import { JwtPayload } from '../types/auth.type'
import {
  AdminSupportTicketCounts,
  AdminSupportTicketListItem,
  AdminSupportTicketListDto,
  CreatedSupportTicketDto,
  SupportMessageDto,
  SupportTicketDto,
} from '../types/support.type'

// ─── Mapper: model Prisma → DTO trả FE ────────────────────────────────────────

// accessCode và userId bị che ở MỌI response: accessCode chỉ trả 1 lần lúc tạo
// (qua CreatedSupportTicketDto), userId là dữ liệu nội bộ không cần cho UI.
type MessageRow = { id: string; sender: SupportSender; senderName: string; content: string; createdAt: Date }
type TicketRow = {
  id: string
  status: SupportTicketStatus
  customerName: string
  claimedByName: string | null
  closedAt: Date | null
  createdAt: Date
  updatedAt: Date
  messages: MessageRow[]
}

function toMessageDto(m: MessageRow): SupportMessageDto {
  return { id: m.id, sender: m.sender, senderName: m.senderName, content: m.content, createdAt: m.createdAt.toISOString() }
}

function toTicketDto(ticket: TicketRow): SupportTicketDto {
  return {
    id: ticket.id,
    status: ticket.status,
    customerName: ticket.customerName,
    claimedByName: ticket.claimedByName,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messages: ticket.messages.map(toMessageDto),
  }
}

// Đọc hội thoại: messages theo thứ tự thời gian tăng dần cho render xuôi.
const TICKET_INCLUDE_MESSAGES = {
  messages: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.SupportTicketInclude

async function getTicketWithMessages(id: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, include: TICKET_INCLUDE_MESSAGES })
  if (!ticket) throw new AppError(404, 'Không tìm thấy phiên hỗ trợ')
  return ticket
}

// ─── Phân quyền truy cập ticket phía khách ────────────────────────────────────

// Khách đọc/ghi phiên của mình qua một trong hai kênh: JWT khớp chủ ticket, hoặc
// header x-ticket-code khớp accessCode (kênh của guest). LƯU Ý: staff KHÔNG đi
// qua được ticket guest bằng endpoint khách (userId null không khớp JWT nào) —
// staff đọc phiên qua endpoint admin (getTicketForAdmin). Sai cả hai kênh → 404
// thay vì 403: không xác nhận cho người lạ rằng ticket đó có tồn tại.
function assertTicketAccess(ticket: { userId: string | null; accessCode: string | null }, user: JwtPayload | undefined, accessCode: string | undefined): void {
  if (ticket.accessCode && accessCode === ticket.accessCode) return
  if (user && ticket.userId === user.userId) return
  throw new AppError(404, 'Không tìm thấy phiên hỗ trợ')
}

// ─── Khách: tạo ticket ────────────────────────────────────────────────────────

export async function createTicket(input: { user?: JwtPayload; customerName?: string; message: string }): Promise<CreatedSupportTicketDto> {
  const { user } = input
  const message = input.message.trim()
  let customerName = input.customerName?.trim() ?? ''

  if (user) {
    // Tên hiển thị luôn lấy từ DB — JWT chỉ có email, và tên khai bời body không
    // đáng tin (khách đăng nhập mà tự đặt tên khác sẽ phá quyền sở hữu theo userId).
    const account = await prisma.user.findUnique({ where: { id: user.userId }, select: { fullName: true } })
    if (account) customerName = account.fullName
  }
  if (!customerName) throw new AppError(400, 'Vui lòng cho biết tên của bạn')

  // Rào "1 ticket mở/khách": chỉ chặn được với khách đã đăng nhập (truy theo userId) và
  // là biện pháp best-effort — guest không có định danh bền vững (chặn bằng
  // supportTicketLimiter theo IP), và guest tạo ticket rồi đăng nhập vẫn tạo thêm được.
  if (user) {
    const openTicket = await prisma.supportTicket.findFirst({
      where: { userId: user.userId, status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] } },
      select: { id: true },
    })
    if (openTicket) throw new AppError(409, 'Bạn còn một phiên hỗ trợ đang mở — hãy tiếp tục trò chuyện trong phiên đó')
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user?.userId ?? null,
      customerName,
      accessCode: randomUUID(),
      messages: { create: { sender: SupportSender.CUSTOMER, senderName: customerName, content: message } },
    },
    include: TICKET_INCLUDE_MESSAGES,
  })
  return { ...toTicketDto(ticket), accessCode: ticket.accessCode! }
}

// ─── Khách: đọc + gửi tin nhắn ────────────────────────────────────────────────

export async function getTicketForCustomer(id: string, user: JwtPayload | undefined, accessCode: string | undefined): Promise<SupportTicketDto> {
  const ticket = await getTicketWithMessages(id)
  assertTicketAccess(ticket, user, accessCode)
  return toTicketDto(ticket)
}

export async function sendCustomerMessage(id: string, user: JwtPayload | undefined, accessCode: string | undefined, content: string): Promise<SupportTicketDto> {
  const ticket = await getTicketWithMessages(id)
  assertTicketAccess(ticket, user, accessCode)

  if (ticket.status === SupportTicketStatus.CLOSED) {
    throw new AppError(409, 'Phiên hỗ trợ đã kết thúc, không thể gửi thêm tin nhắn')
  }

  await prisma.supportMessage.create({
    data: { ticketId: ticket.id, sender: SupportSender.CUSTOMER, senderName: ticket.customerName, content: content.trim() },
  })
  return toTicketDto(await getTicketWithMessages(id))
}

// ─── Admin: danh sách ticket ──────────────────────────────────────────────────

export async function listTickets(status?: SupportTicketStatus): Promise<AdminSupportTicketListDto> {
  const [tickets, groupCounts] = await Promise.all([
    prisma.supportTicket.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const items: AdminSupportTicketListItem[] = tickets.map((t) => {
    const last = t.messages[0]
    return {
      id: t.id,
      status: t.status,
      customerName: t.customerName,
      claimedByName: t.claimedByName,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      lastMessage: last ? { sender: last.sender, senderName: last.senderName, content: last.content, createdAt: last.createdAt.toISOString() } : null,
    }
  })

  const counts: AdminSupportTicketCounts = { open: 0, inProgress: 0, closed: 0 }
  for (const row of groupCounts) {
    if (row.status === SupportTicketStatus.OPEN) counts.open = row._count._all
    if (row.status === SupportTicketStatus.IN_PROGRESS) counts.inProgress = row._count._all
    if (row.status === SupportTicketStatus.CLOSED) counts.closed = row._count._all
  }
  return { tickets: items, counts }
}

// ─── Admin: nhận phiên, trả lời, đóng ─────────────────────────────────────────

async function staffFullName(userId: string): Promise<string> {
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } })
  // Fallback tên thương hiệu (không phải "Nhân viên Mobivexa") — nơi gọi đã thêm
  // ngữ cảnh "Nhân viên {name}", fallback lặp chữ sẽ thành "Nhân viên Nhân viên…".
  return account?.fullName ?? 'Mobivexa'
}

// Nhận phiên: OPEN → IN_PROGRESS. Tự nhận lại của chính mình là idempotent (polling
// bấm nhầm hai lần không tạo system message trùng); của người khác thì 409 —
// hệ thống v1 không có chế độ "đấu quyền" giữa staff.
export async function claimTicket(id: string, admin: JwtPayload): Promise<SupportTicketDto> {
  const ticket = await getTicketWithMessages(id)

  if (ticket.status === SupportTicketStatus.CLOSED) {
    throw new AppError(409, 'Phiên hỗ trợ đã kết thúc')
  }
  if (ticket.status === SupportTicketStatus.IN_PROGRESS && ticket.claimedById !== admin.userId) {
    throw new AppError(409, `${ticket.claimedByName ?? 'Nhân viên khác'} đã nhận phiên này`)
  }
  if (ticket.status === SupportTicketStatus.IN_PROGRESS) {
    return toTicketDto(ticket) // phiên của chính mình
  }

  const name = await staffFullName(admin.userId)
  // Guard `status: OPEN` ngay trong WHERE: hai staff bấm Nhận song song đều thấy
  // phiên còn OPEN nhưng chỉ MỘT lượt update ghi được (read-then-write không guard
  // là last-writer-wins — hai system message "đã tham gia" trùng nhau). Chốt chặn
  // cùng kiểu với huỷ đơn ở order.service (update where: { id, status }).
  const claimed = await prisma.supportTicket.updateMany({
    where: { id, status: SupportTicketStatus.OPEN },
    data: { status: SupportTicketStatus.IN_PROGRESS, claimedById: admin.userId, claimedByName: name },
  })
  if (claimed.count === 0) {
    // Thua race: staff khác vừa chốt claim (hoặc phiên vừa bị đóng) giữa lúc đọc
    // và lúc ghi — đọc lại để trả 409 đúng người thay vì ghi đè kết quả của họ.
    const latest = await getTicketWithMessages(id)
    if (latest.status === SupportTicketStatus.CLOSED) throw new AppError(409, 'Phiên hỗ trợ đã kết thúc')
    if (latest.status === SupportTicketStatus.IN_PROGRESS && latest.claimedById !== admin.userId) {
      throw new AppError(409, `${latest.claimedByName ?? 'Nhân viên khác'} đã nhận phiên này`)
    }
    return toTicketDto(latest)
  }

  await prisma.supportMessage.create({
    data: { ticketId: id, sender: SupportSender.SYSTEM, senderName: name, content: `Nhân viên ${name} đã tham gia hỗ trợ bạn.` },
  })
  return toTicketDto(await getTicketWithMessages(id))
}

// Staff trả lời. Nhắn khi phiên vẫn OPEN là hành vi "nhận" — claim luôn tại đây
// để khách không phải chờ staff bấm nhận rồi mới thấy tin (tránh race claim/nhắn).
// v1 cho phép MỌI staff nhắn vào phiên đang IN_PROGRESS (trực chung một queue như
// shop thật) — hành vi được test chốt; muốn "một người phụ trách" thì siết ở đây.
export async function sendStaffMessage(id: string, admin: JwtPayload, content: string): Promise<SupportTicketDto> {
  const ticket = await getTicketWithMessages(id)

  if (ticket.status === SupportTicketStatus.CLOSED) {
    throw new AppError(409, 'Phiên hỗ trợ đã kết thúc, không thể gửi thêm tin nhắn')
  }

  if (ticket.status === SupportTicketStatus.OPEN) {
    await claimTicket(id, admin)
  }

  const name = await staffFullName(admin.userId)
  await prisma.supportMessage.create({
    data: { ticketId: id, sender: SupportSender.STAFF, senderName: name, content: content.trim() },
  })
  return toTicketDto(await getTicketWithMessages(id))
}

export async function closeTicket(id: string, admin: JwtPayload): Promise<SupportTicketDto> {
  const ticket = await getTicketWithMessages(id)

  if (ticket.status === SupportTicketStatus.CLOSED) return toTicketDto(ticket) // idempotent cho polling

  const name = await staffFullName(admin.userId)
  // Guard `not: CLOSED` trong WHERE: claim và close đua song song thì lượt close
  // phải thắng — nếu claim ghi đè CLOSED thành IN_PROGRESS mà quên clear closedAt,
  // ticket rơi vào trạng thái mâu thuẫn và khách bị chặn nhắn 409 vĩnh viễn.
  const closed = await prisma.supportTicket.updateMany({
    where: { id, status: { not: SupportTicketStatus.CLOSED } },
    data: { status: SupportTicketStatus.CLOSED, closedAt: new Date() },
  })
  if (closed.count > 0) {
    // Chỉ lượt close thắng race mới chèn system message — không trùng thông báo.
    await prisma.supportMessage.create({
      data: { ticketId: id, sender: SupportSender.SYSTEM, senderName: name, content: 'Phiên hỗ trợ đã kết thúc. Chúc bạn mua sắm vui vẻ!' },
    })
  }
  return toTicketDto(await getTicketWithMessages(id))
}

// Dùng khi admin cần đọc một ticket bất kỳ (nút "xem lại" trong list) — staff
// nhìn thấy mọi phiên nên không cần assertTicketAccess.
export async function getTicketForAdmin(id: string): Promise<SupportTicketDto> {
  return toTicketDto(await getTicketWithMessages(id))
}
