# Payment API - Tài liệu Đặc tả API

## Tổng quan

Module Payment quản lý thanh toán qua chuyển khoản ngân hàng với tích hợp VietQR và SePay webhook. Hệ thống hỗ trợ:

- **VietQR**: Tạo mã QR chuyển khoản nhanh cho khách hàng
- **SePay Webhook**: Xử lý tự động khi tiền được chuyển vào tài khoản
- **Dashboard Admin**: Thống kê doanh thu và trạng thái thanh toán

### Base URL
```
Production: https://api.mobivexa.com
Development: http://localhost:3000
```

### Authentication
- **JWT Token**: Bearer token trong header `Authorization`
- **Webhook Secret**: Header `x-sepay-secret` cho endpoint webhook (không cần JWT)

---

## 1. Lấy Thông tin Thanh toán QR

**GET** `/api/orders/:id/payment`

Lấy thông tin ngân hàng và mã QR VietQR để thanh toán đơn hàng.

### Authentication
```
Authorization: Bearer <ACCESS_TOKEN>
```

**Quyền hạn**: `CUSTOMER+` (Tất cả user đã đăng nhập)

### Parameters

| Name | Type | In | Description | Validation |
|------|------|-----|-------------|------------|
| id | string | path | ID đơn hàng (UUID) | UUID valid |
| - | - | - | Ownership check | `userId` trong token phải khớp với owner của đơn hàng |

### Business Logic

1. **Validation**: 
   - Đơn hàng phải tồn tại và thuộc về user đang gọi API
   - `paymentMethod` phải là `BANK_TRANSFER`
   - `paymentStatus` phải khác `PAID`

2. **Return data**:
   - Thông tin tài khoản ngân hàng nhận tiền
   - Số tiền cần thanh toán (khớp với `order.total`)
   - Mã QR VietQR để scan

### Response 200 (Success)

```json
{
  "bankId": "970415",
  "accountNo": "0987654321",
  "accountName": "PHAM VINH",
  "amount": 250000,
  "content": "ORD-20250620-3F7A2B",
  "qrUrl": "https://img.vietqr.io/image/970415-0987654321-compact2.jpg?amount=250000&addInfo=ORD-20250620-3F7A2B&accountName=PHAM+VINH"
}
```

### Response 400 (Bad Request)

```json
{
  "message": "Đơn hàng không dùng phương thức chuyển khoản ngân hàng"
}
```

HOẶC

```json
{
  "message": "Đơn hàng đã được thanh toán"
}
```

### Response 401 (Unauthorized)

```json
{
  "message": "Không có token xác thực"
}
```

HOẶC

```json
{
  "message": "Token không hợp lệ hoặc đã hết hạn"
}
```

### Response 403 (Forbidden)

```json
{
  "message": "Bạn không có quyền thực hiện thao tác này"
}
```

### Response 404 (Not Found)

```json
{
  "message": "Đơn hàng không tồn tại"
}
```

### Performance Target
- **95th percentile**: < 200ms
- **Average**: < 100ms
- **Database queries**: 1 (findFirst với index)

### Rate Limiting
- **Window**: 15 minutes
- **Max requests**: 100 requests per IP per window
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### cURL Example

