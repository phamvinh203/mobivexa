/** Live chat "Kết nối nhân viên": tạo ticket (guest/user), xác thực phiên bằng
 *  accessCode/JWT, chặn 1 ticket mở/khách, queue + claim + trả lời + close phía
 *  admin. Prisma mock toàn phần — không chạm DB thật. */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  supportTicket: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    update: vi.fn(),
  },
  supportMessage: { create: vi.fn() },
  user: { findUnique: vi.fn() },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app = createApp()
const token    = (role: string, userId = 'u-1') => `Bearer ${signAccessToken({ userId, email: `${userId}@test.com`, role })}`
const ADMIN    = token('ADMIN')
const STAFF    = token('STAFF')
const STAFF2   = token('STAFF', 'staff-2')
const CUSTOMER = token('CUSTOMER', 'c-1')
const CUSTOMER2 = token('CUSTOMER', 'c-2')

const TICKET_ID = 'ticket-1'
const ACCESS_CODE = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

// Ticket đầy đủ shape Prisma trả (kèm include messages asc) — makeMessages xếp
// theo thời gian tăng dần như orderBy createdAt asc trong service.
function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID,
    userId: null,
    customerName: 'Nguyễn Văn A',
    accessCode: ACCESS_CODE,
    status: 'OPEN',
    claimedById: null,
    claimedByName: null,
    closedAt: null,
    createdAt: new Date('2026-10-02T02:00:00.000Z'),
    updatedAt: new Date('2026-10-02T02:00:00.000Z'),
    messages: [
      { id: 'm-1', sender: 'CUSTOMER', senderName: 'Nguyễn Văn A', content: 'Cho mình hỏi trả góp 0%?', createdAt: new Date('2026-10-02T02:00:00.000Z') },
    ],
    ...overrides,
  }
}

const post = (url: string, body?: object, auth?: string) => {
  const req = request(app).post(url)
  if (auth) req.set('Authorization', auth)
  return req.send(body ?? {})
}
const get = (url: string, auth?: string) => {
  const req = request(app).get(url)
  if (auth) req.set('Authorization', auth)
  return req
}

beforeEach(() => {
  vi.clearAllMocks()
  // Mặc định "hạnh phúc": không có ticket mở cũ, không có user trong DB
  mockPrisma.supportTicket.findFirst.mockResolvedValue(null)
  mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket())
  mockPrisma.supportTicket.create.mockResolvedValue(makeTicket())
  mockPrisma.supportTicket.findMany.mockResolvedValue([])
  mockPrisma.supportTicket.groupBy.mockResolvedValue([])
  mockPrisma.supportTicket.update.mockResolvedValue(makeTicket())
  mockPrisma.supportMessage.create.mockResolvedValue({})
  mockPrisma.user.findUnique.mockResolvedValue(null)
})

// ─── POST /api/support-tickets — tạo ticket ───────────────────────────────────

