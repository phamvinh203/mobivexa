# Sequence Diagram - Payment Module

## Tài liệu kỹ thuật về luồng xử lý thanh toán

**Phiên bản**: 1.0  
**Ngày**: 2026-06-20  
**Module**: Payment  
**Backend**: Express + Prisma + PostgreSQL  
**Tích hợp**: SePay Webhook  

---

## Tổng quan

Module Payment xử lý 3 luồng chính:
1. **Get Payment QR Info** - Khách hàng lấy thông tin chuyển khoản NH & QR code
2. **Process SePay Webhook** - Nhận và xử lý callback từ SePay khi có chuyển khoản
3. **Get Payment Statistics** - Admin lấy thống kê thanh toán cho dashboard

---

## 1. Get Payment QR Info Sequence

### 1.1. Tổng quan luồng

Khách hàng yêu cầu thông tin thanh toán cho đơn hàng đã đặt → Hệ thống validate và trả về thông tin tài khoản ngân hàng + QR code VietQR.

### 1.2. Sơ đồ sequence

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách hàng
    participant API as API Controller<br/>payment.controller.ts
    participant Service as Payment Service<br/>payment.service.ts
    participant Prisma as Prisma Client
    participant DB as Database

    Note over Customer,DB: PHASE 1: Authentication & Request Routing

    Customer->>API: GET /orders/:id/payment<br/>Header: Authorization: Bearer {token}
    activate API
    API->>API: authenticate() middleware<br/>- Verify JWT token<br/>- Extract userId
    alt Authentication failed
        API-->>Customer: 401 Unauthorized
        deactivate API
    end

    Note over Customer,DB: PHASE 2: Query Order & Validate

    API->>Service: getOrderPaymentInfo(userId, orderId)
    activate Service
    Service->>Prisma: prisma.order.findFirst({<br/>  where: { id: orderId, userId },<br/>  select: { id, orderCode, total,<br/>           paymentMethod, paymentStatus }<br/>})
    activate Prisma
    Prisma->>DB: SELECT id, order_code, total,<br/>       payment_method, payment_status<br/>       FROM orders<br/>       WHERE id = $1 AND user_id = $2
    activate DB
    DB-->>Prisma: Order record or null
    deactivate DB
    Prisma-->>Service: Order object or null
    deactivate Prisma

    alt Order not found
        Service-->>API: throw AppError(404, 'Đơn hàng không tồn tại')
        API-->>Customer: 404 Not Found<br/>{ error: 'Đơn hàng không tồn tại' }
        deactivate Service
        deactivate API
    else Order found
        Note over Service: VALIDATION GATE 1:<br/>Check paymentMethod === BANK_TRANSFER
        alt paymentMethod !== BANK_TRANSFER
            Service-->>API: throw AppError(400, 'Đơn hàng không dùng phương thức chuyển khoản ngân hàng')
            API-->>Customer: 400 Bad Request<br/>{ error: 'Đơn hàng không dùng phương thức chuyển khoản ngân hàng' }
            deactivate Service
            deactivate API
        end

        Note over Service: VALIDATION GATE 2:<br/>Check paymentStatus !== PAID
        alt paymentStatus === PAID
            Service-->>API: throw AppError(400, 'Đơn hàng đã được thanh toán')
            API-->>Customer: 400 Bad Request<br/>{ error: 'Đơn hàng đã được thanh toán' }
            deactivate Service
            deactivate API
        end

        Note over Customer,DB: PHASE 3: Build QR URL & Return

        Service->>Service: buildQrUrl(orderCode, amount)<br/>- Build URLSearchParams<br/>- Generate VietQR URL
        Note over Service: QR URL format:<br/>https://img.vietqr.io/image/<br/>{BANK_ID}-{ACCOUNT_NO}-<br/>compact2.jpg?<br/>amount={amount}&<br/>addInfo={orderCode}&<br/>accountName={ACCOUNT_NAME}

        Service-->>API: Payment info object<br/>{<br/>  bankId: string,<br/>  accountNo: string,<br/>  accountName: string,<br/>  amount: number,<br/>  content: string,<br/>  qrUrl: string<br/>}
        deactivate Service
        API->>API: sendSuccess(res, info)
        API-->>Customer: 200 OK<br/>{<br/>  ok: true,<br/>  data: {<br/>    bankId, accountNo,<br/>    accountName, amount,<br/>    content, qrUrl<br/>  }<br/>}
        deactivate API
    end