```bash
curl -X GET "https://api.mobivexa.com/api/orders/550e8400-e29b-41d4-a716-446655440000/payment" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### TypeScript Types

```typescript
interface PaymentInfo {
  bankId: string        // Mã ngân hàng (VD: 970415)
  accountNo: string     // Số tài khoản nhận tiền
  accountName: string   // Tên chủ tài khoản
  amount: number        // Số tiền cần thanh toán
  content: string       // Nội dung chuyển khoản (= orderCode)
  qrUrl: string         // URL ảnh QR VietQR
}
```

---

## 2. Xử lý Webhook SePay

**POST** `/api/webhooks/sepay`

Endpoint server-to-server để SePay thông báo khi có chuyển khoản vào tài khoản.

### Authentication
```
x-sepay-secret: <WEBHOOK_SECRET>
```

**Lưu ý**: Endpoint này KHÔNG cần JWT token. Sử dụng `x-sepay-secret` để xác thực.

### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| Content-Type | string | Yes | `application/json` |
| x-sepay-secret | string | Yes | Secret key từ env `SEPAY_WEBHOOK_SECRET` |

### Request Body (SePay Webhook Payload)

```json
{
  "id": 1234567,
  "gateway": "MB",
  "transactionDate": "2025-06-20 14:30:25",
  "accountNumber": "0987654321",
  "subAccount": null,
  "code": null,
  "content": "ORD-20250620-3F7A2B",
  "transferType": "in",
  "transferAmount": 250000,
  "accumulated": 12345678,
  "referenceCode": "240620143025",
  "description": "Chuyen khoan",
  "body": null
}
```

### Validation Rules

1. **transferType**: Phải là `"in"` (chỉ xử lý tiền vào)
2. **content**: Phải chứa order code theo pattern `ORD-\d{8}-[0-9A-F]{6}` (case-insensitive)
3. **transferAmount**: Phải khớp chính xác với `order.total`
4. **transactionDate**: Phải là datetime valid
5. **Idempotent**: Nếu đơn hàng đã `PAID`, webhook sẽ return `handled: false` (không duplicate)

### Business Logic

1. Verify `x-sepay-secret` header
2. Check `transferType === "in"`
3. Extract `orderCode` từ `content` bằng regex
4. Tìm đơn hàng theo `orderCode`
5. Validate:
   - Đơn hàng tồn tại
   - Chưa thanh toán (`paymentStatus !== PAID`)
   - Số tiền khớp (`transferAmount === order.total`)
6. Update đơn hàng:
   - `paymentStatus` → `PAID`
   - `paidAt` → `transactionDate`
   - `status` → `CONFIRMED` (nếu đang `PENDING`)

### Response 200 (Success)

**Case 1: Webhook được xử lý thành công**

```json
{
  "success": true,
  "handled": true,
  "orderCode": "ORD-20250620-3F7A2B"
}
```

**Case 2: Webhook không liên quan (không xử lý)**

```json
{
  "success": true,
  "handled": false
}
```

Lý do `handled: false`:
- `transferType !== "in"`
- `content` không chứa order code hợp lệ
- Đơn hàng không tồn tại
- Đơn hàng đã thanh toán
- Số tiền không khớp
- `transactionDate` invalid

### Response 401 (Unauthorized)

```json
{
  "message": "Webhook secret không hợp lệ"
}
```

**Lý do**: `x-sepay-secret` header không khớp với `SEPAY_WEBHOOK_SECRET` trong env

### Performance Target
- **95th percentile**: < 500ms
- **Average**: < 300ms
- **Database queries**: 2 (1 SELECT, 1 UPDATE khi success)

### Rate Limiting
**KHÔNG CÓ** - Webhook endpoint không bị rate limit.

### Security Considerations

1. **Webhook Secret**: 
   - Phải dài ≥ 32 ký tự
   - Phải được bảo mật trong env variable
   - SePay và server phải dùng chung secret

2. **Idempotent Processing**:
   - Nếu đơn hàng đã `PAID`, webhook không thực hiện UPDATE
   - Tránh duplicate khi SePay gửi lại webhook

3. **Validation**:
   - Regex compile một lần tại module load (performance)
   - Validate amount trước khi UPDATE (ngăn lỗi logic)

4. **No Rollback**:
   - Nếu webhook thất bại sau khi UPDATE, đơn hàng đã mark `PAID`
   - Cần manual review nếu có tranh chấp

### cURL Example

```bash
curl -X POST "https://api.mobivexa.com/api/webhooks/sepay" \
  -H "Content-Type: application/json" \
  -H "x-sepay-secret: your_secure_secret_key_min_32_chars" \
  -d '{
    "id": 1234567,
    "gateway": "MB",
    "transactionDate": "2025-06-20 14:30:25",
    "accountNumber": "0987654321",
    "subAccount": null,
    "code": null,
    "content": "ORD-20250620-3F7A2B",
    "transferType": "in",
    "transferAmount": 250000,
    "accumulated": 12345678,
    "referenceCode": "240620143025",
    "description": "Chuyen khoan",
    "body": null
  }'
