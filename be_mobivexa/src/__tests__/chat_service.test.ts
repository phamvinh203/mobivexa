import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  chatSession: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  chatMessage: { findMany: vi.fn(), createMany: vi.fn() },
}))

const mockGenAI = vi.hoisted(() => ({
  models: { generateContent: vi.fn() },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))
vi.mock('../config/gemini', () => ({
  genAI: mockGenAI,
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_TIMEOUT_MS: 30_000,
}))
vi.mock('../services/chatbot_tools', () => ({
  CHAT_TOOL_DECLARATIONS: [{ name: 'searchProducts' }],
  executeTool: vi.fn(),
}))

import { sendMessage, getMessages } from '../services/chat.service'
import { executeTool } from '../services/chatbot_tools'
import { AppError } from '../helpers/app_error'

const SESSION = { id: 'sess-1', userId: null, title: 'câu hỏi cũ' }

const textReply = (text: string) => ({ text, functionCalls: [] })

const toolReply = (name: string, args: Record<string, unknown>) => ({
  text: '',
  functionCalls: [{ name, args }],
})

const CARD = {
  id: 'prod-1',
  name: 'iPhone 15',
  slug: 'iphone-15',
  salePrice: '9990000',
  originalPrice: '11990000',
  imageUrl: null,
}

// ─── sendMessage ──────────────────────────────────────────────────────────────

describe('chat.service: sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.chatSession.findUnique.mockResolvedValue(SESSION)
    mockPrisma.chatMessage.findMany.mockResolvedValue([])
    mockPrisma.chatMessage.createMany.mockResolvedValue({ count: 2 })
    mockPrisma.chatSession.update.mockResolvedValue(SESSION)
  })

  it('tạo phiên mới khi không truyền sessionId', async () => {
    mockPrisma.chatSession.create.mockResolvedValue({ id: 'sess-new', userId: null, title: null })
    mockGenAI.models.generateContent.mockResolvedValue(textReply('Chào bạn!'))

    const result = await sendMessage({ message: 'xin chào' })

    expect(mockPrisma.chatSession.create).toHaveBeenCalled()
    expect(result.sessionId).toBe('sess-new')
    expect(result.reply).toBe('Chào bạn!')
  })

  it('lưu cả tin của khách lẫn tin của bot', async () => {
    mockGenAI.models.generateContent.mockResolvedValue(textReply('Chào bạn!'))

    await sendMessage({ sessionId: 'sess-1', message: 'xin chào' })

    const rows = mockPrisma.chatMessage.createMany.mock.calls[0][0].data
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ role: 'USER', content: 'xin chào' })
    expect(rows[1]).toMatchObject({ role: 'MODEL', content: 'Chào bạn!' })
  })

  it('chạy tool rồi gửi kết quả lại cho model', async () => {
    vi.mocked(executeTool).mockResolvedValue({ data: { count: 1 }, products: [CARD] })
    mockGenAI.models.generateContent
      .mockResolvedValueOnce(toolReply('searchProducts', { keyword: 'iphone' }))
      .mockResolvedValueOnce(textReply('Bên mình có iPhone 15 giá 9.990.000đ'))

    const result = await sendMessage({ sessionId: 'sess-1', message: 'có iphone không' })

    expect(executeTool).toHaveBeenCalledWith('searchProducts', { keyword: 'iphone' })
    expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(2)
    expect(result.reply).toContain('iPhone 15')
    expect(result.products).toEqual([CARD])
  })

  it('dừng ở vòng thứ ba khi model gọi tool liên tục', async () => {
    vi.mocked(executeTool).mockResolvedValue({ data: { count: 0 }, products: [] })
    mockGenAI.models.generateContent.mockResolvedValue(toolReply('searchProducts', {}))

    const result = await sendMessage({ sessionId: 'sess-1', message: 'tìm giúp tôi' })

    expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(3)
    expect(result.reply).not.toBe('')
  })

  it('lưu vết tool đã gọi vào toolCalls', async () => {
    vi.mocked(executeTool).mockResolvedValue({ data: { count: 1 }, products: [CARD] })
    mockGenAI.models.generateContent
      .mockResolvedValueOnce(toolReply('searchProducts', { keyword: 'iphone' }))
      .mockResolvedValueOnce(textReply('Có nhé'))

    await sendMessage({ sessionId: 'sess-1', message: 'có iphone không' })

    const botRow = mockPrisma.chatMessage.createMany.mock.calls[0][0].data[1]
    expect(botRow.toolCalls).toEqual([
      { name: 'searchProducts', args: { keyword: 'iphone' }, resultCount: 1 },
    ])
  })

  it('chỉ gửi 10 tin gần nhất làm ngữ cảnh', async () => {
    mockGenAI.models.generateContent.mockResolvedValue(textReply('ok'))

    await sendMessage({ sessionId: 'sess-1', message: 'tiếp đi' })

    expect(mockPrisma.chatMessage.findMany.mock.calls[0][0].take).toBe(10)
  })

  it('đặt title từ tin nhắn đầu tiên của phiên chưa có title', async () => {
    mockPrisma.chatSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: null, title: null })
    mockGenAI.models.generateContent.mockResolvedValue(textReply('ok'))

    await sendMessage({ sessionId: 'sess-1', message: 'tư vấn giúp tôi điện thoại' })

    expect(mockPrisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'tư vấn giúp tôi điện thoại' }) }),
    )
  })

  it('gán phiên ẩn danh cho user vừa đăng nhập', async () => {
    mockGenAI.models.generateContent.mockResolvedValue(textReply('ok'))

    await sendMessage({ sessionId: 'sess-1', message: 'xin chào' }, 'user-1')

    expect(mockPrisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) }),
    )
  })

  it('404 khi phiên thuộc về người khác', async () => {
    mockPrisma.chatSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'user-2', title: null })

    await expect(sendMessage({ sessionId: 'sess-1', message: 'hi' }, 'user-1')).rejects.toThrow(AppError)
    await expect(sendMessage({ sessionId: 'sess-1', message: 'hi' }, 'user-1')).rejects.toMatchObject({ status: 404 })
  })

  it('404 khi phiên không tồn tại', async () => {
    mockPrisma.chatSession.findUnique.mockResolvedValue(null)

    await expect(sendMessage({ sessionId: 'sess-x', message: 'hi' })).rejects.toMatchObject({ status: 404 })
  })

  it('503 khi Gemini lỗi, không lộ chi tiết lỗi gốc', async () => {
    mockGenAI.models.generateContent.mockRejectedValue(new Error('API key quota exceeded for project 12345'))

    const err = await sendMessage({ sessionId: 'sess-1', message: 'hi' }).catch((e) => e)

    expect(err).toBeInstanceOf(AppError)
    expect(err.status).toBe(503)
    expect(err.message).toBe('Trợ lý đang bận, vui lòng thử lại sau ít phút')
    expect(err.message).not.toContain('quota')
  })
})

// ─── getMessages ──────────────────────────────────────────────────────────────

describe('chat.service: getMessages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('trả lịch sử theo thứ tự thời gian tăng dần', async () => {
    mockPrisma.chatSession.findUnique.mockResolvedValue(SESSION)
    mockPrisma.chatMessage.findMany.mockResolvedValue([
      { id: 'm1', role: 'USER', content: 'hỏi', createdAt: new Date('2026-08-23T10:00:00Z') },
      { id: 'm2', role: 'MODEL', content: 'đáp', createdAt: new Date('2026-08-23T10:00:05Z') },
    ])

    const result = await getMessages('sess-1')

    expect(result.messages.map((m) => m.role)).toEqual(['USER', 'MODEL'])
    expect(mockPrisma.chatMessage.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' })
  })

  it('404 khi phiên thuộc về người khác', async () => {
    mockPrisma.chatSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'user-2', title: null })

    await expect(getMessages('sess-1', 'user-1')).rejects.toMatchObject({ status: 404 })
  })
})
