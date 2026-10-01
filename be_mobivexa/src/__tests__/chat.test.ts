import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import type { Request, Response } from 'express'
import request from 'supertest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  chatSession: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  chatMessage: { create: vi.fn(), findMany: vi.fn() },
  order: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  product: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  review: { aggregate: vi.fn(), groupBy: vi.fn() },
  reviewPhoto: { count: vi.fn() },
  coupon: { findUnique: vi.fn() },
  couponUsage: { findFirst: vi.fn() },
  cart: { findUnique: vi.fn() },
  productVariant: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}))

const { mockGoogleGenAI, mockType } = vi.hoisted(() => ({
  mockGoogleGenAI: vi.fn(),
  // Thay enum Type của SDK — mock phải cung cấp đủ để TOOL_REGISTRY build được lúc load module
  mockType: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER' },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))
vi.mock('@google/genai', () => ({ GoogleGenAI: mockGoogleGenAI, Type: mockType }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'
import { normalizeSearchQuery } from '../services/chat/normalizer'
import { buildSystemPrompt } from '../services/chat/prompt'
import { CHAT_LIMITS } from '../middlewares/rate_limit.middleware'
import { CHAT_HISTORY_LIMIT } from '../types/chat.type'
import { sendMessage } from '../controllers/chat.controller'
import { streamChatReply } from '../services/chat.service'

const app = createApp()

const USER1_TOKEN = `Bearer ${signAccessToken({ userId: 'user-1', email: 'user1@test.com', role: 'CUSTOMER' })}`
const USER2_TOKEN = `Bearer ${signAccessToken({ userId: 'user-2', email: 'user2@test.com', role: 'CUSTOMER' })}`
const BAD_TOKEN   = 'Bearer not-a-jwt'

// ─── Gemini mock: mỗi "round" là 1 lượt gọi model, chunk text/functionCalls ───

type GeminiRound = {
  text?: string
  functionCalls?: Array<{ name: string; args?: Record<string, unknown> }>
}

function mockGemini(rounds: GeminiRound[]) {
  let call = 0
  const generateContentStream = vi.fn(() => {
    // Lặp round cuối khi model vẫn đòi gọi tool quá số round khai báo
    const round = rounds[Math.min(call, rounds.length - 1)]
    call++
    return Promise.resolve(
      (async function* () {
        // Shape giống SDK thật: text accessor + candidates[0].content.parts, trong đó
        // functionCall part mang thoughtSignature — service phải giữ nguyên khi đẩy
        // lại vào contents vòng sau (Gemini 3 trả 400 nếu thiếu).
        const parts: Array<Record<string, unknown>> = []
        if (round.text) parts.push({ text: round.text })
        for (const c of round.functionCalls ?? []) {
          parts.push({ functionCall: { name: c.name, args: c.args ?? {} }, thoughtSignature: 'sig-test' })
        }
        if (parts.length) yield { text: round.text, candidates: [{ content: { parts } }] }
      })(),
    )
  })
  // mockImplementation với `function` (KHÔNG arrow): service gọi `new GoogleGenAI()`,
  // arrow không dùng được làm constructor (vitest cảnh báo + throw lúc chạy).
  // LƯU Ý: closure generateContentStream + counter lượt gọi là DÙNG CHUNG cho mọi
  // client tạo ra sau MỘT lần gọi mockGemini() — 2 request trong cùng 1 test phải
  // gọi mockGemini() 2 lần, nếu không request 2 ăn tiếp lượt round của request 1.
  mockGoogleGenAI.mockImplementation(function () {
    return { models: { generateContentStream } }
  })
  return generateContentStream
}

// ─── Helpers đọc tham số Gemini mock (dùng chung các test) ────────────────────

// generateContentStream của request thứ `requestIndex` (mỗi request = 1 client mới)
function geminiStreamOf(requestIndex: number) {
  return mockGoogleGenAI.mock.results[requestIndex].value.models.generateContentStream
}

// Tham số của lượt gọi model thứ `callIndex` (0-based) trong request `requestIndex`
function modelCall(requestIndex: number, callIndex: number) {
  return geminiStreamOf(requestIndex).mock.calls[callIndex][0]
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────

interface SseEvent {
  event: string
  data: Record<string, unknown> | null
}

function parseSse(text: string): SseEvent[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      let event = ''
      let data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7)
        if (line.startsWith('data: ')) data = line.slice(6)
      }
      return { event, data: data ? (JSON.parse(data) as Record<string, unknown>) : null }
    })
    .filter((e) => e.event !== '')
}

const post = (body: Record<string, unknown>, token?: string) => {
  const req = request(app).post('/api/chat')
  if (token) req.set('Authorization', token)
  return req.send(body)
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    name: 'iPhone 15',
    slug: 'iphone-15',
    brand: { name: 'Apple' },
    category: { name: 'Điện thoại', slug: 'dien-thoai' },
    variants: [{ salePrice: 19000000, originalPrice: 21000000, imageUrl: null, stock: 5 }],
    images: [{ url: 'https://img.mobivexa.test/iphone15.jpg' }],
    ...overrides,
  }
}

function orderFixture(userId: string) {
  return {
    id: `order-${userId}`,
    orderCode: 'ORD-20260928-AAAAAA',
    userId,
    status: 'SHIPPING',
    paymentMethod: 'BANK_TRANSFER',
    paymentStatus: 'PAID',
    total: 19000000,
    createdAt: new Date('2026-09-28T08:00:00Z'),
    items: [{ productName: 'iPhone 15', quantity: 1, color: 'Đen', storage: '128GB', ram: '6GB' }],
    sepayTxs: [{ status: 'MATCHED', transferAmount: 19000000, transactionDate: new Date() }],
  }
}

const couponRow = () => ({
  id: 'coupon-1',
  code: 'MOBIVEXA10',
  type: 'PERCENT',
  value: 10,
  maxDiscount: null,
  minOrderValue: 0,
  usageLimit: null,
  usedCount: 0,
  isActive: true,
  startsAt: new Date('2026-01-01'),
  endsAt: new Date('2027-01-01'),
})

let messageCounter = 0

beforeEach(() => {
  vi.clearAllMocks()
  messageCounter = 0
  process.env.CHATBOT_ENABLED = 'true'
  process.env.GEMINI_API_KEY = 'test-key'

  mockPrisma.chatSession.findUnique.mockResolvedValue(null)
  mockPrisma.chatSession.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'session-new',
    userId: (data.userId as string) ?? null,
    title: data.title,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
  mockPrisma.chatSession.update.mockResolvedValue({})
  mockPrisma.chatMessage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `msg-${++messageCounter}`,
    ...data,
    createdAt: new Date(),
  }))
  mockPrisma.chatMessage.findMany.mockResolvedValue([])
})

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Unit — chuẩn hoá query tìm kiếm (catalog C2)
// ═══════════════════════════════════════════════════════════════════════════════

