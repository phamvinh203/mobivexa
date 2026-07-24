import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

const mockPrisma = vi.hoisted(() => ({
  order: {
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn(),
    updateMany: vi.fn(),
    aggregate:  vi.fn(),
  },
  sePayTransaction: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    count:      vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    aggregate:  vi.fn(),
  },
  // Chạy callback ngay với chính mock client — đủ để assert các lệnh bên trong
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { createApp } from '../app'
import { signAccessToken } from '../utils/token_manager'

const app         = createApp()
const USER_TOKEN  = `Bearer ${signAccessToken({ userId: 'user-1',  email: 'user@test.com',  role: 'CUSTOMER' })}`
const ADMIN_TOKEN = `Bearer ${signAccessToken({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' })}`
const WEBHOOK_SECRET = 'test-webhook-secret'

const BASE_ORDER = {
  id:            'order-1',
  orderCode:     'ORD-20240101-AABBCC',
  total:         500000,
  paymentMethod: 'BANK_TRANSFER',
  paymentStatus: 'UNPAID',
  status:        'PENDING',
  paidAt:        null,
}

// Payload SePay gửi vào webhook — phải có id, nếu không validator chặn 400
const VALID_PAYLOAD = {
  id:              123456,
  gateway:         'MBBank',
  accountNumber:   '0123456789',
  transferType:    'in',
  transferAmount:  500000,
  content:         'Thanh toan ORD-20240101-AABBCC',
  referenceCode:   'FT24001',
  transactionDate: '2024-01-01 10:00:00',
}

function postWebhook(payload: unknown, headers: Record<string, string> = { 'x-sepay-secret': WEBHOOK_SECRET }) {
  const req = request(app).post('/api/webhooks/sepay')
  for (const [k, v] of Object.entries(headers)) req.set(k, v)
  return req.send(payload as object)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  // Mặc định: chưa từng ghi nhận giao dịch này, và create/update trả về input
  mockPrisma.sePayTransaction.findUnique.mockResolvedValue(null)
  mockPrisma.sePayTransaction.create.mockImplementation(async ({ data }: { data: unknown }) => data)
  mockPrisma.order.updateMany.mockResolvedValue({ count: 1 })
})

// ─── GET /api/orders/:id/payment ──────────────────────────────────────────────

describe('GET /api/orders/:id/payment', () => {
  it('200 - trả thông tin thanh toán QR', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(BASE_ORDER)

    const res = await request(app)
      .get('/api/orders/order-1/payment')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.content).toBe('ORD-20240101-AABBCC')
    expect(res.body.amount).toBe(500000)
  })

  it('400 - đơn hàng không dùng chuyển khoản', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ ...BASE_ORDER, paymentMethod: 'COD' })

    const res = await request(app)
      .get('/api/orders/order-1/payment')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/chuyển khoản/i)
  })

  it('400 - đơn đã thanh toán rồi', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ ...BASE_ORDER, paymentStatus: 'PAID' })

    const res = await request(app)
      .get('/api/orders/order-1/payment')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/đã.*thanh toán/i)
  })

  it('404 - đơn hàng không tồn tại', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/orders/not-found/payment')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(404)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/orders/order-1/payment')
    expect(res.status).toBe(401)
  })
})

// ─── GET /api/orders/:id/payment/status ───────────────────────────────────────

describe('GET /api/orders/:id/payment/status', () => {
  it('200 - isPaid=false khi chưa thanh toán', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(BASE_ORDER)

    const res = await request(app)
      .get('/api/orders/order-1/payment/status')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.isPaid).toBe(false)
    expect(res.body.paymentStatus).toBe('UNPAID')
    expect(res.body.orderCode).toBe('ORD-20240101-AABBCC')
  })

  it('200 - isPaid=true sau khi webhook xác nhận', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      ...BASE_ORDER,
      paymentStatus: 'PAID',
      status:        'CONFIRMED',
      paidAt:        new Date('2024-01-01T10:00:00Z'),
    })

    const res = await request(app)
      .get('/api/orders/order-1/payment/status')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.isPaid).toBe(true)
    expect(res.body.orderStatus).toBe('CONFIRMED')
    expect(res.body.paidAt).toBeTruthy()
  })

  it('404 - đơn không tồn tại hoặc không thuộc user', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/orders/order-9/payment/status')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(404)
  })

  it('401 - không có token', async () => {
    const res = await request(app).get('/api/orders/order-1/payment/status')
    expect(res.status).toBe(401)
  })
})

