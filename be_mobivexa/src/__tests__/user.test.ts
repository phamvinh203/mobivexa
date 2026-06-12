import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst:  vi.fn(),
    update:     vi.fn(),
  },
  address: {
    findMany:   vi.fn(),
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    updateMany: vi.fn(),
    delete:     vi.fn(),
  },
  $transaction: vi.fn(),
}))

const mockVerifyPassword = vi.hoisted(() => vi.fn())
const mockHashPassword   = vi.hoisted(() => vi.fn().mockResolvedValue('$2b$newhash'))

vi.mock('../config/db',      () => ({ default: mockPrisma }))
vi.mock('../utils/password', () => ({ hashPassword: mockHashPassword, verifyPassword: mockVerifyPassword }))
vi.mock('../config/cloudinary', () => ({
  uploadBuffer: vi.fn().mockResolvedValue({ secure_url: 'https://cdn/avatar.jpg', public_id: 'user_1' }),
}))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const app = createApp()

const TEST_PAYLOAD = { userId: 'user-1', email: 'test@example.com', role: 'CUSTOMER' as const }
const AUTH_HEADER  = `Bearer ${signAccessToken(TEST_PAYLOAD)}`

const BASE_USER = {
  id: 'user-1',
  email: 'test@example.com',
  fullName: 'Test User',
  phone: null,
  avatarUrl: null,
  avatarPublicId: null,
  role: 'CUSTOMER',
  isActive: true,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// Dùng trong changePassword test — service cần passwordHash để verify
const BASE_USER_WITH_HASH = { ...BASE_USER, passwordHash: '$2b$hashed' }

const BASE_ADDRESS = {
  id: 'addr-1',
  userId: 'user-1',
  fullName: 'Nguyen Van A',
  phone: '0912345678',
  province: 'Hà Nội',
  district: 'Cầu Giấy',
  ward: 'Dịch Vọng',
  streetDetail: '123 Xuân Thủy',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ─── Profile ──────────────────────────────────────────────────────────────────

describe('GET /api/users/me', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về thông tin profile', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)

    const res = await request(app).get('/api/users/me').set('Authorization', AUTH_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('test@example.com')
    expect(res.body.user).not.toHaveProperty('passwordHash')
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/users/me')
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/users/me', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - cập nhật fullName thành công', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null) // phone không trùng
    mockPrisma.user.update.mockResolvedValue({ ...BASE_USER, fullName: 'New Name' })

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', AUTH_HEADER)
      .send({ fullName: 'New Name' })

    expect(res.status).toBe(200)
    expect(res.body.user.fullName).toBe('New Name')
  })

  it('200 - cập nhật số điện thoại hợp lệ', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.update.mockResolvedValue({ ...BASE_USER, phone: '0912345678' })

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', AUTH_HEADER)
      .send({ phone: '0912345678' })

    expect(res.status).toBe(200)
  })

  it('400 - số điện thoại không hợp lệ', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', AUTH_HEADER)
      .send({ phone: '12345' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/điện thoại/i)
  })

  it('400 - họ tên quá ngắn', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', AUTH_HEADER)
      .send({ fullName: 'A' })

    expect(res.status).toBe(400)
  })

  it('400 - không cung cấp field nào', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', AUTH_HEADER)
      .send({})

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app).put('/api/users/me').send({ fullName: 'Test' })
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/users/me/password', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - đổi mật khẩu thành công', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER_WITH_HASH)
    mockVerifyPassword.mockResolvedValue(true)
    mockPrisma.user.update.mockResolvedValue({})

    const res = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', AUTH_HEADER)
      .send({ currentPassword: 'oldpass123', newPassword: 'newpass123' })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/thành công/)
  })

  it('400 - thiếu mật khẩu hiện tại', async () => {
    const res = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', AUTH_HEADER)
      .send({ newPassword: 'newpass123' })

    expect(res.status).toBe(400)
  })

  it('400 - mật khẩu mới quá ngắn', async () => {
    const res = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', AUTH_HEADER)
      .send({ currentPassword: 'oldpass123', newPassword: 'abc' })

    expect(res.status).toBe(400)
  })

  it('400 - mật khẩu mới trùng mật khẩu hiện tại', async () => {
    const res = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', AUTH_HEADER)
      .send({ currentPassword: 'samepass123', newPassword: 'samepass123' })

    expect(res.status).toBe(400)
  })

  it('400 - mật khẩu hiện tại không đúng', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER_WITH_HASH)
    mockVerifyPassword.mockResolvedValue(false)

    const res = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', AUTH_HEADER)
      .send({ currentPassword: 'wrongpass', newPassword: 'newpass123' })

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app)
      .put('/api/users/me/password')
      .send({ currentPassword: 'old', newPassword: 'newpass123' })

    expect(res.status).toBe(401)
  })
})