describe('normalizeSearchQuery — chuẩn hoá query trước khi gọi search_products', () => {
  it('bỏ dấu tiếng Việt, hạ chữ thường', () => {
    expect(normalizeSearchQuery('Chi ei may choi gam duoi 8 trieu')).toBe('chi ei may choi gam duoi 8000000')
    expect(normalizeSearchQuery('Tìm giúp mình điện thoại dưới 5 triệu')).toBe('tim giup minh dien thoai duoi 5000000')
  })

  it('map viết tắt "ip" → "iphone" (C2)', () => {
    expect(normalizeSearchQuery('ip 15 con hang kh')).toBe('iphone 15 con hang kh')
    expect(normalizeSearchQuery('ip15')).toBe('iphone 15')
  })

  it('map viết tắt "ss" → "samsung", "xmi" → "xiaomi" (mục D.2)', () => {
    expect(normalizeSearchQuery('ss galaxy s23')).toBe('samsung galaxy s23')
    expect(normalizeSearchQuery('xmi 14')).toBe('xiaomi 14')
  })

  it('"ss" đứng một mình giữa câu vẫn được map (dính vào từ khác thì giữ nguyên)', () => {
    expect(normalizeSearchQuery('boss ss')).toBe('boss samsung')
    // phủ định thật: "ss" dính vào từ ("bosss") là từ thường, KHÔNG tách ra map
    expect(normalizeSearchQuery('bosss')).toBe('bosss')
  })

  it('nở "5tr" dính đơn vị thành 5000000', () => {
    expect(normalizeSearchQuery('may pin trau duoi 5tr')).toBe('may pin trau duoi 5000000')
    expect(normalizeSearchQuery('gan 7,5tr mua gi')).toBe('gan 7500000 mua gi')
    expect(normalizeSearchQuery('pin tot 500k')).toBe('pin tot 500000')
  })

  it('typo nhẹ "xow" → "vao" (catalog C2)', () => {
    expect(normalizeSearchQuery('xiaomi khong xow pin tot kh')).toBe('xiaomi khong vao pin tot kh')
  })

  it('tách thương hiệu viết đầy đủ dính số, nhưng GIỮ nguyên model thật như s23/a54', () => {
    expect(normalizeSearchQuery('iphone15')).toBe('iphone 15')
    expect(normalizeSearchQuery('iphone 15pro max')).toBe('iphone 15 pro max')
    expect(normalizeSearchQuery('galaxy s23 fe')).toBe('galaxy s23 fe')
    expect(normalizeSearchQuery('oppo a54')).toBe('oppo a54')
  })

  it('giữ nguyên từ thường, chuỗi rỗng → rỗng', () => {
    expect(normalizeSearchQuery('iPhone 15 Pro Max')).toBe('iphone 15 pro max')
    expect(normalizeSearchQuery('')).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Unit — system prompt theo role + hạn mức
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildSystemPrompt — theo quy tắc mục D', () => {
  it('nhúng khối CHÍNH SÁCH tĩnh + vai xưng "em"', () => {
    const prompt = buildSystemPrompt(undefined)
    expect(prompt).toContain('CHÍNH SÁCH CỬA HÀNG')
    expect(prompt).toContain('Bảo hành')
    expect(prompt).toContain('Xưng "em"')
    expect(prompt).toContain('KHÔNG BAO GIỜ bịa model')
    expect(prompt).toContain('tối đa 2 lượt')
    expect(prompt).toContain('Kết nối nhân viên')
  })

  it('guest nhấn "chưa đăng nhập", user nhấn "đã đăng nhập"', () => {
    expect(buildSystemPrompt(undefined)).toContain('CHƯA đăng nhập')
    const userPrompt = buildSystemPrompt({ userId: 'user-1', email: 'u@t.c', role: 'CUSTOMER' })
    expect(userPrompt).toContain('ĐÃ đăng nhập')
    expect(userPrompt).toContain('u@t.c')
  })
})

describe('CHAT_LIMITS — hạn mức theo plan mục 2.5', () => {
  it('user 10/phút + 50/ngày, guest 5/phút + 20/ngày', () => {
    expect(CHAT_LIMITS).toEqual({ userPerMinute: 10, guestPerMinute: 5, userPerDay: 50, guestPerDay: 20 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Integration — luồng SSE
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/chat — luồng SSE cơ bản', () => {
  it('trả đủ event session → delta → done, Content-Type text/event-stream, lưu 2 tin nhắn', async () => {
    mockGemini([{ text: 'Chào anh/chị, em có thể giúp gì ạ?' }])

    const res = await post({ message: 'xin chào' })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')

    const events = parseSse(res.text)
    expect(events.map((e) => e.event)).toEqual(['session', 'delta', 'done'])

    expect(events[0].data).toEqual({ sessionId: 'session-new' })
    expect(events[1].data).toEqual({ text: 'Chào anh/chị, em có thể giúp gì ạ?' })
    expect(events[2].data).toMatchObject({ messageId: 'msg-2', sessionId: 'session-new' })

    // user msg + assistant msg đều được lưu; session guest có userId null
    expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.chatSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: null, title: 'xin chào' }) }),
    )
  })

  it('nội dung assistant lưu = toàn bộ text đã stream, kèm toolName nếu có tool', async () => {
    mockGemini([
      { functionCalls: [{ name: 'get_reviews', args: { slug: 'iphone-15' } }] },
      { text: 'Sản phẩm được đánh giá 4.5/5 sao.' },
    ])
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'p-1' })
    mockPrisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { id: 10 } })
    mockPrisma.review.groupBy.mockResolvedValue([])
    mockPrisma.reviewPhoto.count.mockResolvedValue(0)

    const res = await post({ message: 'may nay danh gia sao' })
    expect(res.status).toBe(200)

    const assistantCreate = mockPrisma.chatMessage.create.mock.calls[1][0]
    expect(assistantCreate.data).toMatchObject({
      sessionId: 'session-new',
      role: 'ASSISTANT',
      content: 'Sản phẩm được đánh giá 4.5/5 sao.',
      toolName: 'get_reviews',
    })
  })

  it('nếu sessionId gửi lên là của user khác → tạo session mới, không đọc context người khác', async () => {
    mockGemini([{ text: 'Chào anh/chị!' }])
    mockPrisma.chatSession.findUnique.mockResolvedValue({
      id: 'session-other',
      userId: 'user-1', // session thuộc user-1
      title: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await post({ sessionId: 'session-other', message: 'cho em hoi' }, USER2_TOKEN)

    expect(res.status).toBe(200)
    // findUnique thấy session của user-1 nhưng user-2 gửi → phải tạo session mới
    expect(mockPrisma.chatSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-2' }) }),
    )
    const events = parseSse(res.text)
    expect(events[0].data).toEqual({ sessionId: 'session-new' })
  })
})