// ─── POST /api/webhooks/sepay — xác thực ──────────────────────────────────────

describe('POST /api/webhooks/sepay (xác thực)', () => {
  it('401 - thiếu header secret', async () => {
    const res = await postWebhook(VALID_PAYLOAD, {})
    expect(res.status).toBe(401)
  })

  it('401 - secret không đúng', async () => {
    const res = await postWebhook(VALID_PAYLOAD, { 'x-sepay-secret': 'wrong-secret' })
    expect(res.status).toBe(401)
  })

  it('200 - chấp nhận header Authorization: Apikey (định dạng SePay gửi thật)', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)

    const res = await postWebhook(VALID_PAYLOAD, { Authorization: `Apikey ${WEBHOOK_SECRET}` })

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(true)
  })
})

// ─── POST /api/webhooks/sepay — validate payload ──────────────────────────────

describe('POST /api/webhooks/sepay (payload không hợp lệ)', () => {
  it('400 - thiếu id giao dịch', async () => {
    const { id: _id, ...noId } = VALID_PAYLOAD
    const res = await postWebhook(noId)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/id/i)
  })

  it('400 - transferType không hợp lệ', async () => {
    const res = await postWebhook({ ...VALID_PAYLOAD, transferType: 'sideways' })
    expect(res.status).toBe(400)
  })

  it('400 - transactionDate không parse được', async () => {
    const res = await postWebhook({ ...VALID_PAYLOAD, transactionDate: 'hôm qua' })
    expect(res.status).toBe(400)
  })
})

// ─── POST /api/webhooks/sepay — xử lý nghiệp vụ ───────────────────────────────

describe('POST /api/webhooks/sepay (xử lý)', () => {
  it('200 - khớp đơn, đánh dấu đã thanh toán và ghi giao dịch MATCHED', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)

    const res = await postWebhook(VALID_PAYLOAD)

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(true)
    expect(res.body.orderCode).toBe('ORD-20240101-AABBCC')

    // Cập nhật có điều kiện paymentStatus=UNPAID để tránh ghi đè khi race
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', paymentStatus: 'UNPAID' },
        data:  expect.objectContaining({ paymentStatus: 'PAID', status: 'CONFIRMED' }),
      })
    )
    expect(mockPrisma.sePayTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'MATCHED', orderId: 'order-1' }) })
    )
  })

  it('200 - webhook gửi lại lần 2 thì bỏ qua (idempotent)', async () => {
    mockPrisma.sePayTransaction.findUnique.mockResolvedValue({ status: 'MATCHED', orderCode: 'ORD-20240101-AABBCC' })

    const res = await postWebhook(VALID_PAYLOAD)

    expect(res.status).toBe(200)
    expect(res.body.duplicate).toBe(true)
    expect(res.body.handled).toBe(false)
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
    expect(mockPrisma.sePayTransaction.create).not.toHaveBeenCalled()
  })

  it('200 - giao dịch tiền ra được ghi IGNORED', async () => {
    const res = await postWebhook({ ...VALID_PAYLOAD, transferType: 'out' })

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(false)
    expect(mockPrisma.sePayTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'IGNORED' }) })
    )
  })

  it('200 - không có mã đơn trong nội dung thì ghi UNMATCHED kèm lý do', async () => {
    const res = await postWebhook({ ...VALID_PAYLOAD, content: 'chuyen khoan vang lai' })

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(false)
    expect(mockPrisma.sePayTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UNMATCHED', note: expect.stringMatching(/không tìm thấy mã đơn/i) }),
      })
    )
  })

  it('200 - số tiền lệch thì giữ lại giao dịch để admin xử lý, KHÔNG set PAID', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)

    const res = await postWebhook({ ...VALID_PAYLOAD, transferAmount: 100 })

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(false)
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
    expect(mockPrisma.sePayTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UNMATCHED', note: expect.stringMatching(/số tiền không khớp/i) }),
      })
    )
  })

  it('200 - đơn không tồn tại thì ghi UNMATCHED', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const res = await postWebhook(VALID_PAYLOAD)

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(false)
    expect(mockPrisma.sePayTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'UNMATCHED', orderCode: 'ORD-20240101-AABBCC' }) })
    )
  })

  it('200 - đơn đã thanh toán trước đó thì không xử lý lại', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ ...BASE_ORDER, paymentStatus: 'PAID' })

    const res = await postWebhook(VALID_PAYLOAD)

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(false)
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('200 - race: đơn bị giao dịch khác thanh toán giữa chừng (updateMany count=0)', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)
    mockPrisma.order.updateMany.mockResolvedValue({ count: 0 })

    const res = await postWebhook(VALID_PAYLOAD)

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(false)
    expect(mockPrisma.sePayTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'UNMATCHED' }) })
    )
  })
})