```

### 1.3. Chi tiết các bước

| Step | Operation | Input | Output | Error Handling |
|------|-----------|-------|--------|----------------|
| 1 | JWT Authentication | Header: Authorization Bearer | userId | 401 Unauthorized |
| 2 | Database Query | userId, orderId | Order object | 404 Not Found |
| 3 | Validate Payment Method | order.paymentMethod | - | 400 Bad Request |
| 4 | Validate Payment Status | order.paymentStatus | - | 400 Bad Request |
| 5 | Build QR URL | orderCode, amount | QR URL string | - |

### 1.4. Database Schema

```sql
-- Order table structure (relevant columns)
CREATE TABLE orders (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id),
  order_code      VARCHAR(20) UNIQUE NOT NULL,
  total           DECIMAL(10,2) NOT NULL,
  payment_method  VARCHAR(20) NOT NULL,  -- 'BANK_TRANSFER', 'CREDIT_CARD', etc.
  payment_status  VARCHAR(20) NOT NULL,  -- 'UNPAID', 'PAID', 'REFUNDED'
  created_at      TIMESTAMP NOT NULL,
  updated_at      TIMESTAMP NOT NULL
);

-- Index for efficient lookup
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_code ON orders(order_code);
```

### 1.5. Response Data Structure

**Success Response (200 OK)**:
```json
{
  "ok": true,
  "data": {
    "bankId": "970415",
    "accountNo": "1234567890",
    "accountName": "NGUYEN VAN A",
    "amount": 500000,
    "content": "ORD-20240615-ABC123",
    "qrUrl": "https://img.vietqr.io/image/970415-1234567890-compact2.jpg?amount=500000&addInfo=ORD-20240615-ABC123&accountName=NGUYEN+VAN+A"
  }
}
```

**Error Responses**:
- `401 Unauthorized` - JWT token không hợp lệ
- `404 Not Found` - Đơn hàng không tồn tại
- `400 Bad Request` - Đơn hàng không dùng BANK_TRANSFER hoặc đã thanh toán

---

## 2. Process SePay Webhook Sequence

### 2.1. Tổng quan luồng

SePay gửi webhook khi phát hiện giao dịch chuyển khoản → Hệ thống verify secret → Parse order code từ nội dung chuyển khoản → Validate 6 điều kiện → Cập nhật trạng thái đơn hàng.

### 2.2. Sơ đồ sequence

```mermaid
sequenceDiagram
    autonumber
    participant SePay as SePay Service
    participant Middleware as API Middleware<br/>verifySePaySecret()
    participant API as API Controller<br/>sepayWebhook()
    participant Service as Payment Service<br/>processSePayWebhook()
    participant Prisma as Prisma Client
    participant DB as Database

    Note over SePay,DB: PHASE 1: Webhook Authentication

    SePay->>Middleware: POST /webhooks/sepay<br/>Header: x-sepay-secret: {secret}<br/>Body: SePayWebhookPayload
    activate Middleware
    Middleware->>Middleware: Compare req.headers['x-sepay-secret']<br/>with process.env.SEPAY_WEBHOOK_SECRET

    alt Secret không hợp lệ
        Middleware-->>SePay: 401 Unauthorized<br/>{ error: 'Webhook secret không hợp lệ' }
        deactivate Middleware
    else Secret hợp lệ
        Middleware->>Middleware: next() - pass to controller
        deactivate Middleware

        Note over SePay,DB: PHASE 2: Initial Validation (Early Return)

        API->>Service: processSePayWebhook(payload)
        activate Service

        Note over Service: VALIDATION GATE 1:<br/>Check transferType === 'in'
        alt transferType !== 'in'
            Service-->>API: { handled: false }
            API-->>SePay: 200 OK<br/>{ success: true, handled: false }
            deactivate Service
            deactivate API
        end

        Note over Service: VALIDATION GATE 2:<br/>Regex parse orderCode from content
        Service->>Service: ORDER_CODE_RE = /ORD-\d{8}-[0-9A-F]{6}/i<br/>match = payload.content.match(ORDER_CODE_RE)
        alt No match found
            Service-->>API: { handled: false }
            API-->>SePay: 200 OK<br/>{ success: true, handled: false }
            deactivate Service
            deactivate API
        end

        Note over SePay,DB: PHASE 3: Query Order by Code

        Service->>Service: orderCode = match[0].toUpperCase()
        Service->>Prisma: prisma.order.findUnique({<br/>  where: { orderCode },<br/>  select: { id, total,<br/>           paymentStatus, status }<br/>})
        activate Prisma
        Prisma->>DB: SELECT id, total, payment_status, status<br/>       FROM orders<br/>       WHERE order_code = $1
        activate DB
        DB-->>Prisma: Order record or null
        deactivate DB
        Prisma-->>Service: Order object or null
        deactivate Prisma

        alt Order not found
            Service-->>API: { handled: false }
            API-->>SePay: 200 OK<br/>{ success: true, handled: false }
            deactivate Service
            deactivate API
        end

        Note over Service: VALIDATION GATE 3:<br/>Check paymentStatus !== PAID
        alt paymentStatus === PAID
            Service-->>API: { handled: false }
            API-->>SePay: 200 OK<br/>{ success: true, handled: false }
            deactivate Service
            deactivate API
        end

        Note over SePay,DB: PHASE 4: Amount Validation

        Note over Service: VALIDATION GATE 4:<br/>Validate transferAmount === total
        Service->>Service: expectedAmount = Number(order.total)<br/>if (payload.transferAmount !== expectedAmount)
        alt Amount mismatch
            Service-->>API: { handled: false }
            API-->>SePay: 200 OK<br/>{ success: true, handled: false }
            deactivate Service
            deactivate API
        end

        Note over SePay,DB: PHASE 5: Date Validation

        Note over Service: VALIDATION GATE 5:<br/>Validate transactionDate
        Service->>Service: paidAt = new Date(payload.transactionDate)<br/>if (isNaN(paidAt.getTime()))
        alt Invalid date
            Service-->>API: { handled: false }
            API-->>SePay: 200 OK<br/>{ success: true, handled: false }
            deactivate Service
            deactivate API
        end

        Note over SePay,DB: PHASE 6: Update Order Status

        Service->>Prisma: prisma.order.update({<br/>  where: { id: order.id },<br/>  data: {<br/>    paymentStatus: PAID,<br/>    paidAt,<br/>    ...(order.status === PENDING && <br/>      { status: CONFIRMED })<br/>  }<br/>})
        activate Prisma
        Prisma->>DB: UPDATE orders<br/>       SET payment_status = 'PAID',<br/>           paid_at = $1,<br/>           status = 'CONFIRMED'<br/>       WHERE id = $2<br/>       AND status = 'PENDING'
        activate DB
        DB-->>Prisma: Update result
        deactivate DB
        Prisma-->>Service: Updated order
        deactivate Prisma

        Service-->>API: { handled: true, orderCode }
        deactivate Service
        API-->>SePay: 200 OK<br/>{ success: true, handled: true, orderCode }
        deactivate API
    end
