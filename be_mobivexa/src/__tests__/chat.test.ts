import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockChatService = vi.hoisted(() => ({
  createSession: vi.fn(),
  sendMessage: vi.fn(),
  getMessages: vi.fn(),
}))

vi.mock('../services/chat.service', () => mockChatService)
vi.mock('../config/db', () => ({ default: {} }))

import express from 'express'
import request from 'supertest'

import { optionalAuthenticate } from '../middlewares/auth.middleware'
import { signAccessToken } from '../utils/token_manager'
import { createApp } from '../app'
import { AppError } from '../helpers/app_error'

function probeApp() {
  const app = express()
  app.get('/probe', optionalAuthenticate, (req, res) => {
    res.json({ userId: req.user?.userId ?? null })
  })
  return app
}

describe('optionalAuthenticate', () => {
  it('gắn user khi token hợp lệ', async () => {
    const token = signAccessToken({ userId: 'user-1', email: 'a@test.com', role: 'CUSTOMER' })

    const res = await request(probeApp()).get('/probe').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.userId).toBe('user-1')
  })

  it('cho qua khi không có header', async () => {
    const res = await request(probeApp()).get('/probe')

    expect(res.status).toBe(200)
    expect(res.body.userId).toBeNull()
  })

  it('cho qua khi token hỏng, không trả 401', async () => {
    const res = await request(probeApp()).get('/probe').set('Authorization', 'Bearer rac-ruoi')

    expect(res.status).toBe(200)
    expect(res.body.userId).toBeNull()
  })
})

const app = createApp()
const USER_TOKEN = `Bearer ${signAccessToken({ userId: 'user-1', email: 'user@test.com', role: 'CUSTOMER' })}`

const REPLY = { sessionId: 'sess-1', reply: 'Chào bạn!', products: [] }

// ─── POST /api/chat/messages ──────────────────────────────────────────────────

describe('POST /api/chat/messages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - khách vãng lai chat được, không cần token', async () => {
    mockChatService.sendMessage.mockResolvedValue(REPLY)

    const res = await request(app).post('/api/chat/messages').send({ message: 'xin chào' })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('Chào bạn!')
    expect(mockChatService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'xin chào' }),
      undefined,
    )
  })

  it('200 - user đăng nhập thì userId được truyền xuống service', async () => {
    mockChatService.sendMessage.mockResolvedValue(REPLY)

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', USER_TOKEN)
      .send({ sessionId: 'sess-1', message: 'xin chào' })

    expect(mockChatService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1' }),
      'user-1',
    )
  })

  it('400 - tin nhắn rỗng', async () => {
    const res = await request(app).post('/api/chat/messages').send({ message: '   ' })

    expect(res.status).toBe(400)
    expect(mockChatService.sendMessage).not.toHaveBeenCalled()
  })

  it('400 - tin nhắn vượt 2000 ký tự', async () => {
    const res = await request(app).post('/api/chat/messages').send({ message: 'a'.repeat(2001) })

    expect(res.status).toBe(400)
    expect(mockChatService.sendMessage).not.toHaveBeenCalled()
  })

  it('400 - sessionId sai kiểu', async () => {
    const res = await request(app).post('/api/chat/messages').send({ sessionId: 123, message: 'hi' })

    expect(res.status).toBe(400)
  })

  it('cắt khoảng trắng thừa trước khi xuống service', async () => {
    mockChatService.sendMessage.mockResolvedValue(REPLY)

    await request(app).post('/api/chat/messages').send({ message: '  xin chào  ' })

    expect(mockChatService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'xin chào' }),
      undefined,
    )
  })

  it('503 - Gemini lỗi, không lộ chi tiết lỗi gốc', async () => {
    mockChatService.sendMessage.mockRejectedValue(
      new AppError(503, 'Trợ lý đang bận, vui lòng thử lại sau ít phút'),
    )

    const res = await request(app).post('/api/chat/messages').send({ message: 'hi' })

    expect(res.status).toBe(503)
    expect(res.body.message).toBe('Trợ lý đang bận, vui lòng thử lại sau ít phút')
  })

  it('404 - phiên của người khác', async () => {
    mockChatService.sendMessage.mockRejectedValue(new AppError(404, 'Không tìm thấy phiên trò chuyện'))

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', USER_TOKEN)
      .send({ sessionId: 'sess-cua-nguoi-khac', message: 'hi' })

    expect(res.status).toBe(404)
  })
})

// ─── POST /api/chat/sessions ──────────────────────────────────────────────────

describe('POST /api/chat/sessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - tạo phiên mới', async () => {
    mockChatService.createSession.mockResolvedValue({ sessionId: 'sess-new' })

    const res = await request(app).post('/api/chat/sessions')

    expect(res.status).toBe(201)
    expect(res.body.sessionId).toBe('sess-new')
  })
})

// ─── GET /api/chat/sessions/:id/messages ──────────────────────────────────────

describe('GET /api/chat/sessions/:id/messages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả lịch sử phiên', async () => {
    mockChatService.getMessages.mockResolvedValue({
      sessionId: 'sess-1',
      messages: [{ id: 'm1', role: 'USER', content: 'hỏi', createdAt: new Date() }],
    })

    const res = await request(app).get('/api/chat/sessions/sess-1/messages')

    expect(res.status).toBe(200)
    expect(res.body.messages).toHaveLength(1)
  })

  it('404 - phiên của người khác', async () => {
    mockChatService.getMessages.mockRejectedValue(new AppError(404, 'Không tìm thấy phiên trò chuyện'))

    const res = await request(app)
      .get('/api/chat/sessions/sess-cua-nguoi-khac/messages')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(404)
  })
})