// ─── GET /api/admin/payment/transactions ──────────────────────────────────────

describe('GET /api/admin/payment/transactions', () => {
  const TX_ROW = {
    id:             'tx-1',
    sepayId:        123456,
    transferAmount: 500000,
    status:         'UNMATCHED',
    orderCode:      null,
    content:        'chuyen khoan vang lai',
  }

  it('200 - trả danh sách giao dịch kèm phân trang', async () => {
    mockPrisma.sePayTransaction.findMany.mockResolvedValue([TX_ROW])
    mockPrisma.sePayTransaction.count.mockResolvedValue(1)

    const res = await request(app)
      .get('/api/admin/payment/transactions')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.transactions).toHaveLength(1)
    expect(res.body.transactions[0].transferAmount).toBe(500000)
    expect(res.body.pagination.total).toBe(1)
  })

  it('400 - status không hợp lệ', async () => {
    const res = await request(app)
      .get('/api/admin/payment/transactions?status=BANANA')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(400)
  })

  it('200 - /unmatched luôn ép filter status=UNMATCHED', async () => {
    mockPrisma.sePayTransaction.findMany.mockResolvedValue([])
    mockPrisma.sePayTransaction.count.mockResolvedValue(0)

    const res = await request(app)
      .get('/api/admin/payment/transactions/unmatched?status=MATCHED')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(mockPrisma.sePayTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'UNMATCHED' }) })
    )
  })

  it('403 - customer không được xem', async () => {
    const res = await request(app)
      .get('/api/admin/payment/transactions')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(403)
  })
})

// ─── POST /api/admin/payment/transactions/:txId/match ─────────────────────────

