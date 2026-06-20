# SRS — Software Requirement Specification
## Module: Payment (Thanh toán)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-20  
> **Tham chiếu:** [Order/SRS.md](../Order/SRS.md)

---

## 1. Phạm vi hệ thống

Module Payment cung cấp các chức năng:
- Lấy thông tin thanh toán cho đơn hàng chuyển khoản (VietQR + thông tin ngân hàng)
- Xử lý webhook từ SePay để tự động xác nhận thanh toán
- Thống kê thanh toán cho dashboard admin (doanh thu, chờ thanh toán, hoàn tiền)

**Ngoài phạm vi:** Xử lý thanh toán trực tiếp (gateway integration), hoàn tiền tự động, tích hợp ngân hàng khác SePay.

---

## 2. Yêu cầu chức năng (Functional Requirements)

### FR-01: Lấy thông tin thanh toán QR

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-01 |
| **Tên** | Lấy thông tin thanh toán cho đơn hàng chuyển khoản |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/orders/:id/payment` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `id` (string, required): ID đơn hàng (path parameter)

**Xử lý:**
1. Lấy `userId` từ JWT token
2. Query Order theo `orderId` và `userId` (ownership check)
3. Validate đơn hàng tồn tại
4. Validate `paymentMethod == BANK_TRANSFER`
5. Validate `paymentStatus == UNPAID` (chưa thanh toán)
6. Lấy `orderCode`, `total` từ đơn hàng
7. Generate VietQR URL:
   - Format: `https://img.vietqr.io/image/{BANK_ID}-{ACCOUNT_NO}-compact2.jpg`
   - Query params: `amount`, `addInfo` (orderCode), `accountName`
8. Trả về `200` + `{ bankId, accountNo, accountName, amount, content, qrUrl }`

**Đầu ra thành công:** `200` + payment info object

```json
{
  "bankId": "MB",
  "accountNo": "0123456789",
  "accountName": "NGUYEN VAN A",
  "amount": 500000,
  "content": "ORD-20240620-A1B2C3",
  "qrUrl": "https://img.vietqr.io/image/MB-0123456789-compact2.jpg?amount=500000&addInfo=ORD-20240620-A1B2C3&accountName=NGUYEN+VAN+A"
}
```

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Đơn hàng không tồn tại | 404 | `Đơn hàng không tồn tại` |
| Không có token JWT | 401 | `Unauthorized` |
| Đơn hàng không phải BANK_TRANSFER | 400 | `Đơn hàng không dùng phương thức chuyển khoản ngân hàng` |
| Đơn hàng đã thanh toán | 400 | `Đơn hàng đã được thanh toán` |

---

### FR-02: Xử lý webhook SePay

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-02 |
| **Tên** | Xử lý webhook thanh toán từ SePay |
| **Ưu tiên** | Cao |
| **Endpoint** | `POST /api/webhooks/sepay` |
| **Auth** | Webhook secret (x-sepay-secret header) |

**Đầu vào:** SePayWebhookPayload

```typescript
{
  id: number
  gateway: string
  transactionDate: string  // Format: "YYYY-MM-DD HH:mm:ss"
  accountNumber: string
  subAccount: string | null
  code: string | null
  content: string          // Nội dung chuyển khoản (có chứa orderCode)
  transferType: 'in' | 'out'
  transferAmount: number   // Số tiền chuyển (VND)
  accumulated: number
  referenceCode: string
  description: string
  body: string
}
```

**Xử lý:**
1. **Security Check:** Validate `x-sepay-secret` header vs `SEPAY_WEBHOOK_SECRET` env var
2. **Filter Incoming:** Check `transferType == 'in'` (chỉ nhận tiền vào)
3. **Extract Order Code:** Parse `content` bằng regex `/ORD-\d{8}-[0-9A-F]{6}/i`
4. **Early Return (Idempotency):** Nếu không match regex → return `{ handled: false }`
5. Query Order theo `orderCode` (unique index)
6. **Idempotency Check:** Nếu order không tồn tại hoặc `paymentStatus == PAID` → return `{ handled: false }`
7. **Amount Validation:** So sánh `transferAmount` === `order.total`
8. **Date Validation:** Parse `transactionDate` → validate `!isNaN(date.getTime())`
9. **Update Order:**
   - Set `paymentStatus = PAID`
   - Set `paidAt = transactionDate`
   - Nếu `status == PENDING` → set `status = CONFIRMED`
