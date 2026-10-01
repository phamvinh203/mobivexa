import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { SupportTicketStatus } from '../generated/prisma/client'
import * as service from '../services/support.service'
import { SUPPORT_ACCESS_HEADER } from '../types/support.type'
import { JwtPayload } from '../types/auth.type'

// accessCode do guest gửi qua header (FE lưu localStorage sau lúc tạo ticket) —
// header name chuẩn hoá lowercase khi đọc từ req.headers.
function accessCodeFrom(req: Request): string | undefined {
  const value = req.headers[SUPPORT_ACCESS_HEADER]
  if (typeof value === 'string' && value.length > 0) return value
  return undefined
}

// POST /api/support-tickets — khách (guest được) tạo yêu cầu kết nối nhân viên.
export const create = asyncHandler(async (req: Request, res: Response) => {
  const { customerName, message } = req.body
  const ticket = await service.createTicket({ user: req.user, customerName, message })
  send(res, ticket, 201)
})

// GET /api/support-tickets/:id — trạng thái + toàn bộ tin nhắn; endpoint khách
// (và staff) poll mỗi 3-5s. Toàn bộ tin nhắn mỗi lượt poll: hội thoại hỗ trợ
// ngắn (vài chục tin là nhiều) nên gộp một request rẻ hơn đồng bộ delta.
export const get = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await service.getTicketForCustomer(req.params.id as string, req.user, accessCodeFrom(req))
  send(res, ticket)
})

// POST /api/support-tickets/:id/messages — khách gửi tin.
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await service.sendCustomerMessage(req.params.id as string, req.user, accessCodeFrom(req), req.body.content)
  send(res, ticket)
})

// ─── Admin ────────────────────────────────────────────────────────────────────

function send(res: Response, data: unknown, status = 200): void {
  res.status(status).json(data)
}

// GET /api/admin/support-tickets?status=OPEN — queue cho trang chat của staff.
export const list = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query
  const valid = status === 'OPEN' || status === 'IN_PROGRESS' || status === 'CLOSED' ? (status as SupportTicketStatus) : undefined
  send(res, await service.listTickets(valid))
})

export const getAdmin = asyncHandler(async (req: Request, res: Response) => {
  send(res, await service.getTicketForAdmin(req.params.id as string))
})

// POST /api/admin/support-tickets/:id/claim — nhận phiên (OPEN → IN_PROGRESS).
export const claim = asyncHandler(async (req: Request, res: Response) => {
  send(res, await service.claimTicket(req.params.id as string, req.user as JwtPayload))
})

// POST /api/admin/support-tickets/:id/messages — staff trả lời (tự claim nếu OPEN).
export const sendStaffMessage = asyncHandler(async (req: Request, res: Response) => {
  send(res, await service.sendStaffMessage(req.params.id as string, req.user as JwtPayload, req.body.content))
})

// POST /api/admin/support-tickets/:id/close — kết thúc phiên.
export const close = asyncHandler(async (req: Request, res: Response) => {
  send(res, await service.closeTicket(req.params.id as string, req.user as JwtPayload))
})