describe('POST /api/admin/payment/transactions/:txId/match', () => {
  const UNMATCHED_TX = {
    id:              'tx-1',
    sepayId:         123456,
    transferType:    'in',
    transferAmount:  500000,
    status:          'UNMATCHED',
    transactionDate: new Date('2024-01-01T10:00:00Z'),
  }

  function match(body: unknown, token = ADMIN_TOKEN) {
    return request(app)
      .post('/api/admin/payment/transactions/tx-1/match')
      .set('Authorization', token)
      .send(body as object)
  }

  it('200 - gán giao dịch vào đơn và đánh dấu đã thanh toán', async () => {
    mockPrisma.sePayTransaction.findUnique.mockResolvedValue(UNMATCHED_TX)
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)
    mockPrisma.sePayTransaction.update.mockResolvedValue({ ...UNMATCHED_TX, status: 'MATCHED' })

    const res = await match({ orderCode: 'ORD-20240101-AABBCC' })

    expect(res.status).toBe(200)
    expect(res.body.transaction.status).toBe('MATCHED')
    expect(mockPrisma.sePayTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'MATCHED', matchedBy: 'admin-1' }) })
    )
  })

  it('400 - mã đơn sai định dạng', async () => {
    const res = await match({ orderCode: 'abc-123' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/định dạng/i)
  })

  it('400 - thiếu orderCode', async () => {
    const res = await match({})
    expect(res.status).toBe(400)
  })

  it('400 - số tiền lệch mà không có force', async () => {
    mockPrisma.sePayTransaction.findUnique.mockResolvedValue({ ...UNMATCHED_TX, transferAmount: 400000 })
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)

    const res = await match({ orderCode: 'ORD-20240101-AABBCC' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/lệch/i)
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('200 - số tiền lệch nhưng admin xác nhận force=true', async () => {
    mockPrisma.sePayTransaction.findUnique.mockResolvedValue({ ...UNMATCHED_TX, transferAmount: 400000 })
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)
    mockPrisma.sePayTransaction.update.mockResolvedValue({ ...UNMATCHED_TX, status: 'MATCHED' })

    const res = await match({ orderCode: 'ORD-20240101-AABBCC', force: true })

    expect(res.status).toBe(200)
    expect(mockPrisma.order.updateMany).toHaveBeenCalled()
  })

  it('400 - giao dịch đã được gán trước đó', async () => {
    mockPrisma.sePayTransaction.findUnique.mockResolvedValue({ ...UNMATCHED_TX, status: 'MATCHED' })

    const res = await match({ orderCode: 'ORD-20240101-AABBCC' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/đã được gán/i)
  })

  it('404 - giao dịch không tồn tại', async () => {
    mockPrisma.sePayTransaction.findUnique.mockResolvedValue(null)

    const res = await match({ orderCode: 'ORD-20240101-AABBCC' })
    expect(res.status).toBe(404)
  })

  it('404 - đơn hàng không tồn tại', async () => {
    mockPrisma.sePayTransaction.findUnique.mockResolvedValue(UNMATCHED_TX)
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const res = await match({ orderCode: 'ORD-20240101-AABBCC' })
    expect(res.status).toBe(404)
  })

  it('403 - customer không được gán', async () => {
    const res = await match({ orderCode: 'ORD-20240101-AABBCC' }, USER_TOKEN)
    expect(res.status).toBe(403)
  })
})

// ─── POST /api/admin/payment/sync ─────────────────────────────────────────────

describe('POST /api/admin/payment/sync', () => {
  // UserAPI trả shape khác webhook: snake_case, tách amount_in / amount_out
  const API_TX = {
    id:                  '789',
    bank_brand_name:     'MBBank',
    account_number:      '0123456789',
    transaction_date:    '2024-01-02 08:30:00',
    amount_out:          '0',
    amount_in:           '500000',
    accumulated:         '1500000',
    transaction_content: 'CK ORD-20240101-AABBCC',
    reference_number:    'FT24002',
    code:                null,
    sub_account:         null,
  }

  function mockFetch(body: unknown, ok = true, status = 200) {
    const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
    vi.stubGlobal('fetch', fn)
    return fn
  }

  const sync = (token = ADMIN_TOKEN) =>
    request(app).post('/api/admin/payment/sync').set('Authorization', token)

  it('200 - kéo giao dịch từ SePay và khớp đơn', async () => {
    const fetchFn = mockFetch({ transactions: [API_TX] })
    mockPrisma.order.findUnique.mockResolvedValue(BASE_ORDER)

    const res = await sync()

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ fetched: 1, matched: 1, duplicate: 0 })

    // amount_in > 0 → transferType 'in', và số tiền lấy từ amount_in
    expect(mockPrisma.sePayTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sepayId: 789, transferType: 'in', source: 'SYNC', status: 'MATCHED' }),
      })
    )
    expect(fetchFn.mock.calls[0][0]).toContain('/userapi/transactions/list')
  })

  it('200 - giao dịch đã ghi nhận trước đó được đếm là duplicate', async () => {
    mockFetch({ transactions: [API_TX] })
    mockPrisma.sePayTransaction.findUnique.mockResolvedValue({ status: 'MATCHED', orderCode: 'ORD-20240101-AABBCC' })

    const res = await sync()

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ fetched: 1, duplicate: 1, matched: 0 })
    expect(mockPrisma.sePayTransaction.create).not.toHaveBeenCalled()
  })

  it('502 - SePay API trả lỗi', async () => {
    mockFetch({}, false, 500)

    const res = await sync()

    expect(res.status).toBe(502)
    expect(res.body.message).toMatch(/SePay API/i)
  })

  it('502 - không kết nối được tới SePay', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const res = await sync()

    expect(res.status).toBe(502)
    expect(res.body.message).toMatch(/không kết nối/i)
  })

  it('403 - customer không được sync', async () => {
    const res = await sync(USER_TOKEN)
    expect(res.status).toBe(403)
  })
})

// ─── GET /api/admin/payment/stats ─────────────────────────────────────────────

describe('GET /api/admin/payment/stats', () => {
  it('200 - kèm số giao dịch chưa đối soát', async () => {
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { total: 1000000 }, _count: 2 })
    mockPrisma.sePayTransaction.aggregate.mockResolvedValue({ _sum: { transferAmount: 250000 }, _count: 1 })

    const res = await request(app)
      .get('/api/admin/payment/stats')
      .set('Authorization', ADMIN_TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.revenue).toBe(1000000)
    expect(res.body.unmatchedTransactions).toEqual({ count: 1, amount: 250000 })
  })

  it('403 - customer không được xem', async () => {
    const res = await request(app)
      .get('/api/admin/payment/stats')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(403)
  })
})
