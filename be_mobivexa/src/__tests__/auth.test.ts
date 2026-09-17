import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import crypto from 'crypto'

// ─── Hoisted mocks (chạy trước tất cả import) ────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst:  vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    updateMany: vi.fn(),
  },
  refreshToken: {
    create:      vi.fn(),
    findUnique:  vi.fn(),
    update:      vi.fn(),
    updateMany:  vi.fn(),
    deleteMany:  vi.fn(),
  },
  $transaction: vi.fn().mockImplementation((ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : (ops as () => Promise<unknown>)()
  ),
}))

const mockHashPassword    = vi.hoisted(() => vi.fn().mockResolvedValue('$2b$hashed'))
const mockVerifyPassword  = vi.hoisted(() => vi.fn())
const mockSendResetEmail  = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../config/db',     () => ({ default: mockPrisma }))
vi.mock('../utils/password', () => ({ hashPassword: mockHashPassword, verifyPassword: mockVerifyPassword }))
vi.mock('../utils/mailer',   () => ({ sendResetPasswordEmail: mockSendResetEmail }))

import { createApp } from '../app'
import { signRefreshToken } from '../utils/token_manager'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const app = createApp()

const BASE_USER = {
  id: 'user-1',
  email: 'test@example.com',
  fullName: 'Test User',
  phone: null,
  passwordHash: '$2b$hashed',
  avatarUrl: null,
  avatarPublicId: null,
  role: 'CUSTOMER' as const,
  isActive: true,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  resetPasswordToken: null,
  resetPasswordExpires: null,
  resetPasswordAttempts: 0,
}