describe('POST /api/chat — ownership & claim session (vá hổng chat.service.ts)', () => {
  it('[BẢO MẸT] guest gửi sessionId của session CÓ CHỦ → tạo session mới, KHÔNG đọc được lịch sử của chủ session', async () => {
    mockGemini([{ text: 'Chào anh/chị!' }])
    mockPrisma.chatSession.findUnique.mockResolvedValue({
      id: 'session-owned',
      userId: 'user-1', // session này có chủ
      title: 'cũ',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await post({ sessionId: 'session-owned', message: 'cho em hoi' }) // không token

    expect(res.status).toBe(200)
    // Guest → session mới với userId null, tuyệt đối không phải session-owned
    expect(mockPrisma.chatSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: null }) }),
    )

    // Session mới thì chưa có lịch sử để đọc — không một dòng nào của session-owned bị lộ
    expect(mockPrisma.chatMessage.findMany).not.toHaveBeenCalled()

    // Guest không được claim session có chủ (nhánh CLAIM chỉ dành cho session userId null)
    expect(mockPrisma.chatSession.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'session-owned' } }),
    )
  })

  it('nhánh CLAIM: user đăng nhập gửi sessionId của session guest (userId null) → update gắn userId, dùng lại session', async () => {
    mockGemini([{ text: 'Chào anh/chị, em tiếp tục tư vấn được nhé!' }])
    mockPrisma.chatSession.findUnique.mockResolvedValue({
      id: 'session-guest',
      userId: null, // session guest chưa có chủ
      title: 'hỏi giá',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await post({ sessionId: 'session-guest', message: 'mình đăng nhập rồi nè' }, USER1_TOKEN)

    expect(res.status).toBe(200)
    // CLAIM: gắn session vào tài khoản — update được gọi với data.userId của người hiện tại
    expect(mockPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: 'session-guest' },
      data: { userId: 'user-1' },
    })
    // Dùng lại session cũ — KHÔNG tạo session mới, lịch sử vẫn đọc từ session guest
    expect(mockPrisma.chatSession.create).not.toHaveBeenCalled()
    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionId: 'session-guest' } }),
    )
    const events = parseSse(res.text)
    expect(events[0].data).toEqual({ sessionId: 'session-guest' })
  })
})