10. Trả về `200` + `{ success: true, handled: true, orderCode }`

**Đầu ra thành công:** `200` + webhook response

```json
{
  "success": true,
  "handled": true,
  "orderCode": "ORD-20240620-A1B2C3"
}
```

**Idempotency Returns (không lỗi):**

| Điều kiện | Response |
|---|---|
| `transferType == 'out'` | `200` + `{ handled: false }` |
| Không tìm thấy orderCode trong content | `200` + `{ handled: false }` |
| Order không tồn tại | `200` + `{ handled: false }` |
| Order đã thanh toán (PAID) | `200` + `{ handled: false }` |
| Số tiền không khớp | `200` + `{ handled: false }` |
| Ngày giao dịch không hợp lệ | `200` + `{ handled: false }` |

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Thiếu header `x-sepay-secret` | 401 | `Webhook secret không hợp lệ` |
| Secret không đúng | 401 | `Webhook secret không hợp lệ` |
| Payload JSON không hợp lệ | 400 | `Payload không hợp lệ` |

**Regex Pattern:**
```
/ORD-\d{8}-[0-9A-F]{6}/i
```
- `ORD-`: Prefix cố định
- `\d{8}`: 8 chữ số (YYYYMMDD)
- `-`: Dấu phân cách
- `[0-9A-F]{6}`: 6 ký tự hex (ngẫu nhiên)
- `i`: Case-insensitive

---

### FR-03: Thống kê thanh toán (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-03 |
| **Tên** | Thống kê thanh toán cho dashboard admin |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `GET /api/admin/payment/stats` |
| **Auth** | STAFF+ |

**Đầu vào:** Không có

**Xử lý:**
1. **Parallel Aggregation** (4 queries song song):
   - `paidAgg`: Sum + Count orders với `paymentStatus = PAID` → `revenue`
   - `unpaidAgg`: Sum + Count orders với `paymentStatus = UNPAID` → `pending`
   - `refundedAgg`: Sum + Count orders với `paymentStatus = REFUNDED` → `refunded`
   - `awaitingAgg`: Sum + Count orders với `paymentStatus = UNPAID` AND `paymentMethod = BANK_TRANSFER` → `awaitingBankTransfer`
2. Convert `Prisma.Decimal` → `number` cho mỗi `total`
3. Trả về `200` + stats object

**Đầu ra thành công:** `200` + stats object

```json
{
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
```

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có token JWT | 401 | `Unauthorized` |
| Không phải STAFF/ADMIN | 403 | `Forbidden` |

---

## 3. Yêu cầu phi chức năng (Non-Functional Requirements)

### NFR-01: Hiệu năng

| Chỉ tiêu | Giá trị |
|---|---|
| Lấy thông tin thanh toán QR | < 200ms (p95) |
| Xử lý webhook SePay | < 500ms (p95) |
| Thống kê thanh toán | < 300ms (p95) |
| Webhook idempotency check | < 50ms (p95) |

---

### NFR-02: Bảo mật

| Yêu cầu | Mô tả |
|---|---|
| Webhook secret | Validate `x-sepay-secret` header cho mọi webhook request |
| Ownership check | Customer chỉ xem được payment info của order mình tạo |
| Admin endpoints | Yêu cầu role STAFF+ cho thống kê |
| Secret management | Lưu `SEPAY_WEBHOOK_SECRET` trong env var, không commit vào code |
| Bank info protection | Bank account info chỉ expose qua API, không log ra console/file |

---

### NFR-03: Độ tin cậy

| Yêu cầu | Giá trị |
|---|---|
| Uptime | ≥ 99.9% |
| Webhook idempotency | Đảm bảo webhook được xử lý đúng 1 lần duy nhất |
| Idempotency strategy | Early return nếu order đã PAID hoặc không tồn tại |
| No data loss | Webhook luôn return 200 (không throw error) để SePay không retry |

---

### NFR-04: Khả năng bảo trì

| Yêu cầu | Mô tả |
|---|---|
| Order code regex | Compile once tại module load, không compile lại mỗi request |
| Env var defaults | Fallback về empty string nếu env var thiếu (fail gracefully) |
| Decimal handling | Helper function `toAmount()` convert Prisma.Decimal → number |