// hashResetToken thật trong auth.service.ts — dùng để dựng fixture khớp otp test.
const hashOtp = (otp: string) => crypto.createHash('sha256').update(otp).digest('hex')
const VALID_OTP = '123456'
const notExpired = () => new Date(Date.now() + 10 * 60 * 1000)
const expired = () => new Date(Date.now() - 60 * 1000)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - đăng ký thành công', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-1', email: 'test@example.com', fullName: 'Test User', role: 'CUSTOMER', createdAt: new Date(),
    })

    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      fullName: 'Test User',
      password: 'password123',
    })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ message: 'Đăng ký thành công' })
    expect(res.body.user.email).toBe('test@example.com')
  })

  it('400 - email không hợp lệ', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      fullName: 'Test User',
      password: 'password123',
    })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/email/i)
  })

  it('400 - họ tên quá ngắn (< 2 ký tự)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      fullName: 'A',
      password: 'password123',
    })
    expect(res.status).toBe(400)
  })

  it('400 - mật khẩu quá ngắn (< 8 ký tự)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      fullName: 'Test User',
      password: '123',
    })
    expect(res.status).toBe(400)
  })

  it('409 - email đã tồn tại', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)

    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      fullName: 'Test User',
      password: 'password123',
    })
    expect(res.status).toBe(409)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - đăng nhập thành công', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    mockVerifyPassword.mockResolvedValue(true)
    mockPrisma.refreshToken.create.mockResolvedValue({})

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123',
    })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
    expect(res.body.user.email).toBe('test@example.com')
    expect(res.body.user).not.toHaveProperty('passwordHash')
  })

  it('400 - thiếu email', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'password123' })
    expect(res.status).toBe(400)
  })

  it('401 - email không tồn tại', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await request(app).post('/api/auth/login').send({
      email: 'noone@example.com',
      password: 'password123',
    })
    expect(res.status).toBe(401)
  })

  it('401 - sai mật khẩu', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    mockVerifyPassword.mockResolvedValue(false)

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'wrongpass',
    })
    expect(res.status).toBe(401)
  })

  it('403 - tài khoản bị khóa', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...BASE_USER, isActive: false })

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/auth/refresh', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - cấp token mới thành công', async () => {
    const token = signRefreshToken({ userId: 'user-1', email: 'test@example.com', role: 'CUSTOMER' })

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      token,
      userId: 'user-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 86400_000),
    })
    mockPrisma.refreshToken.update.mockResolvedValue({})
    mockPrisma.refreshToken.create.mockResolvedValue({})

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: token })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
  })

  it('400 - thiếu refreshToken', async () => {
    const res = await request(app).post('/api/auth/refresh').send({})
    expect(res.status).toBe(400)
  })

  it('401 - refreshToken đã bị thu hồi', async () => {
    const token = signRefreshToken({ userId: 'user-1', email: 'test@example.com', role: 'CUSTOMER' })

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1', token, userId: 'user-1',
      isRevoked: true,
      expiresAt: new Date(Date.now() + 86400_000),
    })

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: token })
    expect(res.status).toBe(401)
  })

  it('401 - refreshToken không hợp lệ (chuỗi ngẫu nhiên)', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'invalid.token.here' })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - luôn trả về 200 dù email không tồn tại (không tiết lộ thông tin)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'noone@example.com' })
    expect(res.status).toBe(200)
    expect(mockSendResetEmail).not.toHaveBeenCalled()
  })

  it('200 - email tồn tại, gửi OTP', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    mockPrisma.user.update.mockResolvedValue({})

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' })
    expect(res.status).toBe(200)
    expect(mockSendResetEmail).toHaveBeenCalledOnce()
  })

  it('200 - sinh OTP bằng CSPRNG (crypto.randomInt), không dùng Math.random', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    mockPrisma.user.update.mockResolvedValue({})
    const randomIntSpy = vi.spyOn(crypto, 'randomInt')
    const mathRandomSpy = vi.spyOn(Math, 'random')

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' })

    expect(res.status).toBe(200)
    // Khoảng [100000, 1000000) đúng bằng dải OTP 6 chữ số (100000-999999).
    expect(randomIntSpy).toHaveBeenCalledWith(100000, 1000000)
    expect(mathRandomSpy).not.toHaveBeenCalled()

    const otpSent = mockSendResetEmail.mock.calls[0][1]
    expect(otpSent).toMatch(/^\d{6}$/)

    randomIntSpy.mockRestore()
    mathRandomSpy.mockRestore()
  })

  it('400 - email không hợp lệ', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'bad' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - đặt lại mật khẩu thành công', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...BASE_USER,
      resetPasswordToken: hashOtp(VALID_OTP),
      resetPasswordExpires: notExpired(),
      resetPasswordAttempts: 0,
    })
    mockPrisma.user.update.mockResolvedValue({})
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 }) // còn lượt thử, giữ chỗ thành công
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 })

    const res = await request(app).post('/api/auth/reset-password').send({
      otp: VALID_OTP,
      newPassword: 'newpassword123',
    })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/thành công/)
  })

  it('400 - OTP không phải 6 chữ số', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      otp: '12345',
      newPassword: 'newpassword123',
    })
    expect(res.status).toBe(400)
  })

  it('400 - mật khẩu mới quá ngắn', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      otp: VALID_OTP,
      newPassword: 'abc',
    })
    expect(res.status).toBe(400)
  })

  it('400 - token không tồn tại (không tiết lộ, trả lỗi giống hệt OTP sai)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null)

    const res = await request(app).post('/api/auth/reset-password').send({
      otp: VALID_OTP,
      newPassword: 'newpassword123',
    })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/không hợp lệ hoặc đã hết hạn/)
  })

  it('400 - OTP đã hết hạn', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null)

    const res = await request(app).post('/api/auth/reset-password').send({
      otp: VALID_OTP,
      newPassword: 'newpassword123',
    })
    expect(res.status).toBe(400)
  })

  it('400 - OTP sai thì không đổi mật khẩu', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })

    const res = await request(app).post('/api/auth/reset-password').send({
      otp: '999999', // sai so với hashOtp(VALID_OTP) đã set ở trên
      newPassword: 'newpassword123',
    })

    expect(res.status).toBe(400)
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
    // Chưa đổi mật khẩu — không có lệnh update nào ghi passwordHash
    expect(mockPrisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ passwordHash: expect.anything() }) }),
    )
  })

  it('400 - hết lượt thử (đã khóa từ trước) thì vô hiệu OTP luôn, dù gửi đúng OTP', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...BASE_USER,
      resetPasswordToken: hashOtp(VALID_OTP),
      resetPasswordExpires: notExpired(),
      resetPasswordAttempts: 5, // đã chạm ngưỡng MAX_RESET_ATTEMPTS
    })
    // updateMany có điều kiện resetPasswordAttempts < 5 KHÔNG khớp row nào → count 0
    // (mô phỏng đúng cách Postgres tự loại request khi WHERE không còn thỏa mãn)
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.user.update.mockResolvedValue({})

    const res = await request(app).post('/api/auth/reset-password').send({
      otp: VALID_OTP, // đúng OTP nhưng vẫn phải bị chặn vì đã hết lượt
      newPassword: 'newpassword123',
    })

    expect(res.status).toBe(400)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { resetPasswordToken: null, resetPasswordExpires: null, resetPasswordAttempts: 0 },
      }),
    )
  })
})

describe('POST /api/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - đăng xuất thành công', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })

    const res = await request(app).post('/api/auth/logout').send({ refreshToken: 'any-token' })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/đăng xuất/i)
  })

  it('400 - thiếu refreshToken', async () => {
    const res = await request(app).post('/api/auth/logout').send({})
    expect(res.status).toBe(400)
  })
})