```

### 2.3. Chi tiết 6 Validation Gates

| Gate | Condition | Return on Fail | Purpose |
|------|-----------|----------------|---------|
| 1 | `transferType === 'in'` | `{ handled: false }` | Chỉ xử lý giao dịch tiền vào |
| 2 | Regex match orderCode from content | `{ handled: false }` | Trích xuất mã đơn hàng từ nội dung CK |
| 3 | Order exists by orderCode | `{ handled: false }` | Đơn hàng phải tồn tại |
| 4 | `paymentStatus !== PAID` | `{ handled: false }` | Tránh xử lý trùng |
| 5 | `transferAmount === total` | `{ handled: false }` | Số tiền phải khớp đúng |
| 6 | Valid transactionDate | `{ handled: false }` | Ngày giao dịch phải hợp lệ |

### 2.4. SePay Webhook Payload Structure

```typescript
interface SePayWebhookPayload {
  id: number                      // ID giao dịch SePay
  gateway: string                 // Cổng thanh toán
  transactionDate: string         // ISO 8601 datetime
  accountNumber: string          // Số tài khoản nhận tiền
  subAccount: string | null      // Tài khoản con (nếu có)
  code: string | null            // Mã giao dịch ngân hàng
  content: string                // Nội dung chuyển khoản<br/>// Format: "ORD-20240615-ABC123 ..."
  transferType: 'in' | 'out'    // Loại giao dịch
  transferAmount: number         // Số tiền chuyển
  accumulated: number            // Số dư tích lũy
  referenceCode: string          // Mã tham chiếu
  description: string            // Mô tả giao dịch
  body: string                   // Thông tin bổ sung
}
```

### 2.5. Regex Pattern

```javascript
// Được compile 1 lần tại module load - tái sử dụng cho mỗi webhook call
const ORDER_CODE_RE = /ORD-\d{8}-[0-9A-F]{6}/i

