# Sơ Đồ Hoạt Động Module Thanh Toán - Payment Module Activity Diagrams

**Tài liệu:** Sơ đồ hoạt động chi tiết cho các workflow thanh toán  
**Phiên bản:** 1.0  
**Ngày:** 2026-06-20  
**Người tạo:** Workflow Architect

---

## Nội Dung

1. [Lấy Thông Tin Thanh Toán QR - GET /api/orders/:id/payment](#workflow-1-lấy-thông-tin-thanh-toán-qr)
2. [Xử Lý Webhook SePay - POST /api/webhooks/sepay](#workflow-2-xử-lý-webhook-sepay)
3. [Lấy Thống Kê Thanh Toán - GET /api/admin/payment/stats](#workflow-3-lấy-thống-kê-thanh-toán)
4. [So Sánh Các Workflow](#so-sánh-cross-workflow-analysis)
5. [Chiến Lược Xử Lý - Handling Strategies](#chiến-lược-xử-lý)

---

## Workflow 1: Lấy Thông Tin Thanh Toán QR

### Tổng Quan

Khách hàng lấy thông tin chuyển khoản ngân hàng (VietQR, thông tin tài khoản) để thanh toán đơn hàng. Endpoint này chỉ hoạt động với đơn hàng sử dụng phương thức chuyển khoản (`BANK_TRANSFER`) và chưa thanh toán.

**Endpoint:** `GET /api/orders/:id/payment`  
**Yêu cầu authentication:** Bắt buộc (Bearer token)  
**Mục tiêu sinh:** Trả về thông tin tài khoản ngân hàng + URL mã VietQR  
**Performance target:** < 200ms

---

### Sơ Đồ Hoạt Động (Mermaid)

```mermaid
flowchart TD
    subgraph Customer["Khách Hàng"]
        START([Bắt đầu]) --> GET_REQ[Gửi GET request<br/>/api/orders/:id/payment]
        GET_REQ --> AUTH_HEADER[Header Authorization:<br/>Bearer {token}]
    end

    subgraph API["API Layer"]
        AUTH_HEADER --> AUTH{Xác thực JWT}
        AUTH -->|Token hợp lệ| VALIDATE_ID
        AUTH -->|Token thiếu/không hợp lệ| ERR_401[Return 401 Unauthorized]
        
        VALIDATE_ID[Kiểm tra orderId có phải<br/>UUID hợp lệ không]
        VALIDATE_ID --> ERR_404_EMPTY[Return 404<br/>OrderId không tồn tại]
    end

    subgraph Service["Service Layer"]
        VALIDATE_ID --> QUERY_DB[Query DB:<br/>SELECT * FROM orders<br/>WHERE id=:orderId<br/>AND userId=:userId]
        
        QUERY_DB --> ORDER_EXISTS{Đơn hàng<br/>tồn tại?}
        ORDER_EXISTS -->|Không| ERR_404[Return 404<br/>Đơn hàng không tồn tại]
        ORDER_EXISTS -->|Có| CHECK_METHOD
        
        CHECK_METHOD{paymentMethod<br/>=== BANK_TRANSFER?}
        CHECK_METHOD -->|Không (COD)| ERR_400_METHOD[Return 400<br/>Đơn hàng không dùng chuyển khoản]
        CHECK_METHOD -->|Có| CHECK_STATUS
        
        CHECK_STATUS{paymentStatus<br/>=== PAID?}
        CHECK_STATUS -->|Đã thanh toán| ERR_400_PAID[Return 400<br/>Đơn hàng đã được thanh toán]
        CHECK_STATUS -->|Chưa thanh toán| BUILD_QR
        
        BUILD_QR[Xây dựng VietQR URL:<br/>https://img.vietqr.io/image/<br/>{bankId}-{accountNo}-compact2.jpg?<br/>amount={total}&addInfo={orderCode}&<br/>accountName={ACCOUNT_NAME}]
        
        BUILD_QR --> FORMAT_RESP[Format response:<br/>bankId, accountNo,<br/>accountName, amount,<br/>content (orderCode), qrUrl]
    end

    subgraph Database["Database"]
        QUERY_DB -.-> |Prisma.order.findFirst| DB_FETCH1[(Lấy đơn hàng)]
        DB_FETCH1 --> RETURN_ORDER1[Return order object]
    end

    subgraph Response["Phản Hồi"]
        FORMAT_RESP --> SUCCESS_200[Return 200 OK<br/>Thông tin thanh toán QR]
        ERR_401 --> END_CLIENT([Kết thúc - Client nhận lỗi])
        ERR_404 --> END_CLIENT
        ERR_400_METHOD --> END_CLIENT
        ERR_400_PAID --> END_CLIENT
        SUCCESS_200 --> END_SUCCESS([Kết thúc - Client<br/>hiển thị mã QR])
    end

    RETURN_ORDER1 --> ORDER_EXISTS
```

---

### Chi Tiết Các Node Quyết Định

#### 1. Xác thực JWT (AUTH)

**Đầu vào:** Header `Authorization: Bearer {token}`

**Logic:**
- Giải mã JWT token bằng `jsonwebtoken.verify()`
- Trích xuất `userId` từ payload
- Attach `req.user = { userId, email, role }`

**Thất bại → Return 401:**
```json
{
  "ok": false,
  "message": "Token không hợp lệ hoặc đã hết hạn"
}
```

---

#### 2. Kiểm tra đơn hàng tồn tại (ORDER_EXISTS)

**Logic:**
```typescript
const order = await prisma.order.findFirst({
  where: { id: orderId, userId },
  select: { id, orderCode, total, paymentMethod, paymentStatus }
})
```

**Thất bại → Return 404:**
```json
{
  "ok": false,
  "message": "Đơn hàng không tồn tại"
}
```

**Lưu ý:** Double-check cả `orderId` và `userId` để ngăn customer xem đơn hàng của người khác.

---

#### 3. Validate phương thức thanh toán (CHECK_METHOD)

**Logic:**
```typescript
if (order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
  throw new AppError(400, 'Đơn hàng không dùng phương thức chuyển khoản ngân hàng')
}
```

**Tại sao cần check:** Endpoint này chỉ phục vụ chuyển khoản ngân hàng. Đơn COD không cần VietQR.

---

#### 4. Validate trạng thái thanh toán (CHECK_STATUS)

**Logic:**
```typescript
if (order.paymentStatus === PaymentStatus.PAID) {
  throw new AppError(400, 'Đơn hàng đã được thanh toán')
}
```

**Lưu ý:** Nếu đơn đã PAID, customer không cần thấy mã QR nữa. Tránh nhầm lẫn.

---

#### 5. Xây dựng VietQR URL (BUILD_QR)

**Logic:**
```typescript
const params = new URLSearchParams({
  amount: String(amount),
  addInfo: orderCode,
  accountName: ACCOUNT_NAME
})
return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.jpg?${params}`
```

**Giải thích:**
- `compact2.jpg`: Format nhỏ gọn, phù hợp mobile
- `amount`: Số tiền cần chuyển
- `addInfo`: Nội dung chuyển khoản (orderCode) để đối soát
- `accountName`: Tên chủ tài khoản hiển thị trên QR

**Environment variables cần thiết:**
```env
SEPAY_BANK_ID=VCB
SEPAY_ACCOUNT_NUMBER=1234567890
SEPAY_ACCOUNT_NAME=NGUYEN VAN A
```

---

### Các Đường Dẫn Error

| Error Code | Trigger | Message | Client Action |
|------------|---------|---------|---------------|
| 401 | Thiếu Authorization header hoặc token không hợp lệ | "Token không hợp lệ" | Login lại để lấy token mới |
| 404 | OrderId không tồn tại hoặc không thuộc về userId | "Đơn hàng không tồn tại" | Quay lại danh sách đơn hàng |
| 400 (method) | paymentMethod !== BANK_TRANSFER | "Đơn hàng không dùng chuyển khoản" | Sử dụng endpoint phù hợp (nếu có) |
| 400 (status) | paymentStatus === PAID | "Đơn hàng đã được thanh toán" | Xem chi tiết đơn hàng, không cần thanh toán lại |

---

### Observable States

| State | Customer thấy | Database | Logs |
|-------|---------------|----------|------|
| Authentication | Loading spinner | - | `[auth] Verifying JWT token` |
| Querying DB | Loading spinner | `SELECT ... WHERE id=x` | `[db] Fetching order order-1` |
| Validation success | Mã QR hiển thị + thông tin tài khoản | - | `[payment] QR built for order-1` |
| Validation failed | Error message hiển thị | - | `[payment] Validation failed: {reason}` |

---

## Workflow 2: Xử Lý Webhook SePay

### Tổng Quan

SePay gọi webhook này khi phát hiện giao dịch chuyển khoản mới. Webhook được xử lý idempotent (có thể gọi lại nhiều lần an toàn) và thực hiện nhiều validation gates trước khi cập nhật trạng thái đơn hàng.

**Endpoint:** `POST /api/webhooks/sepay`  
**Yêu cầu authentication:** Header `x-sepay-secret` (không dùng JWT)  
**Mục tiêu sinh:** Cập nhật `paymentStatus=PAID` và tự động `status=CONFIRMED` (nếu đang `PENDING`)  
**Performance target:** < 300ms (nhưng có thể retry nếu timeout)  
**Tính chất:** Idempotent (an toàn khi gọi lại nhiều lần)

---

### Sơ Đồ Hoạt Động (Mermaid)

```mermaid
flowchart TD
    subgraph SePay["SePay Service"]
        START([Bắt đầu]) --> WEBHOOK_CALL[Gọi POST /api/webhooks/sepay]
        WEBHOOK_CALL --> ADD_HEADERS[Header x-sepay-secret:<br/>{WEBHOOK_SECRET}]
    end

    subgraph API["API Layer"]
        ADD_HEADERS --> VERIFY_SECRET{Secret khớp với<br/>env SEPAY_WEBHOOK_SECRET?}
        VERIFY_SECRET -->|Không khớp| ERR_401[Return 401 Unauthorized<br/>Webhook secret không hợp lệ]
        VERIFY_SECRET -->|Khớp| PARSE_BODY[Parse JSON body<br/>SePayWebhookPayload]
    end

    subgraph Service["Service Layer"]
        PARSE_BODY --> VALIDATE_TYPE{transferType<br/>=== 'in'?}
        
        VALIDATE_TYPE -->|out (chuyển đi)| SKIP_1[Return handled: false<br/>Bỏ qua giao dịch chuyển đi]
        VALIDATE_TYPE -->|in (nhận tiền)| PARSE_CODE
        
        PARSE_CODE[Parse orderCode từ content<br/>sử dụng regex:<br/>/ORD-\\d{8}-[0-9A-F]{6}/i]
        PARSE_CODE --> CODE_FOUND{Regex match<br/>thành công?}
        
        CODE_FOUND -->|Không tìm thấy| SKIP_2[Return handled: false<br/>Bỏ qua không có orderCode]
        CODE_FOUND -->|Tìm thấy orderCode| QUERY_ORDER
        
        QUERY_ORDER[Query DB:<br/>SELECT * FROM orders<br/>WHERE orderCode = :orderCode]
        QUERY_ORDER --> ORDER_EXISTS{Đơn hàng<br/>tồn tại?}
        
        ORDER_EXISTS -->|Không| SKIP_3[Return handled: false<br/>Bỏ qua đơn không tồn tại]
        ORDER_EXISTS -->|Có| CHECK_PAID
        
        CHECK_PAID{paymentStatus<br/>=== PAID?}
        CHECK_PAID -->|Đã thanh toán| SKIP_4[Return handled: false<br/>Bỏ qua đơn đã thanh toán]
        CHECK_PAID -->|Chưa thanh toán| VALIDATE_AMOUNT
        
        VALIDATE_AMOUNT{transferAmount<br/>=== order.total?}
        VALIDATE_AMOUNT -->|Sai số tiền| SKIP_5[Return handled: false<br/>Bỏ qua số tiền không khớp]
        VALIDATE_AMOUNT -->|Khớp| VALIDATE_DATE
        
        VALIDATE_DATE[Parse transactionDate<br/>new Date payload.transactionDate]
        VALIDATE_DATE --> DATE_VALID{Ngày hợp lệ?<br/>!isNaN date.getTime}
        DATE_VALID -->|Ngày không hợp lệ| SKIP_6[Return handled: false<br/>Bỏ qua ngày không hợp lệ]
        DATE_VALID -->|Ngày hợp lệ| UPDATE_ORDER
        
        UPDATE_ORDER[UPDATE orders SET:<br/>paymentStatus = PAID,<br/>paidAt = transactionDate,<br/>status = CONFIRMED<br/>(chỉ nếu status=PENDING)]
        UPDATE_ORDER --> LOG_SUCCESS
    end

    subgraph Database["Database"]
        QUERY_ORDER -.-> |Prisma.order.findUnique| DB_FETCH1[(Lấy đơn hàng theo orderCode)]
        DB_FETCH1 --> RETURN_ORDER1[Return order object]
        
        UPDATE_ORDER -.-> |Prisma.order.update| DB_UPDATE1[(Cập nhật đơn hàng)]
        DB_UPDATE1 --> RETURN_UPDATED[Return updated order]
    end

    subgraph Response["Phản Hồi"]
        LOG_SUCCESS[Ghi log:<br/>[webhook] Processed payment<br/>for orderCode]
        LOG_SUCCESS --> SUCCESS_200[Return 200 OK<br/>{ handled: true, orderCode }]
        
        ERR_401 --> END_SEPAY([Kết thúc - SePay nhận lỗi])
        SKIP_1 --> END_SKIP([Kết thúc - Webhook bỏ qua])
        SKIP_2 --> END_SKIP
        SKIP_3 --> END_SKIP
        SKIP_4 --> END_SKIP
        SKIP_5 --> END_SKIP
        SKIP_6 --> END_SKIP
        SUCCESS_200 --> END_SUCCESS([Kết thúc - SePay ghi nhận<br/>xử lý thành công])
    end

    RETURN_ORDER1 --> ORDER_EXISTS
    RETURN_UPDATED --> LOG_SUCCESS
```

---

### Chi Tiết Các Node Quyết Định

#### 1. Xác thực Secret (VERIFY_SECRET)

**Logic:**
```typescript
export function verifySePaySecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.SEPAY_WEBHOOK_SECRET
  if (!secret || req.headers['x-sepay-secret'] !== secret) {
    sendError(res, 401, 'Webhook secret không hợp lệ')
    return
  }
  next()
}
```

**Tại sao không dùng JWT:**
- SePay là external service, không có user session
- Secret được chia sẻ thủ công (manual setup)
- Validate ở middleware layer để fail fast

**Threat model:**
- Attacker không có secret → 401 ngay
- Attacker có secret nhưng gửi payload sai → handled: false (bỏ qua)

---

#### 2. Validate Loại Giao Dịch (VALIDATE_TYPE)

**Logic:**
```typescript
if (payload.transferType !== 'in') return { handled: false }
```

**Tại sao cần:**
- `in`: Tiền vào (customer chuyển tiền cho shop) → xử lý
- `out`: Tiền ra (shop chuyển tiền cho supplier) → bỏ qua

**Idempotency:**
- Nếu SePay gửi lại webhook với transferType 'out' → luôn trả về handled: false
- Không có side effect

---

#### 3. Parse Order Code (PARSE_CODE)

**Logic:**
```typescript
const ORDER_CODE_RE = /ORD-\d{8}-[0-9A-F]{6}/i
const match = payload.content.match(ORDER_CODE_RE)
if (!match) return { handled: false }
const orderCode = match[0].toUpperCase()
```

**Ví dụ:**
- Content: `"Thanh toan ORD-20240101-AABBCC"` → Match: `ORD-20240101-AABBCC`
- Content: `"Chuyen khoan vang lai"` → No match → Bỏ qua

**Tại sao dùng regex:**
- Customer có thể nhập nội dung tùy ý (chữ viết hoa/thường, thêm emoji)
- Order code được embed trong content → cần extract
- Regex đảm bảo format chính xác (ORD-YYYYMMDD-XXXXXX)

---

#### 4. Validate Số Tiền (VALIDATE_AMOUNT)

**Logic:**
```typescript
const expectedAmount = Number(order.total)
if (payload.transferAmount !== expectedAmount) return { handled: false }
```

**Tại sao cần:**
- Ngăn payment sai số tiền (customer chuyển thiếu hoặc dư)
- Chấp nhận chính xác tuyệt đối (no partial payment)

**Edge case:**
- Nếu customer chuyển 500,001 VNĐ thay vì 500,000 VNĐ → Bỏ qua (handled: false)
- Admin có thể manual confirm trong trường hợp đặc biệt

---

#### 5. Validate Ngày Giao Dịch (VALIDATE_DATE)

**Logic:**
```typescript
const paidAt = new Date(payload.transactionDate)
if (isNaN(paidAt.getTime())) return { handled: false }
```

**Tại sao cần:**
- Đảm bảo ngày từ SePay hợp lệ (format YYYY-MM-DD HH:mm:ss)
- Tránh DB error khi insert invalid date

---

#### 6. Cập Nhật Đơn Hàng (UPDATE_ORDER)

**Logic:**
```typescript
await prisma.order.update({
  where: { id: order.id },
  data: {
    paymentStatus: PaymentStatus.PAID,
    paidAt,
    ...(order.status === OrderStatus.PENDING && { status: OrderStatus.CONFIRMED }),
  },
})
```

**Auto-confirm logic:**
- Nếu `order.status === PENDING` → tự động chuyển sang `CONFIRMED`
- Nếu `order.status !== PENDING` (ví dụ CANCELLED) → không thay đổi status
- Đảm bảo workflow: `PENDING` → (payment received) → `CONFIRMED` → `PROCESSING`

**Idempotency:**
- Nếu webhook gọi lại sau khi đơn đã PAID → Check ở node CHECK_PAID sẽ return handled: false
- Không update lại DB, không side effect

---

### Idempotency Strategy

Webhook được thiết kế idempotent để an toàn khi:

1. **SePay gửi lại do timeout** → Hệ thống xử lý lại, return cùng kết quả
2. **SePay gửi duplicate** → Hệ thống detect đơn đã PAID → return handled: false
3. **Network glitch retry** → Không tạo duplicate records

**Idempotency checkpoints:**
- CHECK_PAID: Nếu đơn đã PAID → bỏ qua
- UPDATE_ORDER: Nếu update thành công → return handled: true (không retry nữa)

---

### Các Đường Dẫn Error

| Error Code | Trigger | Message | SePay Action |
|------------|---------|---------|--------------|
| 401 | Secret không khớp hoặc thiếu | "Webhook secret không hợp lệ" | SePay mark webhook failed, không retry |
| 200 (skip) | transferType !== 'in' | { handled: false } | SePay ghi nhận nhưng không mark success |
| 200 (skip) | Không tìm thấy orderCode trong content | { handled: false } | Bỏ qua |
| 200 (skip) | Đơn hàng không tồn tại theo orderCode | { handled: false } | Bỏ qua |
| 200 (skip) | Đơn hàng đã thanh toán rồi | { handled: false } | Idempotent, bỏ qua |
| 200 (skip) | Số tiền không khớp | { handled: false } | Admin manual check |
| 200 (success) | Tất cả validation pass | { handled: true, orderCode } | SePay mark success |

---

### Observable States

| State | SePay thấy | Database | Logs |
|-------|-----------|----------|------|
| Secret verification | - | - | `[webhook] Verifying secret` |
| Processing | Webhook accepted | `SELECT ... WHERE orderCode=x` | `[webhook] Processing orderCode ORD-xxx` |
| Validation success | - | `UPDATE orders SET paymentStatus=PAID` | `[webhook] Payment confirmed for ORD-xxx` |
| Skip (handled: false) | Response 200 với handled: false | - | `[webhook] Skipped: transferType=out` |

---

## Workflow 3: Lấy Thống Kê Thanh Toán

### Tổng Quan

Admin lấy thống kê thanh toán cho dashboard đối soát. Endpoint này chạy 4 aggregation queries song song để tối ưu performance.

**Endpoint:** `GET /api/admin/payment/stats`  
**Yêu cầu authentication:** Bắt buộc + Role-based access (STAFF hoặc ADMIN)  
**Mục tiêu sinh:** Thống kê 4 metrics: revenue, pending, refunded, awaitingBankTransfer  
**Performance target:** < 500ms (4 queries song song)

---

### Sơ Đồ Hoạt Động (Mermaid)

```mermaid
flowchart TD
    subgraph Admin["Admin User"]
        START([Bắt đầu]) --> GET_REQ[Gọi GET /api/admin/payment/stats]
        GET_REQ --> AUTH_HEADER[Header Authorization:<br/>Bearer {admin_token}]
    end

    subgraph API["API Layer"]
        AUTH_HEADER --> AUTH{Xác thực JWT}
        AUTH -->|Token hợp lệ| CHECK_ROLE{Role === STAFF<br/>|| ADMIN?}
        AUTH -->|Token không hợp lệ| ERR_401[Return 401 Unauthorized]
        
        CHECK_ROLE -->|Role không đủ| ERR_403[Return 403 Forbidden<br/>Không có quyền truy cập]
        CHECK_ROLE -->|Role đủ| CALL_SERVICE
    end

    subgraph Service["Service Layer"]
        CALL_SERVICE[getPaymentStats()<br/>Khởi tạo 4 aggregation queries]
        
        CALL_SERVICE --> PARALLEL Queries
        
        subgraph PARALLEL["4 Queries Song Song"]
            PAID_QUERY[Query 1:<br/>Aggregate WHERE paymentStatus=PAID<br/>_sum.total, _count]
            UNPAID_QUERY[Query 2:<br/>Aggregate WHERE paymentStatus=UNPAID<br/>_sum.total, _count]
            REFUNDED_QUERY[Query 3:<br/>Aggregate WHERE paymentStatus=REFUNDED<br/>_sum.total, _count]
            AWAITING_QUERY[Query 4:<br/>Aggregate WHERE paymentStatus=UNPAID<br/>AND paymentMethod=BANK_TRANSFER<br/>_sum.total, _count]
        end
        
        PAID_QUERY --> AWAIT_ALL[Promise.all() chờ<br/>tất cả queries hoàn thành]
        UNPAID_QUERY --> AWAIT_ALL
        REFUNDED_QUERY --> AWAIT_ALL
        AWAITING_QUERY --> AWAIT_ALL
        
        AWAIT_ALL --> PARSE_RESULTS[Parse results:<br/>Convert Prisma.Decimal to number<br/>Format response object]
    end

    subgraph Database["Database"]
        PAID_QUERY -.-> |Prisma.order.aggregate| DB1[(Aggregation 1:<br/>Paid orders)]
        UNPAID_QUERY -.-> |Prisma.order.aggregate| DB2[(Aggregation 2:<br/>Unpaid orders)]
        REFUNDED_QUERY -.-> |Prisma.order.aggregate| DB3[(Aggregation 3:<br/>Refunded orders)]
        AWAITING_QUERY -.-> |Prisma.order.aggregate| DB4[(Aggregation 4:<br/>Awaiting bank transfer)]
        
        DB1 --> RETURN1[Return { _sum: { total }, _count }]
        DB2 --> RETURN2[Return { _sum: { total }, _count }]
        DB3 --> RETURN3[Return { _sum: { total }, _count }]
        DB4 --> RETURN4[Return { _sum: { total }, _count }]
    end

    subgraph Response["Phản Hồi"]
        PARSE_RESULTS --> FORMAT_RESP[Format response:<br/>revenue: number,<br/>pending: { count, amount },<br/>refunded: { count, amount },<br/>awaitingBankTransfer: { count, amount }]
        FORMAT_RESP --> SUCCESS_200[Return 200 OK<br/>Thống kê thanh toán]
        
        ERR_401 --> END_ADMIN([Kết thúc - Admin<br/>nhận lỗi])
        ERR_403 --> END_ADMIN
        SUCCESS_200 --> END_SUCCESS([Kết thúc - Admin<br/>hiển thị dashboard])
    end

    RETURN1 --> AWAIT_ALL
    RETURN2 --> AWAIT_ALL
    RETURN3 --> AWAIT_ALL
    RETURN4 --> AWAIT_ALL
```

---

### Chi Tiết Các Aggregation Queries

#### Query 1: Revenue (Đã thu)

```typescript
prisma.order.aggregate({
  where: { paymentStatus: PaymentStatus.PAID },
  _sum: { total: true },
  _count: true
})
```

**Ý nghĩa:** Tổng tiền đã thu được từ các đơn hàng đã thanh toán.

**Kết quả:** `{ _sum: { total: 15000000 }, _count: 45 }`

---

#### Query 2: Pending (Chưa thanh toán)

```typescript
prisma.order.aggregate({
  where: { paymentStatus: PaymentStatus.UNPAID },
  _sum: { total: true },
  _count: true
})
```

**Ý nghĩa:** Tổng tiền các đơn chưa thanh toán (bao gồm cả COD và BANK_TRANSFER).

**Kết quả:** `{ _sum: { total: 5000000 }, _count: 12 }`

---

#### Query 3: Refunded (Đã hoàn tiền)

```typescript
prisma.order.aggregate({
  where: { paymentStatus: PaymentStatus.REFUNDED },
  _sum: { total: true },
  _count: true
})
```

**Ý nghĩa:** Tổng tiền đã hoàn lại cho customer (đơn hủy sau khi đã thanh toán).

**Kết quả:** `{ _sum: { total: 1000000 }, _count: 3 }`

---

#### Query 4: Awaiting Bank Transfer (Chờ đối soát)

```typescript
prisma.order.aggregate({
  where: {
    paymentStatus: PaymentStatus.UNPAID,
    paymentMethod: PaymentMethod.BANK_TRANSFER
  },
  _sum: { total: true },
  _count: true
})
```

**Ý nghĩa:** Các đơn dùng chuyển khoản nhưng chưa nhận webhook SePay → có thể customer đã chuyển nhưng hệ thống chưa nhận.

**Use case:** Admin cần manually đối soát với ngân hàng nếu số lượng này cao.

**Kết quả:** `{ _sum: { total: 2000000 }, _count: 5 }`

---

### Parallel Execution Strategy

**Logic:**
```typescript
const [paidAgg, unpaidAgg, refundedAgg, awaitingAgg] = await Promise.all([
  prisma.order.aggregate(...),  // Query 1
  prisma.order.aggregate(...),  // Query 2
  prisma.order.aggregate(...),  // Query 3
  prisma.order.aggregate(...),  // Query 4
])
```

**Tại sao chạy song song:**
- 4 queries độc lập, không phụ thuộc nhau
- Thời gian tổng ≈ max(query_time) thay vì sum(query_time)
- Nếu mỗi query mất 100ms → song song mất ~100ms, tuần tự mất 400ms

**Database impact:**
- 4 concurrent connections trong thời gian ngắn
- Nếu DB bị overload → có thể switch sang sequential

---

### Response Format

```json
{
  "ok": true,
  "content": {
    "revenue": 15000000,
    "pending": {
      "count": 12,
      "amount": 5000000
    },
    "refunded": {
      "count": 3,
      "amount": 1000000
    },
    "awaitingBankTransfer": {
      "count": 5,
      "amount": 2000000
    }
  }
}
```

---

### Các Đường Dẫn Error

| Error Code | Trigger | Message | Admin Action |
|------------|---------|---------|--------------|
| 401 | Thiếu Authorization header hoặc token không hợp lệ | "Token không hợp lệ" | Login lại |
| 403 | Role !== STAFF && !== ADMIN | "Không có quyền truy cập" | Contact admin để cấp quyền |

**Không có lỗi 500:**
- Aggregation queries luôn return kết quả (dù là 0)
- Không throw exception nếu không có orders

---

### Observable States

| State | Admin thấy | Database | Logs |
|-------|-----------|----------|------|
| Authentication | Loading spinner | - | `[auth] Verifying JWT token` |
| Role check | Loading spinner | - | `[auth] Checking role: ADMIN` |
| Querying (parallel) | Loading spinner | 4 queries concurrently | `[db] Running 4 aggregations in parallel` |
| Success | Dashboard hiển thị 4 metrics | - | `[stats] Payment stats computed` |

---

## So Sánh Cross-Workflow Analysis

### Bảng So Sánh 3 Workflow

| Tính chất | Get Payment QR | Process Webhook | Get Stats |
|-----------|----------------|-----------------|-----------|
| **Endpoint** | GET /api/orders/:id/payment | POST /api/webhooks/sepay | GET /api/admin/payment/stats |
| **Actor** | Customer | SePay (external service) | Admin (Staff/Admin) |
| **Authentication** | JWT (Bearer token) | Shared secret (x-sepay-secret) | JWT + Role check |
| **Authorization** | Customer chỉ xem đơn của mình | Public (có secret) | Role-based (STAFF/ADMIN) |
| **Idempotent** | Không (GET luôn idempotent) | Có (an toàn khi retry) | Không (GET luôn idempotent) |
| **Database queries** | 1 query (findFirst) | 2 queries (findUnique + update) | 4 queries (parallel aggregations) |
| **Performance target** | < 200ms | < 300ms | < 500ms |
| **Error handling** | 401, 404, 400 | 401, 200 (handled: false) | 401, 403 |
| **Side effects** | Không | Có (update paymentStatus) | Không |
| **Retry strategy** | Browser retry | SePay retry (nếu 401/timeout) | Browser retry |

---

### Common Patterns

#### 1. Authentication Pattern

**Workflow 1 & 3 (Customer-facing):**
```typescript
authenticate middleware → verify JWT → extract userId → attach to req.user
```

**Workflow 2 (Webhook):**
```typescript
verifySePaySecret middleware → compare header x-sepay-secret → no user context
```

**Điểm khác biệt:**
- Customer-facing: Session-based authentication (JWT)
- Webhook: Secret-based authentication (shared secret)

---

#### 2. Error Handling Pattern

**Workflow 1 & 3 (RESTful errors):**
```typescript
throw new AppError(404, 'Đơn hàng không tồn tại') → sendError(res, 404, message)
```

**Workflow 2 (Idempotent skips):**
```typescript
if (!isValid) return { handled: false } → res.json({ handled: false })
```

**Điểm khác biệt:**
- Customer-facing: Return error code để client handle
- Webhook: Return handled flag để SePay know outcome

---

#### 3. Database Query Pattern

**Single record fetch (Workflow 1):**
```typescript
prisma.order.findFirst({ where: { id, userId } })
```

**Lookup + Update (Workflow 2):**
```typescript
prisma.order.findUnique({ where: { orderCode } })
prisma.order.update({ where: { id }, data: { ... } })
```

**Aggregation (Workflow 3):**
```typescript
prisma.order.aggregate({ where: { ... }, _sum: { total }, _count })
```

---

### Idempotency Strategy

**Workflow 1 (GET request):**
- Idempotent theo mặc định (GET không thay đổi state)
- Browser có thể retry an toàn

**Workflow 2 (Webhook POST):**
- Thiết kế idempotent để handle SePay retry
- Checkpoints: CHECK_PAID (đơn đã PAID → skip)
- Return `handled: false` để skip mà không side effect

**Workflow 3 (GET request):**
- Idempotent theo mặc định
- Admin có thể refresh dashboard nhiều lần

---

### Security Measures

| Threat | Workflow 1 | Workflow 2 | Workflow 3 |
|--------|-----------|-----------|-----------|
| **Unauthorized access** | JWT verify 401 | Secret verify 401 | JWT + Role check 403 |
| **Data leakage** | Double-check userId trong WHERE | Public (no sensitive data) | Role check (admin only) |
| **Injection attacks** | Prisma parameterized queries | Regex escape | Prisma parameterized queries |
| **Replay attacks** | JWT expiry | Secret (rotatable) | JWT expiry |
| **DoS attacks** | Rate limit (không implemented yet) | Rate limit (không implemented yet) | Rate limit (không implemented yet) |

**Recommendations:**
- Thêm rate limiting middleware cho tất cả endpoints
- Rotate SEPAY_WEBHOOK_SECRET định kỳ
- Implement webhook signature verification (nếu SePay hỗ trợ)

---

### Performance Optimization Strategies

#### Workflow 1: Database Index

**Index cần thiết:**
```sql
CREATE INDEX idx_orders_user_id ON orders(userId);
CREATE INDEX idx_orders_id ON orders(id);
```

**Query plan:**
```
Index Seek using idx_orders_id + idx_orders_user_id → O(log n)
```

---

#### Workflow 2: Idempotency + Regex Cache

**Regex compilation (đã optimize):**
```typescript
const ORDER_CODE_RE = /ORD-\d{8}-[0-9A-F]{6}/i  // Compile once
```

**Lợi ích:**
- Không compile lại mỗi lần webhook gọi
- Faster matching

---

#### Workflow 3: Parallel Aggregations

**Sequential (bad):**
```
Query 1 (100ms) → Query 2 (100ms) → Query 3 (100ms) → Query 4 (100ms) = 400ms
```

**Parallel (good):**
```
Query 1, 2, 3, 4 concurrently = max(100ms) = 100ms
```

**Database considerations:**
- 4 concurrent connections cần thiết
- Nếu DB pool exhausted → throttle request rate

---

## Chiến Lược Xử Lý - Handling Strategies

### 1. Authentication Failures

**Workflow 1 & 3 (JWT):**
```
401 → Client thấy login form → Refresh token → Retry request
```

**Workflow 2 (Webhook secret):**
```
401 → SePay mark webhook failed → No retry → Admin fix secret
```

---

### 2. Database Connection Failures

**Workflow 1 & 3 (Read-only):**
```
DB connection error → 500 → Client retry → Admin check DB health
```

**Workflow 2 (Write operation):**
```
DB connection error → Webhook timeout → SePay retry → Xử lý lại khi DB up
```

**Recommendation:**
- Implement retry logic với exponential backoff
- Alert admin khi DB down

---

### 3. Business Logic Failures

**Workflow 1 (Validation failures):**
```
400 → Client show error message → User fix action (nếu cần)
```

**Workflow 2 (Webhook skips):**
```
200 handled: false → SePay ignore → Admin manual check
```

---

### 4. Concurrent Updates

**Workflow 2 (Race condition):**
```
Scenario: 2 webhooks cùng lúc cho 1 đơn
- Webhook A: CHECK_PAID → Chưa PAID → UPDATE → PAID
- Webhook B: CHECK_PAID → Đã PAID → Return handled: false
```

**Resolution:**
- Database update với WHERE clause đảm bảo atomicity
- CHECK_PAID chạy trước UPDATE → idempotent

---

### 5. Data Consistency

**Workflow 2 (Auto-confirm):**
```
Scenario: Webhook đến khi order status = CANCELLED
- Query trả về order với status = CANCELLED
- Logic: paymentStatus = PAID nhưng giữ status = CANCELLED (không update status)
```

**Edge case handling:**
- Admin cần manually review trường hợp này
- Có thể add alert khi có đơn PAID nhưng status = CANCELLED

---

## Kết Luận

Ba workflow này bao gồm toàn bộ lifecycle thanh toán từ lúc customer request mã QR đến khi hệ thống nhận webhook và admin thống kê đối soát. Các workflow được thiết kế với:

1. **Separation of concerns:** Mỗi workflow có một trách nhiệm rõ ràng
2. **Idempotency:** Webhook an toàn khi retry
3. **Security:** Authentication và authorization phù hợp với actor
4. **Performance:** Parallel queries để tối ưu latency
5. **Error handling:** Clear error paths cho mỗi scenario

**Document này là reference cho:**
- Backend Developer implement features
- QA Engineer viết test cases
- DevOps Engineer monitor và troubleshoot
- Product Manager hiểu user flows

---

**Next steps:**
- [ ] Implement rate limiting cho tất cả endpoints
- [ ] Add webhook signature verification
- [ ] Create alerts cho awaitingBankTransfer cao
- [ ] Document error codes cho client integration