```

### TypeScript Types

```typescript
interface SePayWebhookPayload {
  id: number
  gateway: string              // Mã ngân hàng (MB, VCB, ...)
  transactionDate: string      // Format: "YYYY-MM-DD HH:mm:ss"
  accountNumber: string        // Số tài khoản nhận tiền
  subAccount: string | null    // Tài khoản con (nếu có)
  code: string | null          // Mã giao dịch
  content: string              // Nội dung chuyển khoản (chứa orderCode)
  transferType: 'in' | 'out'   // 'in' = tiền vào
  transferAmount: number       // Số tiền chuyển
  accumulated: number          // Số dư sau giao dịch
  referenceCode: string        // Mã tham chiếu
  description: string          // Mô tả giao dịch
  body: string | null          // Dữ liệu bổ sung
}

interface WebhookResponse {
  success: boolean
  handled: boolean            // true = đã xử lý, false = bỏ qua
  orderCode?: string          // Có mặt khi handled = true
}
```

---

## 3. Thống kê Thanh toán (Admin)

**GET** `/api/admin/payment/stats`

Lấy thống kê tổng quan về thanh toán cho dashboard admin.

### Authentication
```
Authorization: Bearer <ACCESS_TOKEN>
```

**Quyền hạn**: `STAFF+` (Chỉ `STAFF` và `ADMIN`)

### Parameters

Không có parameters.

### Business Logic

Chạy 4 aggregation queries song song:

1. **revenue**: Tổng tiền đã thu (`paymentStatus = PAID`)
2. **pending**: Đơn chưa thanh toán (`paymentStatus = UNPAID`)
3. **refunded**: Đơn đã hoàn tiền (`paymentStatus = REFUNDED`)
4. **awaitingBankTransfer**: Đơn chờ đối soát CK (`paymentStatus = UNPAID` AND `paymentMethod = BANK_TRANSFER`)

### Response 200 (Success)

```json
{
  "revenue": 125000000,
  "pending": {
    "count": 15,
    "amount": 4500000
  },
  "refunded": {
    "count": 2,
    "amount": 300000
  },
  "awaitingBankTransfer": {
    "count": 8,
    "amount": 2400000
  }
}
```

### Response 401 (Unauthorized)

```json
{
  "message": "Không có token xác thực"
}
```

HOẶC

```json
{
  "message": "Token không hợp lệ hoặc đã hết hạn"
}
```

### Response 403 (Forbidden)

```json
{
  "message": "Bạn không có quyền thực hiện thao tác này"
}
```

### Performance Target
- **95th percentile**: < 300ms
- **Average**: < 200ms
- **Database queries**: 4 (song song bằng `Promise.all`)
- **Indexes sử dụng**: `paymentStatus`, `paymentMethod`

### Rate Limiting
- **Window**: 15 minutes
- **Max requests**: 50 requests per IP per window
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### cURL Example

```bash
curl -X GET "https://api.mobivexa.com/api/admin/payment/stats" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### TypeScript Types

```typescript
interface PaymentStatGroup {
  count: number    // Số đơn hàng
  amount: number   // Tổng tiền
}

interface PaymentStats {
  revenue: number                    // Tổng tiền đã thu
  pending: PaymentStatGroup          // Chưa thanh toán
  refunded: PaymentStatGroup         // Đã hoàn tiền
  awaitingBankTransfer: PaymentStatGroup  // Chờ đối soát CK
}
```

---

## Common Error Responses

### 400 Bad Request
```json
{
  "message": "Validation error message"
}
```

**Cases**:
- Payment method không đúng
- Đơn hàng đã thanh toán
- Input không hợp lệ

### 401 Unauthorized
```json
{
  "message": "Không có token xác thực"
}
```
HOẶC
```json
{
  "message": "Token không hợp lệ hoặc đã hết hạn"
}
```
HOẶC
```json
{
  "message": "Webhook secret không hợp lệ"
}
```

**Cases**:
- Thiếu `Authorization` header
- Token không đúng format
- Token expired
- `x-sepay-secret` không đúng

### 403 Forbidden
```json
{
  "message": "Bạn không có quyền thực hiện thao tác này"
}
```

**Cases**:
- User không có role phù hợp (VD: CUSTOMER gọi admin endpoint)
- `userId` trong token không khớp với resource owner

### 404 Not Found
```json
{
  "message": "Đơn hàng không tồn tại"
}
```