describe('POST /api/chat — tool search_products + event products', () => {
  it('bắn event products đúng shape ngay sau khi tool trả kết quả, query đã chuẩn hoá', async () => {
    mockGemini([
      { functionCalls: [{ name: 'search_products', args: { search: 'ip 15' } }] },
      { text: 'Dạ, iPhone 15 đang có giá 19.000.000đ ạ.' },
    ])
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'p-1' }])
    mockPrisma.product.findMany.mockResolvedValue([productRow()])
    mockPrisma.product.count.mockResolvedValue(1)

    const res = await post({ message: 'ip 15 gia bao nhieu' })

    const events = parseSse(res.text)
    // Thứ tự: session → products (card render FE) → delta (chữ) → done
    expect(events.map((e) => e.event)).toEqual(['session', 'products', 'delta', 'done'])
    expect(events[1].data).toEqual({
      items: [
        {
          id: 'p-1',
          slug: 'iphone-15',
          name: 'iPhone 15',
          brand: 'Apple',
          salePrice: 19000000,
          originalPrice: 21000000,
          imageUrl: 'https://img.mobivexa.test/iphone15.jpg',
        },
      ],
    })

    // C2: query truyền vào FTS đã map "ip" → "iphone" (toTsQuery tạo 'iphone & 15:*')
    const rawSql = mockPrisma.$queryRaw.mock.calls[0]
    expect(rawSql[1]).toBe('iphone & 15:*')
  })

  it.each(['', '   '])('maxPrice trắng (%j) không thành "tối đa 0đ" — vẫn trúng guard empty_query', async (blank) => {
    mockGemini([
      { functionCalls: [{ name: 'search_products', args: { maxPrice: blank } }] },
      { text: 'Anh/chị cho em xin ngân sách nhé.' },
    ])

    await post({ message: 'tim may' })

    const funcRes = modelCall(0, 1).contents[2].parts[0].functionResponse
    expect(funcRes.response.result).toBe('empty_query')
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled()
  })

  it('maxPrice rỗng đi kèm từ khoá → tìm theo từ khoá, KHÔNG gắn bộ lọc giá', async () => {
    mockGemini([
      { functionCalls: [{ name: 'search_products', args: { search: 'iphone 15', maxPrice: '' } }] },
      { text: 'Dạ có iPhone 15 ạ.' },
    ])
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'p-1' }])
    mockPrisma.product.findMany.mockResolvedValue([productRow()])
    mockPrisma.product.count.mockResolvedValue(1)

    await post({ message: 'iphone 15' })

    const { where } = mockPrisma.product.findMany.mock.calls[0][0]
    expect(where).not.toHaveProperty('variants')
  })
})

describe('POST /api/chat — tool search_blog', () => {
  it('giữ nguyên dấu tiếng Việt khi tìm blog — FTS "simple" khớp token đúng dấu, query bỏ dấu là hụt hết', async () => {
    mockGemini([
      { functionCalls: [{ name: 'search_blog', args: { query: 'chọn máy chơi game' } }] },
      { text: 'Em chưa thấy bài viết phù hợp ạ.' },
    ])
    mockPrisma.$queryRaw.mockResolvedValue([])

    await post({ message: 'bai viet chon may choi game' })

    // toTsQuery nối các từ bằng & và khớp từng token: "chon" ≠ "chọn" nên query đã bỏ dấu
    // không bao giờ khớp tiêu đề tiếng Việt có dấu
    expect(mockPrisma.$queryRaw.mock.calls[0]).toContain('chọn & máy & chơi & game:*')
  })
})

describe('POST /api/chat — tool khai báo cho model theo quyền (plan mục 2.2)', () => {
  const declaredTools = (): string[] =>
    modelCall(0, 0).config.tools[0].functionDeclarations.map((d: { name: string }) => d.name).sort()

  it('guest chỉ nhận 4 tool công khai — tool tra đơn/coupon không được khai báo cho model', async () => {
    mockGemini([{ text: 'Chào anh/chị!' }])

    await post({ message: 'xin chào' })

    expect(declaredTools()).toEqual(['get_product_detail', 'get_reviews', 'search_blog', 'search_products'])
  })

  it('user đăng nhập nhận đủ 6 tool, gồm get_order_status và check_coupon', async () => {
    mockGemini([{ text: 'Chào anh/chị!' }])

    await post({ message: 'xin chào' }, USER1_TOKEN)

    expect(declaredTools()).toEqual([
      'check_coupon',
      'get_order_status',
      'get_product_detail',
      'get_reviews',
      'search_blog',
      'search_products',
    ])
  })
})

describe('POST /api/chat — phân quyền tool theo trạng thái đăng nhập', () => {
  it('guest gọi get_order_status → KHÔNG thực thi, trả ghi chú mời đăng nhập cho LLM', async () => {
    mockGemini([
      { functionCalls: [{ name: 'get_order_status', args: {} }] },
      { text: 'Anh/chị đăng nhập giúp em để tra đơn nhé.' },
    ])

    const res = await post({ message: 'don cua toi sao roi' }) // không token

    expect(res.status).toBe(200)
    expect(mockPrisma.order.findFirst).not.toHaveBeenCalled()
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled()

    // functionResponse đẩy về model vòng sau chứa ghi chú mời đăng nhập
    const secondCall = modelCall(0, 1)
    const responsePart = secondCall.contents[secondCall.contents.length - 1].parts[0].functionResponse
    expect(responsePart.name).toBe('get_order_status')
    expect(String(responsePart.response.note)).toMatch(/đăng nhập/)

    // stream vẫn kết thúc đúng hợp đồng (không crash)
    const events = parseSse(res.text)
    expect(events[events.length - 1]?.event).toBe('done')
  })

  it('token hỏng → coi như guest (không 401), vẫn bị chặn tool đơn hàng', async () => {
    mockGemini([
      { functionCalls: [{ name: 'get_order_status', args: {} }] },
      { text: 'Anh/chị đăng nhập lại giúp em nhé.' },
    ])

    const res = await post({ message: 'tra don giup em' }, BAD_TOKEN)

    expect(res.status).toBe(200)
    expect(mockPrisma.order.findFirst).not.toHaveBeenCalled()
  })

  it('2 user khác nhau không thấy đơn của nhau — get_order_status luôn scope theo userId từ server', async () => {
    // DB "trả đúng đơn của user đang hỏi": where.userId do server inject
    mockPrisma.order.findFirst.mockImplementation(({ where }: { where: { userId: string } }) =>
      Promise.resolve(where.userId === 'user-1' ? orderFixture('user-1') : null),
    )

    const rounds: GeminiRound[] = [
      { functionCalls: [{ name: 'get_order_status', args: { orderId: 'ORD-20260928-AAAAAA' } }] },
      { text: 'Đơn của anh/chị đang giao ạ.' },
    ]

    mockGemini(rounds) // client cho request 1
    const res1 = await post({ message: 'don cua toi' }, USER1_TOKEN)

    mockGemini(rounds) // client RIÊNG cho request 2
    const res2 = await post({ message: 'don cua toi' }, USER2_TOKEN)

    // Lần 1: user-1 — truy vấn bám userId của chính user-1, thấy đơn
    expect(mockPrisma.order.findFirst.mock.calls[0][0].where.userId).toBe('user-1')
    const funcRes1 = modelCall(0, 1).contents[2].parts[0].functionResponse
    expect(funcRes1.response.result).toBe('success')
    expect((funcRes1.response.order as Record<string, unknown>).orderCode).toBe('ORD-20260928-AAAAAA')

    // Lần 2: user-2 — bám userId của user-2, DB không có đơn → not_found, không lộ đơn user-1
    expect(mockPrisma.order.findFirst.mock.calls[1][0].where.userId).toBe('user-2')
    const funcRes2 = modelCall(1, 1).contents[2].parts[0].functionResponse
    expect(funcRes2.response.result).toBe('not_found')

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
  })

  it('user check_coupon → previewCoupon chạy theo userId của server', async () => {
    mockGemini([
      { functionCalls: [{ name: 'check_coupon', args: { code: 'mobivexa10' } }] },
      { text: 'Mã giảm 10% cho đơn của anh/chị ạ.' },
    ])
    mockPrisma.coupon.findUnique.mockResolvedValue(couponRow())
    mockPrisma.couponUsage.findFirst.mockResolvedValue(null)
    mockPrisma.cart.findUnique.mockResolvedValue({ userId: 'user-1', items: [{ variantId: 'v-1', quantity: 1 }] })
    mockPrisma.productVariant.findMany.mockResolvedValue([
      { id: 'v-1', salePrice: 1000000, isActive: true, product: { isActive: true, name: 'Điện thoại test' } },
    ])

    const res = await post({ message: 'ma MOBIVEXA10 dung duoc kh' }, USER1_TOKEN)

    expect(res.status).toBe(200)
    expect(mockPrisma.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'MOBIVEXA10' } })
    const funcRes = modelCall(0, 1).contents[2].parts[0].functionResponse
    expect(funcRes.response.valid).toBe(true)
    expect(funcRes.response.discount).toBe(100000) // 10% của 1.000.000
  })
})