describe('POST /api/support-tickets — tạo ticket', () => {
  it('201 - guest tạo được, có accessCode, tin nhắn đầu tạo cùng ticket', async () => {
    const res = await post('/api/support-tickets', { customerName: 'Nguyễn Văn A', message: 'Cho mình hỏi trả góp 0%?' })

    expect(res.status).toBe(201)
    expect(res.body.accessCode).toBe(ACCESS_CODE)
    expect(res.body.status).toBe('OPEN')
    // accessCode sinh 1 lần và KHÔNG được tái xuất trong messages/field khác
    expect(mockPrisma.supportTicket.create).toHaveBeenCalledTimes(1)
    const createArg = mockPrisma.supportTicket.create.mock.calls[0][0]
    expect(createArg.data.userId).toBeNull()
    expect(createArg.data.messages.create).toMatchObject({ sender: 'CUSTOMER', content: 'Cho mình hỏi trả góp 0%?' })
  })

  it('400 - thiếu nội dung', async () => {
    const res = await post('/api/support-tickets', { customerName: 'A', message: '   ' })
    expect(res.status).toBe(400)
    expect(mockPrisma.supportTicket.create).not.toHaveBeenCalled()
  })

  it('400 - guest không khai tên', async () => {
    // Validator cho qua (customerName undefined là hợp lệ với guest), service chặn
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const res = await post('/api/support-tickets', { message: 'Cần hỗ trợ' })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('tên')
  })

  it('201 - user đăng nhập: tên lấy từ DB, bỏ qua tên client gửi', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Trần Đã Đăng Nhập' })
    const res = await post('/api/support-tickets', { customerName: 'Tên Giả', message: 'Cần hỗ trợ' }, CUSTOMER)

    expect(res.status).toBe(201)
    const createArg = mockPrisma.supportTicket.create.mock.calls[0][0]
    expect(createArg.data.userId).toBe('c-1')
    expect(createArg.data.customerName).toBe('Trần Đã Đăng Nhập')
  })

  it('409 - user còn ticket OPEN/IN_PROGRESS', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Trần Đã Đăng Nhập' })
    mockPrisma.supportTicket.findFirst.mockResolvedValue({ id: 'old-ticket' })
    const res = await post('/api/support-tickets', { message: 'Cần hỗ trợ' }, CUSTOMER)

    expect(res.status).toBe(409)
    expect(mockPrisma.supportTicket.create).not.toHaveBeenCalled()
  })

  it('guest KHÔNG bị chặn bởi rào 1 ticket/khách (chỉ rate limiter)', async () => {
    const res = await post('/api/support-tickets', { customerName: 'A', message: 'Cần hỗ trợ' })
    expect(res.status).toBe(201)
    expect(mockPrisma.supportTicket.findFirst).not.toHaveBeenCalled()
  })
})

// ─── GET /api/support-tickets/:id — xác thực phiên ────────────────────────────

describe('GET /api/support-tickets/:id — truy cập phiên', () => {
  it('200 - guest đúng accessCode qua header', async () => {
    const res = await get(`/api/support-tickets/${TICKET_ID}`).set('x-ticket-code', ACCESS_CODE)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(TICKET_ID)
    expect(res.body.messages).toHaveLength(1)
    expect(res.body.accessCode).toBeUndefined() // chỉ trả 1 lần lúc tạo
    expect(res.body.userId).toBeUndefined()
  })

  it('404 - guest sai accessCode (không xác nhận ticket tồn tại)', async () => {
    const res = await get(`/api/support-tickets/${TICKET_ID}`).set('x-ticket-code', 'sai-code')
    expect(res.status).toBe(404)
  })

  it('404 - không token, không code', async () => {
    const res = await get(`/api/support-tickets/${TICKET_ID}`)
    expect(res.status).toBe(404)
  })

  it('200 - chủ ticket đăng nhập (JWT khớp userId)', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ userId: 'c-1' }))
    const res = await get(`/api/support-tickets/${TICKET_ID}`, CUSTOMER)
    expect(res.status).toBe(200)
  })

  it('404 - user khác truy cập ticket của người khác', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ userId: 'c-1' }))
    const res = await get(`/api/support-tickets/${TICKET_ID}`, CUSTOMER2)
    expect(res.status).toBe(404)
  })

  it('404 - ticket không tồn tại', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(null)
    const res = await get(`/api/support-tickets/${TICKET_ID}`, ADMIN)
    expect(res.status).toBe(404)
  })
})

// ─── POST /api/support-tickets/:id/messages — khách gửi tin ───────────────────