// Example matches:
// ✓ "ORD-20240615-ABC123"
// ✓ "ord-20240615-abc123" (case-insensitive)
// ✗ "ORD-2024-ABC" (wrong format)
// ✗ "PAY-20240615-ABC123" (wrong prefix)
```

### 2.6. Update Logic

```javascript
// Conditional update: chỉ chuyển sang CONFIRMED khi đang PENDING
{
  paymentStatus: PaymentStatus.PAID,
  paidAt: new Date(payload.transactionDate),
  ...(order.status === OrderStatus.PENDING && { 
    status: OrderStatus.CONFIRMED 
  })
}

// Trạng thái không bị thay đổi nếu:
// - order.status === CONFIRMED (đã xác nhận trước đó)
// - order.status === PROCESSING (đang xử lý)
// - order.status === COMPLETED (đã hoàn thành)
```

### 2.7. Idempotency Strategy

**Đặc tính idempotent**: Webhook có thể được gọi lại nhiều times với cùng payload mà không gây side effect bất lợi.

| Scenario | Behavior |
|----------|----------|
| Webhook gọi lại với cùng transaction | Return `{ handled: false }` vì `paymentStatus === PAID` |
| Webhook với amount sai | Return `{ handled: false }` - không update |
| Webhook với orderCode không tồn tại | Return `{ handled: false }` - silent fail |
| Race condition: 2 webhook cùng lúc | Database transaction ensures atomic update |

---

## 3. Get Payment Statistics Sequence

### 3.1. Tổng quan luồng

Admin yêu cầu thống kê thanh toán → Hệ thống chạy 4 query song song → Tổng hợp số liệu → Return stats object.

### 3.2. Sơ đồ sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin User
    participant Auth as Auth Middleware<br/>authenticate()
    participant Role as Role Middleware<br/>authorize()
    participant API as API Controller<br/>stats()
    participant Service as Payment Service<br/>getPaymentStats()
    participant Prisma as Prisma Client
    participant DB as Database (4 parallel queries)

    Note over Admin,DB: PHASE 1: Authentication & Authorization

    Admin->>API: GET /admin/payment/stats<br/>Header: Authorization: Bearer {admin_token}
    activate API
    API->>Auth: authenticate() middleware
    activate Auth
    Auth->>Auth: Verify JWT + Extract userId + role
    alt Auth failed
        Auth-->>Admin: 401 Unauthorized
        deactivate Auth
        deactivate API
    end
    Auth->>Role: authorize(...STAFF_ROLES)
    activate Role
    Role->>Role: Check user.role in ['ADMIN', 'STAFF']
    alt Not authorized
        Role-->>Admin: 403 Forbidden<br/>{ error: 'Insufficient permissions' }
        deactivate Role
        deactivate Auth
        deactivate API
    end
    Role->>API: next() - pass to controller
    deactivate Role
    deactivate Auth

    Note over Admin,DB: PHASE 2: Parallel Aggregation Queries

    API->>Service: getPaymentStats()
    activate Service
    Service->>Service: Promise.all([...])<br/>- Execute 4 queries in parallel
    par Query 1: PAID orders
        Service->>Prisma: aggregate({<br/>  where: { paymentStatus: PAID },<br/>  _sum: { total: true },<br/>  _count: true<br/>})
        activate Prisma
        Prisma->>DB: SELECT COALESCE(SUM(total), 0) as _sum,<br/>       COUNT(*) as _count<br/>       FROM orders<br/>       WHERE payment_status = 'PAID'
        activate DB
        DB-->>Prisma: { _sum: { total: Decimal }, _count: number }
        deactivate DB
        Prisma-->>Service: paidAgg result
        deactivate Prisma
    and Query 2: UNPAID orders
        Service->>Prisma: aggregate({<br/>  where: { paymentStatus: UNPAID },<br/>  _sum: { total: true },<br/>  _count: true<br/>})
        activate Prisma
        Prisma->>DB: SELECT COALESCE(SUM(total), 0) as _sum,<br/>       COUNT(*) as _count<br/>       FROM orders<br/>       WHERE payment_status = 'UNPAID'
        activate DB
        DB-->>Prisma: { _sum: { total: Decimal }, _count: number }
        deactivate DB
        Prisma-->>Service: unpaidAgg result
        deactivate Prisma
    and Query 3: REFUNDED orders
        Service->>Prisma: aggregate({<br/>  where: { paymentStatus: REFUNDED },<br/>  _sum: { total: true },<br/>  _count: true<br/>})
        activate Prisma
        Prisma->>DB: SELECT COALESCE(SUM(total), 0) as _sum,<br/>       COUNT(*) as _count<br/>       FROM orders<br/>       WHERE payment_status = 'REFUNDED'
        activate DB
        DB-->>Prisma: { _sum: { total: Decimal }, _count: number }
        deactivate DB
        Prisma-->>Service: refundedAgg result
        deactivate Prisma
    and Query 4: UNPAID + BANK_TRANSFER
        Service->>Prisma: aggregate({<br/>  where: { <br/>    paymentStatus: UNPAID,<br/>    paymentMethod: BANK_TRANSFER<br/>  },<br/>  _sum: { total: true },<br/>  _count: true<br/>})
        activate Prisma
        Prisma->>DB: SELECT COALESCE(SUM(total), 0) as _sum,<br/>       COUNT(*) as _count<br/>       FROM orders<br/>       WHERE payment_status = 'UNPAID'<br/>       AND payment_method = 'BANK_TRANSFER'
        activate DB
        DB-->>Prisma: { _sum: { total: Decimal }, _count: number }
        deactivate DB
        Prisma-->>Service: awaitingAgg result
        deactivate Prisma
    end

    Note over Admin,DB: PHASE 3: Convert Decimal & Build Response

    Service->>Service: toAmount(agg) conversion<br/>- Convert Prisma.Decimal to Number<br/>- Handle null case (default 0)
    Note over Service: const toAmount = (agg) => <br/>  Number(agg._sum.total ?? 0)

    Service->>Service: Build stats object<br/>{<br/>  revenue: toAmount(paidAgg),<br/>  pending: {<br/>    count: unpaidAgg._count,<br/>    amount: toAmount(unpaidAgg)<br/>  },<br/>  refunded: {<br/>    count: refundedAgg._count,<br/>    amount: toAmount(refundedAgg)<br/>  },<br/>  awaitingBankTransfer: {<br/>    count: awaitingAgg._count,<br/>    amount: toAmount(awaitingAgg)<br/>  }<br/>}

    Service-->>API: stats object
    deactivate Service
    API->>API: sendSuccess(res, stats)
    API-->>Admin: 200 OK<br/>{ ok: true, data: { stats } }
    deactivate API
```

