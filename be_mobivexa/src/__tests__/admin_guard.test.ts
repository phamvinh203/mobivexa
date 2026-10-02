import { vi, describe, it, expect } from 'vitest'
import request from 'supertest'

// Cổng `/api/admin` (index.route.ts) là chốt DUY NHẤT bắt đăng nhập + STAFF/ADMIN cho
// mọi router admin. Test này ghim cổng đó cho từng mount, kể cả mount không có test
// riêng (banners). Không có token / là CUSTOMER thì request bị chặn TRƯỚC khi chạm DB,
// nên Prisma chỉ cần là object rỗng — gọi vào là test nổ, đúng ý.
vi.mock('../config/db', () => ({ default: {} }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app = createApp()

const STAFF_TOKEN = `Bearer ${signAccessToken({ userId: 'staff-1', email: 'staff@test.com', role: 'STAFF' })}`
const USER_TOKEN  = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`

const ADMIN_MOUNTS = [
  'users', 'categories', 'brands', 'products', 'inventory', 'tags', 'orders',
  'payment', 'reviews', 'banners', 'coupons', 'blog', 'dashboard', 'support-tickets',
]

describe('cổng /api/admin', () => {
  it.each(ADMIN_MOUNTS)('/api/admin/%s — không token → 401', async (mount) => {
    const res = await request(app).get(`/api/admin/${mount}`)
    expect(res.status).toBe(401)
  })

  it.each(ADMIN_MOUNTS)('/api/admin/%s — CUSTOMER → 403', async (mount) => {
    const res = await request(app).get(`/api/admin/${mount}`).set('Authorization', USER_TOKEN)
    expect(res.status).toBe(403)
  })

  it('path admin không tồn tại cũng bị chặn ở cổng (401 thay vì 404)', async () => {
    const res = await request(app).get('/api/admin/khong-ton-tai')
    expect(res.status).toBe(401)
  })

  it('/api/admin/users vẫn chỉ ADMIN: STAFF qua cổng chung nhưng bị 403', async () => {
    const res = await request(app).get('/api/admin/users').set('Authorization', STAFF_TOKEN)
    expect(res.status).toBe(403)
  })
})