describe('POST /api/chat — cap 3 vòng tool-call', () => {
  it('tối đa 3 lần thực thi tool, lượt gọi model cuối không có tools, kết thúc bằng fallback', async () => {
    const alwaysCallTool: GeminiRound[] = [
      { functionCalls: [{ name: 'search_products', args: { search: 'ip 15' } }] },
    ]
    const generateContentStream = mockGemini(alwaysCallTool) // lặp round cuối vô hạn
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'p-1' }])
    mockPrisma.product.findMany.mockResolvedValue([productRow()])
    mockPrisma.product.count.mockResolvedValue(1)

    const res = await post({ message: 'cho em may duoi 8 trieu' })

    // 3 vòng tool (calls 0-2) + 1 lượt ép trả chữ (call 3) = MAX_TOOL_ROUNDS + 1
    expect(generateContentStream).toHaveBeenCalledTimes(4)
    const callParams = (i: number) =>
      generateContentStream.mock.calls[i] as unknown as [{ config: { tools?: unknown }; contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> }]
    expect(callParams(0)[0].config.tools).toBeDefined()
    expect(callParams(3)[0].config.tools).toBeUndefined()

    // Replay functionCall về cho model vòng sau phải giữ thoughtSignature
    // (Gemini 3 trả 400 "missing thought_signature" nếu dựng lại part thiếu nó)
    const modelParts = callParams(1)[0].contents.filter((c) => c.role === 'model').flatMap((c) => c.parts)
    expect(modelParts.some((p) => p.functionCall && p.thoughtSignature === 'sig-test')).toBe(true)

    // Model lì lợn đòi tool tới cùng → stream vẫn kết thúc có trật tự bằng fallback
    const events = parseSse(res.text)
    expect(events[events.length - 1]?.event).toBe('done')
    const fallback = events.find((e) => e.event === 'delta')
    expect(String(fallback?.data?.text)).toMatch(/Kết nối nhân viên/)

    // search_products chỉ được thực thi 3 lần dù model đòi 4 lần
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3b. Integration — chịu lỗi: fallback model, event error, lịch sử, tool hỏng
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/chat — fallback model chain (chỉ 429/503 mới rơi model kế)', () => {
  const ORIGINAL_MODEL_ENV = {
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_MODEL_FALLBACKS: process.env.GEMINI_MODEL_FALLBACKS,
  }

  afterEach(() => {
    // Trả env về nguyên trạng để test khác không ăn phải chain bị ghi đè
    if (ORIGINAL_MODEL_ENV.GEMINI_MODEL === undefined) delete process.env.GEMINI_MODEL
    else process.env.GEMINI_MODEL = ORIGINAL_MODEL_ENV.GEMINI_MODEL
    if (ORIGINAL_MODEL_ENV.GEMINI_MODEL_FALLBACKS === undefined) delete process.env.GEMINI_MODEL_FALLBACKS
    else process.env.GEMINI_MODEL_FALLBACKS = ORIGINAL_MODEL_ENV.GEMINI_MODEL_FALLBACKS
  })

  it('503 ở model chính → tự gọi lại với model KẾ trong chain, chữ round sau vẫn stream đủ', async () => {
    // Ghim chain tường minh để assertion không phụ thuộc env máy chạy test
    process.env.GEMINI_MODEL = 'gemini-test-primary'
    process.env.GEMINI_MODEL_FALLBACKS = 'gemini-test-fallback-1, gemini-test-fallback-2'

    const generateContentStream = mockGemini([{ text: 'Dạ em trả lời từ model dự phòng ạ.' }])
    // Lượt 1 rớt 503 (high demand) — shape lỗi SDK thật: error mang .status = 503.
    // Chấp nhận chờ backoff thật 1200ms giữa 2 model (cố định, deterministic).
    generateContentStream.mockRejectedValueOnce(Object.assign(new Error('Model overloaded'), { status: 503 }))

    const res = await post({ message: 'cho em hoi mot chut' })

    expect(res.status).toBe(200)
    expect(generateContentStream).toHaveBeenCalledTimes(2)

    // 2 lượt gọi model KHÁC nhau: lượt 2 là model kế trong chain, không lặp model cũ
    const models = generateContentStream.mock.calls.map((c) => (c as unknown as [{ model: string }])[0].model)
    expect(models[0]).toBe('gemini-test-primary')
    expect(models[1]).toBe('gemini-test-fallback-1')

    // Stream khách nhận vẫn trọn vẹn: session → delta (chữ từ model dự phòng) → done
    const events = parseSse(res.text)
    expect(events.map((e) => e.event)).toEqual(['session', 'delta', 'done'])
    expect(events[1].data).toEqual({ text: 'Dạ em trả lời từ model dự phòng ạ.' })
  })

  it('lỗi thường (status 400, không phải 429/503) → ném NGAY sau 1 lượt gọi, không thử model kế', async () => {
    process.env.GEMINI_MODEL = 'gemini-test-primary'
    process.env.GEMINI_MODEL_FALLBACKS = 'gemini-test-fallback-1'

    const generateContentStream = mockGemini([{ text: 'không bao giờ tới được đây' }])
    // Lỗi cấu hình (model không tồn tại) mang status 400 — phải ném ra ngay, không fallback
    generateContentStream.mockRejectedValueOnce(Object.assign(new Error('Model does not exist'), { status: 400 }))

    const res = await post({ message: 'xin chào' })

    expect(res.status).toBe(200)
    // Đúng 1 lượt gọi duy nhất — lỗi không phải 429/503 KHÔNG được rơi xuống model kế
    expect(generateContentStream).toHaveBeenCalledTimes(1)
    // Lỗi chuyển thành event: error trên stream (headers đã bắn trước khi gọi model)
    const events = parseSse(res.text)
    expect(events[events.length - 1]?.event).toBe('error')
  })
})