describe('POST /api/support-tickets/:id/messages — khách gửi tin', () => {
  it('200 - gửi được khi phiên đang mở, tin gắn senderName snapshot của ticket', async () => {
    const res = await post(`/api/support-tickets/${TICKET_ID}/messages`, { content: 'Alo' }).set('x-ticket-code', ACCESS_CODE)
    expect(res.status).toBe(200)
    expect(mockPrisma.supportMessage.create).toHaveBeenCalledWith({
      data: { ticketId: TICKET_ID, sender: 'CUSTOMER', senderName: 'Nguyễn Văn A', content: 'Alo' },
    })
  })

  it('409 - phiên đã CLOSED', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ status: 'CLOSED', closedAt: new Date() }))
    const res = await post(`/api/support-tickets/${TICKET_ID}/messages`, { content: 'Alo' }).set('x-ticket-code', ACCESS_CODE)
    expect(res.status).toBe(409)
    expect(mockPrisma.supportMessage.create).not.toHaveBeenCalled()
  })

  it('400 - tin nhắn rỗng', async () => {
    const res = await post(`/api/support-tickets/${TICKET_ID}/messages`, { content: '' }).set('x-ticket-code', ACCESS_CODE)
    expect(res.status).toBe(400)
  })
})

// ─── GET /api/admin/support-tickets — queue ───────────────────────────────────

describe('GET /api/admin/support-tickets — queue admin', () => {
  it('401 - chưa đăng nhập / 403 - customer', async () => {
    expect((await get('/api/admin/support-tickets')).status).toBe(401)
    expect((await get('/api/admin/support-tickets', CUSTOMER)).status).toBe(403)
  })

  it('200 - staff được xem, trả tickets + counts', async () => {
    mockPrisma.supportTicket.findMany.mockResolvedValue([makeTicket()])
    mockPrisma.supportTicket.groupBy.mockResolvedValue([
      { status: 'OPEN', _count: { _all: 2 } },
      { status: 'CLOSED', _count: { _all: 1 } },
    ])
    const res = await get('/api/admin/support-tickets', STAFF)

    expect(res.status).toBe(200)
    expect(res.body.counts).toEqual({ open: 2, inProgress: 0, closed: 1 })
    expect(res.body.tickets).toHaveLength(1)
    expect(res.body.tickets[0].lastMessage).toMatchObject({ sender: 'CUSTOMER', content: 'Cho mình hỏi trả góp 0%?' })
    // lastMessage lấy từ messages take 1 (desc) — service đã đặt orderBy/take đúng
    const includeArg = mockPrisma.supportTicket.findMany.mock.calls[0][0]
    expect(includeArg.include.messages).toEqual({ orderBy: { createdAt: 'desc' }, take: 1 })
  })

  it('lọc status truyền thẳng vào where', async () => {
    await get('/api/admin/support-tickets?status=OPEN', STAFF)
    expect(mockPrisma.supportTicket.findMany.mock.calls[0][0].where).toEqual({ status: 'OPEN' })
  })
})

// ─── POST /:id/claim — nhận phiên ─────────────────────────────────────────────

describe('POST /api/admin/support-tickets/:id/claim', () => {
  it('401/403 - chỉ STAFF_ROLES', async () => {
    expect((await post(`/api/admin/support-tickets/${TICKET_ID}/claim`)).status).toBe(401)
    expect((await post(`/api/admin/support-tickets/${TICKET_ID}/claim`, {}, CUSTOMER)).status).toBe(403)
  })

  it('200 - OPEN → IN_PROGRESS, ghi claimedByName + system message', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Nhân viên B' })
    const res = await post(`/api/admin/support-tickets/${TICKET_ID}/claim`, {}, STAFF)

    expect(res.status).toBe(200)
    const updateArg = mockPrisma.supportTicket.update.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: TICKET_ID })
    expect(updateArg.data).toMatchObject({ status: 'IN_PROGRESS', claimedById: 'u-1', claimedByName: 'Nhân viên B' })
    expect(updateArg.data.messages.create).toMatchObject({ sender: 'SYSTEM', content: expect.stringContaining('Nhân viên B') })
    // Sau claim, service đọc lại ticket → findUnique gọi lần 2
    expect(mockPrisma.supportTicket.findUnique).toHaveBeenCalledTimes(2)
  })

  it('409 - staff khác đã nhận phiên', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(
      makeTicket({ status: 'IN_PROGRESS', claimedById: 'staff-2', claimedByName: 'Nhân viên 2' }),
    )
    const res = await post(`/api/admin/support-tickets/${TICKET_ID}/claim`, {}, STAFF)
    expect(res.status).toBe(409)
    expect(mockPrisma.supportTicket.update).not.toHaveBeenCalled()
  })

  it('200 idempotent - nhận lại phiên của chính mình không update lần 2', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(
      makeTicket({ status: 'IN_PROGRESS', claimedById: 'u-1', claimedByName: 'Nhân viên 1' }),
    )
    const res = await post(`/api/admin/support-tickets/${TICKET_ID}/claim`, {}, STAFF)
    expect(res.status).toBe(200)
    expect(mockPrisma.supportTicket.update).not.toHaveBeenCalled()
  })

  it('409 - phiên đã đóng', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ status: 'CLOSED', closedAt: new Date() }))
    const res = await post(`/api/admin/support-tickets/${TICKET_ID}/claim`, {}, STAFF)
    expect(res.status).toBe(409)
  })
})