### 3.3. Chi tiết 4 Aggregation Queries

| Query | Condition | Purpose | Metric |
|-------|-----------|---------|--------|
| 1 | `paymentStatus = PAID` | Tổng doanh thu đã thu | Revenue |
| 2 | `paymentStatus = UNPAID` | Đơn hàng chưa thanh toán | Pending (count + amount) |
| 3 | `paymentStatus = REFUNDED` | Đơn hàng đã hoàn tiền | Refunded (count + amount) |
| 4 | `paymentStatus = UNPAID AND paymentMethod = BANK_TRANSFER` | Chờ đối soát chuyển khoản | Awaiting Bank Transfer |

### 3.4. SQL Queries Behind Prisma

```sql
-- Query 1: PAID orders
SELECT COALESCE(SUM(total), 0) as "_sum.total", COUNT(*) as "_count"
FROM orders
WHERE payment_status = 'PAID';

-- Query 2: UNPAID orders
SELECT COALESCE(SUM(total), 0) as "_sum.total", COUNT(*) as "_count"
FROM orders
WHERE payment_status = 'UNPAID';

-- Query 3: REFUNDED orders
SELECT COALESCE(SUM(total), 0) as "_sum.total", COUNT(*) as "_count"
FROM orders
WHERE payment_status = 'REFUNDED';

-- Query 4: UNPAID + BANK_TRANSFER (chờ đối soát)
SELECT COALESCE(SUM(total), 0) as "_sum.total", COUNT(*) as "_count"
FROM orders
WHERE payment_status = 'UNPAID'
  AND payment_method = 'BANK_TRANSFER';
```

### 3.5. Response Data Structure

**Success Response (200 OK)**:
```json
{
  "ok": true,
  "data": {
    "revenue": 15000000,
    "pending": {
      "count": 5,
      "amount": 2500000
    },
    "refunded": {
      "count": 2,
      "amount": 1000000
    },
    "awaitingBankTransfer": {
      "count": 3,
      "amount": 1500000
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized` - JWT token không hợp lệ
- `403 Forbidden` - Không phải ADMIN hoặc STAFF

---

## 4. Common Patterns

### 4.1. Bảng Common Patterns