describe('POST /api/chat — hợp đồng event: error khi Gemini chết sau khi headers đã gửi', () => {
  it('Gemini ném lỗi (API key sai) → 200 + text/event-stream, event error có code, stream kết thúc có trật tự, ý định của khách vẫn được lưu', async () => {
    const generateContentStream = mockGemini([{ text: 'chào bạn' }])
    generateContentStream.mockRejectedValueOnce(new Error('API key not valid'))

    const res = await post({ message: 'xin chào' })

    // Headers đã bắn trước khi gọi model → không thể đổi status nữa, phải là 200 SSE
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')

    // Trật tự kết thúc: session bắn được → error → HẾT (không treo, không delta rác)
    const events = parseSse(res.text)
    expect(events.map((e) => e.event)).toEqual(['session', 'error'])
    // Error thường (không phải AppError) → code 500, message generic (không lộ lỗi gốc)
    expect(events[1].data).toMatchObject({
      code: 500,
      message: 'Có lỗi khi xử lý tin nhắn, vui lòng thử lại',
    })

    // Tin nhắn của khách đã lưu TRƯỚC khi gọi model — model chết thì ý định vẫn còn
    expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.chatMessage.create.mock.calls[0][0].data).toMatchObject({ role: 'USER', content: 'xin chào' })
    expect(generateContentStream).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/chat — thứ tự lịch sử hội thoại gửi cho model', () => {
  it('findMany trả desc (mới nhất trước) → contents phải là user cũ → model cũ → user mới (sau reverse)', async () => {
    mockGemini([{ text: 'Dạ dựa trên trao đổi trước, máy này hợp anh/chị ạ.' }])
    // Session đã có từ trước (guest, chưa có chủ) — session vừa tạo thì không đọc lịch sử
    mockPrisma.chatSession.findUnique.mockResolvedValue({
      id: 'session-hist',
      userId: null,
      title: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    // DB orderBy createdAt desc → tin MỚI nhất đứng đầu: [ASSISTANT(mới), USER(cũ)]
    mockPrisma.chatMessage.findMany.mockResolvedValue([
      {
        id: 'msg-hist-2',
        sessionId: 'session-hist',
        role: 'ASSISTANT',
        content: 'trả lời trước đó của em',
        createdAt: new Date('2026-09-28T09:00:00Z'),
      },
      {
        id: 'msg-hist-1',
        sessionId: 'session-hist',
        role: 'USER',
        content: 'câu hỏi trước đó của anh/chị',
        createdAt: new Date('2026-09-28T08:00:00Z'),
      },
    ])

    const res = await post({ sessionId: 'session-hist', message: 'vậy máy này giá bao nhiêu' })
    expect(res.status).toBe(200)

    // loadHistory đọc đúng hợp đồng: desc + take CHAT_HISTORY_LIMIT
    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: CHAT_HISTORY_LIMIT }),
    )

    // Sau reverse: user cũ → model cũ, rồi mới chèn câu hỏi hiện tại vào cuối
    const contents = modelCall(0, 0).contents as Array<{ role: string; parts: Array<{ text?: string }> }>
    expect(contents.map((c) => c.role)).toEqual(['user', 'model', 'user'])
    expect(contents[0].parts[0].text).toBe('câu hỏi trước đó của anh/chị')
    expect(contents[1].parts[0].text).toBe('trả lời trước đó của em')
    expect(contents[2].parts[0].text).toBe('vậy máy này giá bao nhiêu')
  })
})