// ─── Addresses ────────────────────────────────────────────────────────────────

describe('GET /api/users/me/addresses', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả về danh sách địa chỉ', async () => {
    mockPrisma.address.findMany.mockResolvedValue([BASE_ADDRESS])

    const res = await request(app)
      .get('/api/users/me/addresses')
      .set('Authorization', AUTH_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.addresses).toHaveLength(1)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/users/me/addresses')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/users/me/addresses', () => {
  beforeEach(() => vi.clearAllMocks())

  const VALID_ADDRESS = {
    fullName: 'Nguyen Van A',
    phone: '0912345678',
    province: 'Hà Nội',
    district: 'Cầu Giấy',
    ward: 'Dịch Vọng',
    streetDetail: '123 Xuân Thủy',
  }

  it('201 - tạo địa chỉ thành công', async () => {
    mockPrisma.address.findFirst.mockResolvedValue(BASE_ADDRESS) // đã có địa chỉ → không auto-default
    mockPrisma.address.create.mockResolvedValue({ ...BASE_ADDRESS, id: 'addr-2' })

    const res = await request(app)
      .post('/api/users/me/addresses')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_ADDRESS)

    expect(res.status).toBe(201)
    expect(res.body.message).toMatch(/thành công/)
  })

  it('400 - thiếu streetDetail', async () => {
    const res = await request(app)
      .post('/api/users/me/addresses')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_ADDRESS, streetDetail: undefined })

    expect(res.status).toBe(400)
  })

  it('400 - số điện thoại không hợp lệ', async () => {
    const res = await request(app)
      .post('/api/users/me/addresses')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_ADDRESS, phone: '12345' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/điện thoại/i)
  })

  it('400 - tên người nhận quá ngắn', async () => {
    const res = await request(app)
      .post('/api/users/me/addresses')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_ADDRESS, fullName: 'A' })

    expect(res.status).toBe(400)
  })

  it('401 - không có token', async () => {
    const res = await request(app).post('/api/users/me/addresses').send(VALID_ADDRESS)
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/users/me/addresses/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - cập nhật địa chỉ thành công', async () => {
    mockPrisma.address.findUnique.mockResolvedValue(BASE_ADDRESS)
    mockPrisma.address.update.mockResolvedValue({ ...BASE_ADDRESS, streetDetail: '456 Láng Hạ' })

    const res = await request(app)
      .put('/api/users/me/addresses/addr-1')
      .set('Authorization', AUTH_HEADER)
      .send({
        fullName: 'Nguyen Van A',
        phone: '0912345678',
        province: 'Hà Nội',
        district: 'Cầu Giấy',
        ward: 'Dịch Vọng',
        streetDetail: '456 Láng Hạ',
      })

    expect(res.status).toBe(200)
  })

  it('401 - không có token', async () => {
    const res = await request(app).put('/api/users/me/addresses/addr-1')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/users/me/addresses/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - xóa địa chỉ thành công (không phải mặc định)', async () => {
    mockPrisma.address.findUnique.mockResolvedValue(BASE_ADDRESS)
    mockPrisma.address.delete.mockResolvedValue({})

    const res = await request(app)
      .delete('/api/users/me/addresses/addr-1')
      .set('Authorization', AUTH_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/thành công/)
  })

  it('404 - địa chỉ không thuộc về user', async () => {
    mockPrisma.address.findUnique.mockResolvedValue({ ...BASE_ADDRESS, userId: 'other-user' })

    const res = await request(app)
      .delete('/api/users/me/addresses/addr-1')
      .set('Authorization', AUTH_HEADER)

    expect(res.status).toBe(404)
  })

  it('401 - không có token', async () => {
    const res = await request(app).delete('/api/users/me/addresses/addr-1')
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/users/me/addresses/:id/default', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - đặt địa chỉ mặc định thành công', async () => {
    mockPrisma.address.findUnique.mockResolvedValue(BASE_ADDRESS)
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<void>) =>
      fn({
        ...mockPrisma,
        address: {
          ...mockPrisma.address,
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({ ...BASE_ADDRESS, isDefault: true }),
        },
      })
    )

    const res = await request(app)
      .patch('/api/users/me/addresses/addr-1/default')
      .set('Authorization', AUTH_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/mặc định/)
  })

  it('401 - không có token', async () => {
    const res = await request(app).patch('/api/users/me/addresses/addr-1/default')
    expect(res.status).toBe(401)
  })
})