| Pattern | Used In | Description |
|---------|---------|-------------|
| **Early Return Pattern** | Webhook processing | Return `{ handled: false }` on validation failure instead of throwing |
| **Regex Pre-compilation** | Webhook processing | Compile regex once at module load for performance |
| **Parallel Queries** | Statistics | Use `Promise.all()` for parallel aggregation |
| **Conditional Spread** | Webhook update | `...(condition && { value })` for optional fields |
| **Decimal to Number** | Statistics | Convert Prisma.Decimal to Number for JSON serialization |
| **Authentication Middleware** | All admin endpoints | `authenticate()` → `authorize(...)` chain |

### 4.2. Error Handling Pattern

```typescript
// Common error response structure
{
  ok: false,
  error: string,          // Human-readable message
  code?: string,          // Machine-readable error code
  statusCode: number      // HTTP status code
}

// AppError throws are caught by asyncHandler
throw new AppError(statusCode, message)
```

### 4.3. Database Transaction Pattern

```typescript
// Currently: No explicit transactions (auto-commit)
// Future enhancement for atomic operations:
await prisma.$transaction(async (tx) => {
  const order = await tx.order.update({ ... })
  await tx.inventoryLog.create({ ... })
  await tx.notification.create({ ... })
})
```

---

## 5. Idempotency Strategy

### 5.1. Idempotency Table

| Operation | Idempotent? | Strategy |
|-----------|--------------|----------|
| **Get Payment QR Info** | Yes | Read-only operation |
| **Process SePay Webhook** | Yes | Check `paymentStatus === PAID` before update |
| **Get Payment Statistics** | Yes | Read-only aggregation |

### 5.2. Webhook Idempotency Detail

**Scenario**: SePay gọi lại webhook nhiều lần với cùng một giao dịch

| Call # | Order Status Before | Check | Result |
|--------|-------------------|-------|--------|
| 1 | `UNPAID` | `paymentStatus !== PAID` ✓ | Update to `PAID`, return `{ handled: true }` |
| 2 | `PAID` | `paymentStatus !== PAID` ✗ | Skip update, return `{ handled: false }` |
| 3 | `PAID` | `paymentStatus !== PAID` ✗ | Skip update, return `{ handled: false }` |

**Key**: Validation Gate 3 (`paymentStatus !== PAID`) đảm bảo idempotency.

---

## 6. Security Validation Flow

### 6.1. Authentication & Authorization Matrix

| Endpoint | Auth Required | Role Required | Secret Required |
|----------|--------------|---------------|-----------------|
| `GET /orders/:id/payment` | ✓ (JWT) | Any | ✗ |
| `POST /webhooks/sepay` | ✗ | ✗ | ✓ (x-sepay-secret) |
| `GET /admin/payment/stats` | ✓ (JWT) | ADMIN, STAFF | ✗ |

### 6.2. Webhook Secret Validation

```typescript
// Middleware-level validation
export function verifySePaySecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.SEPAY_WEBHOOK_SECRET
  if (!secret || req.headers['x-sepay-secret'] !== secret) {
    sendError(res, 401, 'Webhook secret không hợp lệ')
    return
  }
  next()
}
```

**Security notes**:
- Secret được so sánh ở middleware level - fail fast
- Environment variable phải được set trong production
- Không log secret trong bất kỳ trường hợp nào

---

## 7. Webhook Processing Notes

### 7.1. SePay Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        SePay Service                         │
│  (Monitors bank account 24/7, sends real-time webhooks)     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTPS POST
                            │ /webhooks/sepay
                            │ Header: x-sepay-secret
                            │ Body: SePayWebhookPayload
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Mobivexa Backend                          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ verifySePaySecret() Middleware                          │ │
│  │ - Verify x-sepay-secret header                          │ │
│  │ - 401 if invalid                                       │ │
│  └───────────────────┬───────────────────────────────────┘ │
│                      │ next()                                 │
│                      ↓                                         │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ processSePayWebhook() Service                          │ │
│  │ - Validate 6 gates                                     │ │
│  │ - Update order status                                  │ │
│  │ - Return { handled: boolean }                         │ │
│  └───────────────────┬───────────────────────────────────┘ │
│                      │                                         │
│                      ↓                                         │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Response to SePay                                      │ │
│  │ 200 OK { success: true, handled: true/false }         │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ (Optionally) Send notification
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Customer                                 │
│  (Optional: Email/SMS push notification on payment success)  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2. Webhook Processing Timeline