**Cases**:
- Order ID không tồn tại trong DB
- Order đã bị soft delete

### 500 Internal Server Error
```json
{
  "message": "Lỗi server nội bộ"
}
```

**Cases**:
- Database connection error
- Unhandled exception
- External service error

---

## Rate Limiting Specification

### Rate Limit Headers
Tất cả responses (trừ webhook) bao gồm:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1718870400
```

### Limits per Endpoint

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| `GET /api/orders/:id/payment` | 15 minutes | 100 |
| `POST /api/webhooks/sepay` | Unlimited | Unlimited |
| `GET /api/admin/payment/stats` | 15 minutes | 50 |

### Rate Limit Error Response
```json
{
  "message": "Too many requests from this IP, please try again later."
}
```

**HTTP Status**: 429 Too Many Requests

---

## Data Models

### PaymentInfo
```typescript
interface PaymentInfo {
  bankId: string        // Mã ngân hàng (VD: 970415)
  accountNo: string     // Số tài khoản
  accountName: string   // Tên chủ tài khoản
  amount: number        // Số tiền thanh toán
  content: string       // Nội dung chuyển khoản (= orderCode)
  qrUrl: string         // URL ảnh QR VietQR
}
```

### PaymentStats
```typescript
interface PaymentStats {
  revenue: number                    // Tổng tiền đã thu
  pending: PaymentStatGroup          // Chưa thanh toán
  refunded: PaymentStatGroup         // Đã hoàn tiền
  awaitingBankTransfer: PaymentStatGroup  // Chờ đối soát CK
}
```

### PaymentStatGroup
```typescript
interface PaymentStatGroup {
  count: number    // Số đơn hàng
  amount: number   // Tổng tiền
}
```

### SePayWebhookPayload
```typescript
interface SePayWebhookPayload {
  id: number
  gateway: string
  transactionDate: string
  accountNumber: string
  subAccount: string | null
  code: string | null
  content: string
  transferType: 'in' | 'out'
  transferAmount: number
  accumulated: number
  referenceCode: string
  description: string
  body: string | null
}
```

---

## Security Considerations

### 1. JWT Token Management
- **Algorithm**: HS256 (HMAC-SHA256)
- **Secret length**: ≥ 32 characters
- **Token expiration**: 
  - Access token: 15 minutes (default)
  - Refresh token: 7 days (default)
- **Token storage**: Client phải lưu token secure (HttpOnly cookie hoặc secure storage)

### 2. Webhook Security
- **Secret validation**: Verify `x-sepay-secret` header
- **Secret strength**: ≥ 32 characters, random string
- **No JWT**: Webhook endpoint không dùng JWT (server-to-server)
- **HTTPS**: Bắt buộc dùng HTTPS trong production

### 3. Ownership Validation
- **Customer endpoints**: Validate `userId` trong token khớp với resource owner
- **Admin endpoints**: Validate user role (`STAFF+`)
- **Prevent escalation**: Không cho customer elevate privilege

### 4. Idempotent Operations
- **Webhook**: Nếu đơn hàng đã `PAID`, không thực hiện duplicate UPDATE
- **Race condition**: Sử dụng database transaction (Prisma)

### 5. Input Validation
- **UUID**: Validate UUID format cho order ID
- **Amount**: Validate amount > 0 và khớp với order total
- **Date**: Validate `transactionDate` trước khi lưu

---

## External Integrations

### VietQR API

**Base URL**: `https://img.vietqr.io/image`

**URL Pattern**:
```
https://img.vietqr.io/image/{BANK_ID}-{ACCOUNT_NO}-compact2.jpg?amount={AMOUNT}&addInfo={CONTENT}&accountName={ACCOUNT_NAME}
```

**Example**:
```
https://img.vietqr.io/image/970415-0987654321-compact2.jpg?amount=250000&addInfo=ORD-20250620-3F7A2B&accountName=PHAM+VINH
```

**Parameters**:
| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| BANK_ID | string | Yes | Mã ngân hàng (VD: 970415 cho MB) |
| ACCOUNT_NO | string | Yes | Số tài khoản nhận tiền |
| amount | number | Yes | Số tiền thanh toán |
| addInfo | string | Yes | Nội dung chuyển khoản (= orderCode) |
| accountName | string | Yes | Tên chủ tài khoản |