---

### NFR-05: Scalability

| Yêu cầu | Giá trị |
|---|---|
| Concurrent webhooks | Xử lý 100+ webhook requests đồng thời |
| Parallel aggregation | 4 aggregation queries chạy song song (Promise.all) |
| Index coverage | Index trên `orderCode`, `paymentStatus`, `paymentMethod` |

---

## 4. Yêu cầu dữ liệu

### 4.1 Enum PaymentMethod

```prisma
enum PaymentMethod {
  COD              // Thanh toán khi nhận hàng
  BANK_TRANSFER    // Chuyển khoản ngân hàng (VietQR + SePay webhook)
}
```

---

### 4.2 Enum PaymentStatus

```prisma
enum PaymentStatus {
  UNPAID    // Chưa thanh toán
  PAID      // Đã thanh toán
  REFUNDED  // Đã hoàn tiền
}
```

---

### 4.3 Bảng Order (liên quan)

| Trường | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `VARCHAR` (UUID) | PK, auto-generated | ID đơn hàng |
| `orderCode` | `VARCHAR` | **unique**, not null | Mã đơn hàng (format: `ORD-YYYYMMDD-XXXXXX`) |
| `userId` | `VARCHAR` | FK → User.id, not null | ID user tạo đơn |
| `total` | `DECIMAL(12,2)` | not null | Tổng tiền đơn hàng |
| `paymentMethod` | `PaymentMethod` | not null, default: COD | Phương thức thanh toán |
| `paymentStatus` | `PaymentStatus` | not null, default: UNPAID | Trạng thái thanh toán |
| `paidAt` | `TIMESTAMPTZ` | nullable | Thời gian thanh toán |
| `status` | `OrderStatus` | not null, default: PENDING | Trạng thái đơn hàng |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (orderCode)` — cho webhook lookup nhanh
- `INDEX (userId)` — cho ownership check
- `INDEX (paymentStatus)` — cho thống kê
- `INDEX (paymentMethod)` — cho thống kê
- `INDEX (status)` — cho update order status

---

### 4.4 Order Code Format

```
ORD-YYYYMMDD-XXXXXX
```

- `ORD-`: Prefix cố định
- `YYYYMMDD`: Ngày tạo đơn (20240620)
- `XXXXXX`: 6 ký tự hex (ngẫu nhiên, case-insensitive)

**Regex:** `/ORD-\d{8}-[0-9A-F]{6}/i`

**Ví dụ:**
- `ORD-20240620-A1B2C3`
- `ORD-20240620-1a2b3c`
- `ord-20240620-abcdef` (case-insensitive)

---

## 5. Môi trường & Cấu hình

| Biến môi trường | Mô tả | Ràng buộc |
|---|---|---|
| `SEPAY_BANK_ID` | Mã ngân hàng (VD: "MB") | Required |
| `SEPAY_ACCOUNT_NUMBER` | Số tài khoản ngân hàng | Required |
| `SEPAY_ACCOUNT_NAME` | Tên chủ tài khoản | Required |
| `SEPAY_WEBHOOK_SECRET` | Secret để verify webhook từ SePay | Required |

**Lưu ý:**
- Các env var này được load tại module load time, không thay đổi runtime
- Nếu thiếu, fallback về empty string → webhook sẽ fail authentication

---

## 6. Phụ thuộc

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| `@prisma/client` | latest | ORM tương tác DB |
| `express` | latest | Web framework |
| `helpers/app_error` | local | Custom error handling |
| `helpers/async_handler` | local | Async error wrapper |
| `helpers/response` | local | Standardized response format |

---

## 7. Error Handling

### 7.1 HTTP Status Codes

| Code | Khi nào dùng |
|---|---|
| `200` | Thành công (GET payment info, webhook processed, stats) |
| `400` | Validation error (payment method, payment status) |
| `401` | Không xác thực (thiếu JWT, webhook secret invalid) |
| `403` | Không đủ quyền (customer call admin endpoint) |
| `404` | Không tìm thấy (order không tồn tại) |

### 7.2 Error Response Format

```json
{
  "message": "Đơn hàng không tồn tại"
}
```

hoặc

```json
{
  "message": "Webhook secret không hợp lệ"
}
```

### 7.3 Webhook Error Strategy

**Critical:** Webhook endpoint KHÔNG BAO GIỜ throw error

- Return `200` + `{ handled: false }` cho tất cả trường hợp không thể xử lý
- Chỉ return `401` nếu secret sai (để SePay block malicious requests)
- Đảm bảo SePay không retry vô hạn khi webhook fail

---

## 8. Testing Requirements

### 8.1 Unit Tests

- `buildQrUrl()` function: Generate đúng URL VietQR
- Order code regex match: Match đúng pattern, case-insensitive
- Amount validation: So sánh chính xác `transferAmount === total`
- Date validation: Parse đúng `transactionDate`, detect invalid date
- `toAmount()` helper: Convert Prisma.Decimal → number đúng

### 8.2 Integration Tests

- **Get payment info:** 
  - Trả về đúng bank info, QR URL cho BANK_TRANSFER order
  - Fail với 400 nếu order là COD
  - Fail với 400 nếu order đã PAID
  - Fail với 404 nếu order không tồn tại hoặc không thuộc user
  
- **Process webhook:**
  - Process thành công nếu transferAmount === total
  - Bỏ qua nếu transferType === 'out'
  - Bỏ qua nếu không match orderCode regex
  - Bỏ qua nếu order không tồn tại
  - Bỏ qua nếu order đã PAID (idempotency)
  - Update order status từ PENDING → CONFIRMED
  - Validate webhook secret

- **Stats:**
  - Return đúng revenue (sum PAID orders)
  - Return đúng pending stats (UNPAID orders)
  - Return đúng refunded stats (REFUNDED orders)
  - Return đúng awaitingBankTransfer (BANK_TRANSFER + UNPAID)

### 8.3 E2E Tests

- **Flow:** Tạo order BANK_TRANSFER → Get payment info → User chuyển tiền → Webhook gọi → Order PAID + CONFIRMED
- **Flow:** Webhook gọi 2 lần → Chỉ update lần đầu, lần 2 return handled=false (idempotency)
- **Flow:** Webhook với sai secret → Return 401, không update order
- **Flow:** Webhook với số tiền sai → Return handled=false, không update order

---

## 9. Migration & Rollback

### 9.1 Database Migration

- Thêm index `UNIQUE (orderCode)` nếu chưa có
- Thêm index `paymentStatus`, `paymentMethod` nếu chưa có
- Migrate data từ hệ thống cũ (nếu có):
  - Convert existing payment codes to new format
  - Backfill `orderCode` cho orders cũ

### 9.2 Rollback Plan

- Revert code deployment
- Restore DB backup (nếu schema change)
- Reprocess webhooks từ SePay trong khoảng thời gian rollback (reconciliation)
- Không có data migration phức tạp, chỉ add index

---

## 10. Architecture Decision Records

### ADR-001: Idempotent Webhook Processing

**Context:** SePay có thể gửi cùng 1 webhook nhiều lần (network retry, timeout)

**Decision:** 
- Webhook luôn return `200` với `handled: true/false` flag
- Early return nếu order đã PAID hoặc không tồn tại
- Không throw error cho webhook logic

**Consequences:**
- **Pro:** Đảm bảo không duplicate payment, không data corruption
- **Pro:** SePay không retry vô hạn
- **Con:** Cần log để track webhook không matched (debugging)

---

### ADR-002: Webhook Security via Secret Header

**Context:** Webhook endpoint public, cần verify authenticity

**Decision:** Validate `x-sepay-secret` header vs env var

**Consequences:**
- **Pro:** Đơn giản, dễ implement
- **Pro:** Không cần signature verification phức tạp
- **Con:** Secret bị leak → attacker có thể spoof webhook
- **Mitigation:** Rotate secret định kỳ, không commit vào git

---

### ADR-003: Parallel Aggregation for Stats

**Context:** Stats endpoint cần aggregate 4 queries, latency concern

**Decision:** Use `Promise.all()` để chạy 4 aggregation queries song song

**Consequences:**
- **Pro:** Latency ~ max(query_time) thay vì sum(query_time)
- **Pro:** Better UX cho admin dashboard
- **Con:** DB load cao hơn (4 queries cùng lúc)
- **Mitigation:** Cache stats response (nếu cần)

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-20  
> **Next Review:** After integration test complete