| Time | Event | Observable State |
|------|-------|------------------|
| T+0s | SePay detects bank transfer | SePay system |
| T+1s | SePay sends webhook | In-flight to backend |
| T+2s | Backend receives webhook | API request log |
| T+2.1s | Secret validation | Middleware log |
| T+2.2s | Validation gates 1-6 | Service logic |
| T+2.3s | Database update | `order.paymentStatus = PAID` |
| T+2.4s | Response to SePay | HTTP 200 OK |
| T+3s | Optional notification | Customer receives email |

---

## 8. Testing Checklist

### 8.1. Test Cases cho Get Payment QR Info

| Test # | Scenario | Input | Expected Output |
|--------|----------|-------|-----------------|
| TC-01 | Happy path | Valid userId + orderId | 200 OK with QR URL |
| TC-02 | Order not found | Invalid orderId | 404 Not Found |
| TC-03 | Wrong payment method | Order with `CREDIT_CARD` | 400 Bad Request |
| TC-04 | Already paid | Order with `PAID` status | 400 Bad Request |
| TC-05 | Unauthorized | No JWT token | 401 Unauthorized |
| TC-06 | Wrong user | Order belongs to different user | 404 Not Found |

### 8.2. Test Cases cho Process SePay Webhook

| Test # | Scenario | Input | Expected Output |
|--------|----------|-------|-----------------|
| TC-01 | Happy path | Valid webhook with all conditions | `{ handled: true, orderCode }` |
| TC-02 | Wrong transfer type | `transferType: 'out'` | `{ handled: false }` |
| TC-03 | No order code in content | `content: 'No order code'` | `{ handled: false }` |
| TC-04 | Order not found | Invalid orderCode | `{ handled: false }` |
| TC-05 | Already paid | Order with `PAID` status | `{ handled: false }` |
| TC-06 | Amount mismatch | `transferAmount !== total` | `{ handled: false }` |
| TC-07 | Invalid date | `transactionDate: 'invalid'` | `{ handled: false }` |
| TC-08 | Idempotency | Same webhook sent twice | 1st: `{ handled: true }`, 2nd: `{ handled: false }` |
| TC-09 | Invalid secret | Wrong `x-sepay-secret` | 401 Unauthorized |
| TC-10 | Conditional status update | Order with `PROCESSING` status | Update `paymentStatus=PAID` but `status` unchanged |

### 8.3. Test Cases cho Get Payment Statistics

| Test # | Scenario | Input | Expected Output |
|--------|----------|-------|-----------------|
| TC-01 | Happy path | Admin authenticated | 200 OK with stats |
| TC-02 | Unauthorized | No JWT token | 401 Unauthorized |
| TC-03 | Forbidden | Non-staff role | 403 Forbidden |
| TC-04 | No orders | Empty database | All stats = 0 |
| TC-05 | Mixed statuses | Orders with PAID, UNPAID, REFUNDED | Correct aggregation |
| TC-06 | Decimal conversion | Large amounts | Numbers not strings |

---

## 9. Observable States

### 9.1. Database States per Operation

| Operation | Pre-condition | Post-condition | Side Effects |
|-----------|--------------|---------------|--------------|
| **Get QR Info** | Order exists | No change | None |
| **Webhook (success)** | `paymentStatus = UNPAID` | `paymentStatus = PAID`, `paidAt = NOW()` | `status = CONFIRMED` (if was `PENDING`) |
| **Webhook (fail any gate)** | Any state | No change | None |
| **Get Stats** | Any state | No change | None |

### 9.2. Customer Observable States

| State | Customer Sees | Trigger |
|-------|--------------|---------|
| `UNPAID` | "Chưa thanh toán" + QR code displayed | Order created |
| `PAID` | "Đã thanh toán" + Order confirmed | Webhook processed |
| `REFUNDED` | "Đã hoàn tiền" | Admin triggered refund |

### 9.3. Admin Observable States

| State | Admin Sees | Action |
|-------|-----------|--------|
| Dashboard stats | Revenue, pending count, refunded count | GET /admin/payment/stats |
| Order list | Filter by payment status | Admin panel UI |

---

## 10. Performance Considerations

### 10.1. Query Performance

| Operation | Query Type | Index Used | Estimated Time |
|-----------|-----------|-----------|----------------|
| Get QR Info | `findFirst` | `orders.id + user_id` | < 50ms |
| Webhook step 3 | `findUnique` | `orders.order_code` (unique) | < 50ms |
| Webhook update | `update` | `orders.id` (primary key) | < 50ms |
| Stats (4 queries) | 4× `aggregate` | `payment_status` + `payment_method` | < 200ms (parallel) |

### 10.2. Optimization Opportunities