**Response**: JPEG image (QR code)

### SePay Webhook

**Documentation**: [SePay API Docs](https://sepay.vn/docs)

**Webhook Trigger**: SePay gửi webhook khi có chuyển khoản vào tài khoản được monitor

**Retry Policy**: 
- SePay sẽ retry nếu endpoint return 5xx error
- Max retries: 3 lần
- Retry interval: 1 phút, 5 phút, 15 phút

**Best Practices**:
1. Luôn return 200 (nếu secret valid) để tránh unnecessary retries
2. Return `{ handled: false }` cho webhook không liên quan
3. Log webhook payload để debug

---

## Environment Variables

```bash
# JWT Configuration
JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Bank & SePay Configuration
SEPAY_BANK_ID=970415
SEPAY_ACCOUNT_NUMBER=0987654321
SEPAY_ACCOUNT_NAME=PHAM VINH
SEPAY_WEBHOOK_SECRET=your_webhook_secret_min_32_chars

# Database
DATABASE_URL=postgresql://user:password@host:port/database
```

---

## Performance Monitoring

### Key Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| GET /api/orders/:id/payment | < 200ms (p95) | Database query time |
| POST /api/webhooks/sepay | < 500ms (p95) | Webhook processing time |
| GET /api/admin/payment/stats | < 300ms (p95) | Aggregation query time |

### Monitoring Checklist
- Response time distribution (p50, p95, p99)
- Error rate per endpoint
- Rate limit hit rate
- Webhook processing success rate
- Database query performance

---

## Testing Examples

### Postman Collection

#### 1. Get Payment Info
```javascript
// Pre-request Script
const orderId = "550e8400-e29b-41d4-a716-446655440000";
pm.environment.set("orderId", orderId);

// Request
GET {{apiUrl}}/orders/{{orderId}}/payment
Authorization: Bearer {{accessToken}}

// Tests
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Returns payment info", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("bankId");
    pm.expect(json).to.have.property("accountNo");
    pm.expect(json).to.have.property("amount");
    pm.expect(json).to.have.property("qrUrl");
});
```

#### 2. Process Webhook
```javascript
// Request
POST {{apiUrl}}/webhooks/sepay
x-sepay-secret: {{webhookSecret}}
Content-Type: application/json

{
  "id": 1234567,
  "gateway": "MB",
  "transactionDate": "2025-06-20 14:30:25",
  "accountNumber": "0987654321",
  "subAccount": null,
  "code": null,
  "content": "ORD-20250620-3F7A2B",
  "transferType": "in",
  "transferAmount": 250000,
  "accumulated": 12345678,
  "referenceCode": "240620143025",
  "description": "Chuyen khoan",
  "body": null
}

// Tests
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Webhook handled", function () {
    const json = pm.response.json();
    pm.expect(json.success).to.be.true;
});
```

#### 3. Get Payment Stats (Admin)
```javascript
// Request
GET {{apiUrl}}/admin/payment/stats
Authorization: Bearer {{adminAccessToken}}

// Tests
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Returns stats", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("revenue");
    pm.expect(json).to.have.property("pending");
    pm.expect(json).to.have.property("refunded");
    pm.expect(json).to.have.property("awaitingBankTransfer");
});
```

---

## Changelog

### Version 1.0.0 (2025-06-20)
- Initial API specification
- Payment info endpoint
- SePay webhook integration
- Admin payment stats endpoint

---

## Support & Documentation

- **Backend Repository**: [GitHub Link]
- **Frontend Repository**: [GitHub Link]
- **API Documentation**: [Link]
- **SePay Docs**: https://sepay.vn/docs
- **VietQR Docs**: https://vietqr.io

---

## Notes

1. **Currency**: Tất cả số tiền tính bằng VND (Vietnam Dong)
2. **DateTime Format**: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
3. **Transaction ID**: Webhook `id` là unique ID từ SePay
4. **Order Code Format**: `ORD-{YYYYMMDD}-{6CHAR_HEX}`
5. **Webhook Idempotent**: Không duplicate process nếu đơn hàng đã paid
6. **Rate Limit**: Tính theo IP address của client

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-06-20  
**Author**: Backend Architect  
**Status**: Production Ready