describe('POST /api/chat — lỗi tool & dữ liệu bẩn không được làm đứt stream', () => {
  it('get_product_detail với slug không tồn tại → functionResponse result:error, stream vẫn kết thúc bằng done', async () => {
    mockGemini([
      { functionCalls: [{ name: 'get_product_detail', args: { slug: 'san-pham-khong-ton-tai' } }] },
      { text: 'Sản phẩm này hiện không còn bán ạ.' },
    ])
    // getProductBySlug: findUnique null → AppError(404) 'Sản phẩm không tồn tại'
    mockPrisma.product.findUnique.mockResolvedValue(null)

    const res = await post({ message: 'cho em xem may san pham khong ton tai' })

    expect(res.status).toBe(200)
    // AppError bị executeTool bắt thành ghi chú cho LLM — KHÔNG ném ra ngoài stream
    const funcRes = modelCall(0, 1).contents[2].parts[0].functionResponse
    expect(funcRes.name).toBe('get_product_detail')
    expect(funcRes.response.result).toBe('error')
    expect(String(funcRes.response.note)).toMatch(/không tồn tại/)

    // Model vòng 2 nhận ghi chú và trả chữ bình thường → stream trọn vẹn
    const events = parseSse(res.text)
    expect(events.map((e) => e.event)).toEqual(['session', 'delta', 'done'])
    expect(events[1].data).toEqual({ text: 'Sản phẩm này hiện không còn bán ạ.' })
  })

  it('variant salePrice=0 (dữ liệu crawler hỏng) bị lọc — card và payload cho LLM dùng giá variant thật 8.500.000', async () => {
    mockGemini([
      { functionCalls: [{ name: 'search_products', args: { search: 'iphone 15' } }] },
      { text: 'iPhone 15 hiện có giá 8.500.000đ ạ.' },
    ])
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'p-1' }])
    mockPrisma.product.count.mockResolvedValue(1)
    mockPrisma.product.findMany.mockResolvedValue([
      productRow({
        variants: [
          // Variant rác giá 0 phải bị bỏ qua — card báo "0đ" là lỗi hiển thị nặng
          { salePrice: 0, originalPrice: 21000000, imageUrl: null, stock: 3 },
          { salePrice: 8500000, originalPrice: 9000000, imageUrl: 'https://img.mobivexa.test/iphone15-re.jpg', stock: 2 },
        ],
      }),
    ])

    const res = await post({ message: 'iphone 15 gia bao nhieu' })
    expect(res.status).toBe(200)

    // Card FE (event products) không được báo 0đ
    const events = parseSse(res.text)
    const products = events.find((e) => e.event === 'products')?.data as { items: Array<Record<string, unknown>> }
    expect(products.items).toHaveLength(1)
    expect(products.items[0].salePrice).toBe(8500000)
    expect(products.items[0].originalPrice).toBe(9000000)
    expect(products.items[0].imageUrl).toBe('https://img.mobivexa.test/iphone15-re.jpg')

    // Payload cho LLM (functionResponse) cũng giá thật, không phải 0
    const funcRes = modelCall(0, 1).contents[2].parts[0].functionResponse
    expect((funcRes.response.products as Array<{ priceFrom: number }>)[0].priceFrom).toBe(8500000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Client ngắt kết nối giữa chừng — phần đã stream vẫn phải nằm trong history
// ═══════════════════════════════════════════════════════════════════════════════

interface FakeSseResponse extends EventEmitter {
  writableEnded: boolean
  chunks: string[]
  status(code: number): this
  set(headers: Record<string, string>): this
  flushHeaders(): void
  write(chunk: string): boolean
  end(): void
}

// Response giả (không có socket thật) để test điều khiển được ĐÚNG lúc client "đóng tab":
// emit('close') khi writableEnded còn false là thứ Node phát khi kết nối đứt giữa stream.
// `finished` resolve khi controller gọi res.end() — asyncHandler không trả promise để await.
function fakeSseResponse() {
  const res = new EventEmitter() as FakeSseResponse
  res.writableEnded = false
  res.chunks = []
  res.status = () => res
  res.set = () => res
  res.flushHeaders = () => {}
  res.write = (chunk) => {
    res.chunks.push(chunk)
    return true
  }
  const finished = new Promise<void>((resolve) => {
    res.end = () => {
      res.writableEnded = true
      resolve()
    }
  })
  return { res, finished }
}

async function collect<T>(events: AsyncGenerator<T>): Promise<T[]> {
  const all: T[] = []
  for await (const event of events) all.push(event)
  return all
}

describe('POST /api/chat — client ngắt kết nối giữa chừng', () => {
  it('ngắt lúc server đang chạy tool → câu trả lời dở vẫn được lưu, không gọi Gemini thêm, không ghi gì ra socket đã đóng', async () => {
    const generateContentStream = mockGemini([
      { text: 'Để em tra giúp ạ. ', functionCalls: [{ name: 'search_products', args: { search: 'iphone 15' } }] },
      { text: 'Dạ iPhone 15 giá 19 triệu ạ.' },
    ])
    const { res, finished } = fakeSseResponse()
    // Client đóng tab đúng lúc server đang tra DB cho tool
    mockPrisma.$queryRaw.mockImplementationOnce(async () => {
      res.emit('close')
      return [{ id: 'p-1' }]
    })
    mockPrisma.product.findMany.mockResolvedValue([productRow()])
    mockPrisma.product.count.mockResolvedValue(1)
    const next = vi.fn()

    sendMessage(
      { body: { message: 'iphone 15 giá bao nhiêu' } } as unknown as Request,
      res as unknown as Response,
      next,
    )
    await finished

    // Tin của khách + chữ đã stream trước khi gọi tool đều nằm trong history
    expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.chatMessage.create.mock.calls[1][0].data).toMatchObject({
      role: 'ASSISTANT',
      content: 'Để em tra giúp ạ. ',
      toolName: 'search_products',
    })
    // Client đã đi: không tốn thêm lượt Gemini, không ghi event nào ra socket đã đóng
    expect(generateContentStream).toHaveBeenCalledTimes(1)
    expect(res.chunks.join('')).not.toContain('event: products')
    expect(next).not.toHaveBeenCalled()
  })

  it('ngắt trước khi model kịp nói chữ nào → vẫn lưu tin của khách, KHÔNG lưu câu fallback mà họ chưa từng thấy', async () => {
    const generateContentStream = mockGemini([{ text: 'không bao giờ tới' }])
    const clientGone = new AbortController()
    clientGone.abort()

    const events = await collect(streamChatReply({ message: 'xin chào', signal: clientGone.signal }))

    expect(generateContentStream).not.toHaveBeenCalled()
    expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.chatMessage.create.mock.calls[0][0].data).toMatchObject({ role: 'USER', content: 'xin chào' })
    expect(events.map((e) => e.type)).toEqual(['session'])
  })

  it('ngắt giữa lúc model đang nói → lưu đúng phần chữ đã stream, bỏ phần tới sau khi ngắt', async () => {
    const clientGone = new AbortController()
    const chunk = (text: string) => ({ text, candidates: [{ content: { parts: [{ text }] } }] })
    mockGoogleGenAI.mockImplementation(function () {
      return {
        models: {
          generateContentStream: vi.fn(() =>
            Promise.resolve(
              (async function* () {
                yield chunk('Dạ em tư vấn')
                clientGone.abort() // client đóng tab ngay sau chunk đầu
                yield chunk(' tiếp tục')
              })(),
            ),
          ),
        },
      }
    })

    const events = await collect(streamChatReply({ message: 'tư vấn giúp em', signal: clientGone.signal }))

    expect(events.filter((e) => e.type === 'delta')).toEqual([{ type: 'delta', text: 'Dạ em tư vấn' }])
    expect(mockPrisma.chatMessage.create.mock.calls[1][0].data).toMatchObject({
      role: 'ASSISTANT',
      content: 'Dạ em tư vấn',
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Validation + feature flag + rate limit
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/chat — validation đầu vào (trước khi mở stream)', () => {
  it('message rỗng/chỉ khoảng trắng → 400 JSON, không gọi Gemini', async () => {
    const generateContentStream = mockGemini([{ text: 'x' }])

    const res1 = await post({ message: '' })
    const res2 = await post({ message: '   ' })
    const res3 = await post({})

    expect(res1.status).toBe(400)
    expect(res2.status).toBe(400)
    expect(res3.status).toBe(400)
    expect(res1.body.message).toMatch(/trống/)
    expect(generateContentStream).not.toHaveBeenCalled()
  })

  it('message vượt 2000 ký tự → 400', async () => {
    mockGemini([{ text: 'x' }])
    const res = await post({ message: 'a'.repeat(2001) })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/2000/)
  })

  it('sessionId vượt 64 ký tự → 400, không gọi Gemini', async () => {
    const generateContentStream = mockGemini([{ text: 'x' }])

    const res = await post({ sessionId: 'a'.repeat(65), message: 'xin chào' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/sessionId/)
    expect(generateContentStream).not.toHaveBeenCalled()
  })

  it('CHATBOT_ENABLED=false → 503, không gọi Gemini', async () => {
    const generateContentStream = mockGemini([{ text: 'x' }])
    process.env.CHATBOT_ENABLED = 'false'

    const res = await post({ message: 'xin chào' })

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/tạm tắt/)
    expect(generateContentStream).not.toHaveBeenCalled()
  })
})

describe('chatLimiter — 429 khi vượt hạn mức', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV
  const ORIGINAL_CHATBOT_ENABLED = process.env.CHATBOT_ENABLED

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV
    process.env.CHATBOT_ENABLED = ORIGINAL_CHATBOT_ENABLED
  })

  // skipInTest đọc NODE_ENV theo từng request — bật "production" tạm thời trong
  // test này để limiter chạy thật. Thứ tự middleware là validate → limiter nên
  // request phải body HỢP LỆ mới chạm được limiter: dùng CHATBOT_ENABLED=false để
  // request hợp lệ trả 503 ngay ở controller (rẻ, không gọi Gemini) mà vẫn đếm
  // quota (limiter đứng trước controller).
  it('guest quá 5 tin/phút → 429; user quá 10 tin/phút → 429; body 400 không đốt quota', async () => {
    process.env.NODE_ENV = 'production'
    process.env.CHATBOT_ENABLED = 'false'

    // Body rỗng dính 400 ở validate — TRƯỚC limiter, guest không mất lượt nào
    for (let i = 0; i < 3; i++) {
      const res = await post({})
      expect(res.status).toBe(400)
    }

    for (let i = 0; i < 5; i++) {
      const res = await post({ message: 'xin chào' }) // hợp lệ → đếm quota, 503 ở controller
      expect(res.status).toBe(503)
    }
    const guest6th = await post({ message: 'xin chào' })
    expect(guest6th.status).toBe(429)
    expect(guest6th.body.message).toMatch(/quá nhanh/)

    for (let i = 0; i < 10; i++) {
      const res = await post({ message: 'xin chào' }, USER1_TOKEN)
      expect(res.status).toBe(503)
    }
    const user11th = await post({ message: 'xin chào' }, USER1_TOKEN)
    expect(user11th.status).toBe(429)

    // guest đã 429 không ăn vốn của user — user vừa 429 ở lượt 11, guest vẫn vậy
    const guestStill = await post({ message: 'xin chào' })
    expect(guestStill.status).toBe(429)
  })
})