1. **Add composite index**:
   ```sql
   CREATE INDEX idx_orders_payment_method_status 
   ON orders(payment_method, payment_status);
   ```

2. **Cache stats for 5 minutes**:
   ```typescript
   // Future: Add Redis caching
   const cached = await redis.get('payment_stats')
   if (cached) return JSON.parse(cached)
   const stats = await getPaymentStats()
   await redis.setex('payment_stats', 300, JSON.stringify(stats))
   return stats
   ```

3. **Batch webhook processing**:
   ```typescript
   // Future: Process multiple webhooks in one transaction
   await prisma.$transaction(webhooks.map(wh => processWebhook(wh)))
   ```

---

## 11. Error Codes Reference

| HTTP Code | Error Message | Scenario | Resolution |
|-----------|-------------|-----------|------------|
| 200 | `{ success: true, handled: true }` | Webhook processed successfully | - |
| 200 | `{ success: true, handled: false }` | Webhook received but not processed | Validation failed - expected behavior |
| 400 | "Đơn hàng không dùng phương thức chuyển khoản ngân hàng" | Get QR on non-BANK_TRANSFER order | Use correct payment method |
| 400 | "Đơn hàng đã được thanh toán" | Get QR on PAID order | Order already complete |
| 401 | "Webhook secret không hợp lệ" | Webhook secret mismatch | Check `SEPAY_WEBHOOK_SECRET` env var |
| 401 | "Unauthorized" | Invalid JWT token | Re-authenticate |
| 403 | "Forbidden" | Insufficient permissions | Requires ADMIN or STAFF role |
| 404 | "Đơn hàng không tồn tại" | Order not found | Check orderId |

---

## 12. Environment Variables Required

```bash
# SePay Integration
SEPAY_WEBHOOK_SECRET=your_secret_key_here
SEPAY_BANK_ID=970415
SEPAY_ACCOUNT_NUMBER=1234567890
SEPAY_ACCOUNT_NAME=NGUYEN VAN A

# Database (shared)
DATABASE_URL=postgresql://user:password@localhost:5432/mobivexa

# JWT (shared)
JWT_SECRET=your_jwt_secret_here
```

---

## 13. Database Schema Summary

### 13.1. Orders Table

```sql
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  order_code      VARCHAR(20) UNIQUE NOT NULL,
  total           DECIMAL(10,2) NOT NULL,
  payment_method  VARCHAR(20) NOT NULL,  -- 'BANK_TRANSFER', 'CREDIT_CARD'
  payment_status  VARCHAR(20) NOT NULL,  -- 'UNPAID', 'PAID', 'REFUNDED'
  status          VARCHAR(20) NOT NULL,  -- 'PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED'
  paid_at         TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Critical indexes for payment workflows
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE UNIQUE INDEX idx_orders_order_code ON orders(order_code);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_payment_method_status ON orders(payment_method, payment_status);
```

---

## 14. Appendix: Code References

### 14.1. File Structure

```
be_mobivexa/src/
├── controllers/
│   └── payment.controller.ts    # API endpoints & middleware
├── services/
│   └── payment.service.ts      # Business logic
├── routes/
│   └── payment.route.ts        # Route definitions
├── middlewares/
│   ├── auth.middleware.ts      # JWT authentication
│   └── authorize.middleware.ts  # Role-based access control
├── types/
│   └── payment.type.ts         # TypeScript interfaces
└── config/
    └── db.ts                   # Prisma client
```

### 14.2. Route Endpoints Summary

| Method | Endpoint | Auth | Handler | Purpose |
|--------|----------|------|---------|---------|
| GET | `/orders/:id/payment` | Customer | `paymentInfo` | Get QR code |
| POST | `/webhooks/sepay` | Public (secret) | `sepayWebhook` | Process webhook |
| GET | `/admin/payment/stats` | Admin/Staff | `stats` | Get statistics |

---

## 15. Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-06-20 | Initial version - Complete sequence diagrams for all 3 payment flows | Workflow Architect |

---

**Kết thúc tài liệu Sequence Diagram - Payment Module**

Đây là tài liệu kỹ thuật chi tiết về luồng xử lý thanh toán trong hệ thống Mobivexa. Tất cả các sequence diagram đều được viết theo chuẩn Mermaid syntax và có thể được render trực tiếp trong các công cụ hỗ trợ Mermaid (GitHub, Notion, VS Code, v.v.).

Để bất kỳ câu hỏi hoặc cập nhật nào, vui lòng liên hệ với team Backend Architecture.