// ─── POST /:id/messages — staff trả lời ───────────────────────────────────────

describe('POST /api/admin/support-tickets/:id/messages — staff trả lời', () => {
  it('200 - phiên OPEN: tự claim rồi gửi tin STAFF', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Nhân viên B' })
    const res = await post(`/api/admin/support-tickets/${TICKET_ID}/messages`, { content: 'Dạ em hỗ trợ ngay' }, STAFF)

    expect(res.status).toBe(200)
    // Lần 1: update claim; lần 2: không update nữa — nhưng có supportMessage.create STAFF
    expect(mockPrisma.supportTicket.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.supportMessage.create).toHaveBeenCalledWith({
      data: { ticketId: TICKET_ID, sender: 'STAFF', senderName: 'Nhân viên B', content: 'Dạ em hỗ trợ ngay' },
    })
  })

  it('200 - phiên IN_PROGRESS của mình: chỉ tạo tin, không claim lại', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Nhân viên B' })
    mockPrisma.supportTicket.findUnique.mockResolvedValue(
      makeTicket({ status: 'IN_PROGRESS', claimedById: 'u-1', claimedByName: 'Nhân viên B' }),
    )
    const res = await post(`/api/admin/support-tickets/${TICKET_ID}/messages`, { content: 'Dạ' }, STAFF)

    expect(res.status).toBe(200)
    expect(mockPrisma.supportTicket.update).not.toHaveBeenCalled()
  })

  it('409 - phiên đã đóng', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ status: 'CLOSED', closedAt: new Date() }))
    const res = await post(`/api/admin/support-tickets/${TICKET_ID}/messages`, { content: 'Dạ' }, STAFF)
    expect(res.status).toBe(409)
  })
})

// ─── POST /:id/close — đóng phiên ─────────────────────────────────────────────

describe('POST /api/admin/support-tickets/:id/close', () => {
  it('200 - đóng phiên: status CLOSED + closedAt + system message', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Nhân viên B' })
    const res = await post(`/api/admin/support-tickets/${TICKET_ID}/close`, {}, STAFF)

    expect(res.status).toBe(200)
    const updateArg = mockPrisma.supportTicket.update.mock.calls[0][0]
    expect(updateArg.data).toMatchObject({ status: 'CLOSED' })
    expect(updateArg.data.closedAt).toBeInstanceOf(Date)
    expect(updateArg.data.messages.create).toMatchObject({ sender: 'SYSTEM', content: expect.stringContaining('kết thúc') })
  })

  it('200 idempotent - đóng phiên đã đóng không tạo message lần 2', async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ status: 'CLOSED', closedAt: new Date() }))
    const res = await post(`/api/admin/support-tickets/${TICKET_ID}/close`, {}, STAFF)
    expect(res.status).toBe(200)
    expect(mockPrisma.supportTicket.update).not.toHaveBeenCalled()
  })
})
