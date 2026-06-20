# Use Case Document
## Module: Payment (Thanh toán)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-20  
> **Tham chiếu:** [BRD.md](./BRD.md) | [SRS.md](./SRS.md)

---

## 1. Actors

| Actor | Mô tả | Role |
|---|---|---|
| **Customer** | Khách hàng đã đăng nhập | `CUSTOMER` |
| **Admin** | Quản trị viên hệ thống | `ADMIN` hoặc `STAFF` |
| **SePay System** | Hệ thống giám sát giao dịch ngân hàng | Hệ thống bên ngoài |
| **Payment System** | Module thanh toán (backend) | Hệ thống nội bộ |
| **Database** | Cơ sở dữ liệu lưu trữ thông tin thanh toán | Hệ thống lưu trữ |

---

## 2. Danh sách Use Case

| ID | Tên Use Case | Actor chính | Độ ưu tiên |
|---|---|---|---|
| UC-01 | Lấy mã QR thanh toán | Customer | Cao |
| UC-02 | Xử lý webhook thanh toán | SePay System | Cao |
| UC-03 | Xem thống kê thanh toán | Admin | Trung bình |

---

## 3. Chi tiết Use Case

---

### UC-01: Lấy mã QR thanh toán

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Lấy thông tin chuyển khoản ngân hàng và mã VietQR để thanh toán đơn hàng |
| **Tiền điều kiện** | Customer đã đăng nhập và có JWT token hợp lệ |
| **Hậu điều kiện** | Customer nhận được thông tin tài khoản, số tiền cần chuyển, nội dung chuyển khoản và mã QR |
| **Trigger** | Customer truy cập trang thanh toán của đơn hàng |

**Luồng chính (Happy Path):**

1. Customer gửi request `GET /api/orders/:id/payment` với JWT token trong header `Authorization: Bearer <token>`
2. Hệ thống xác thực JWT token và lấy `userId` từ payload
3. Hệ thống tìm đơn hàng theo `orderId` và `userId` (ownership check)
4. Hệ thống kiểm tra `paymentMethod === BANK_TRANSFER` — chỉ phương thức này mới có QR
5. Hệ thống kiểm tra `paymentStatus !== PAID` — đơn đã thanh toán không cần QR nữa
6. Hệ thống build URL VietQR với các tham số:
   - `amount`: Tổng số tiền đơn hàng
   - `addInfo`: Mã đơn hàng (orderCode)
   - `accountName`: Tên chủ tài khoản
7. Hệ thống trả về `200` + thông tin thanh toán đầy đủ

**Response mẫu:**
```json
{
  "bankId": "VIETCOMBANK",
  "accountNo": "1234567890",
  "accountName": "CONG TY MOBIVEXA",
  "amount": 22990000,
  "content": "ORD-20240619-A3F9C2",
  "qrUrl": "https://img.vietqr.io/image/VIETCOMBANK-1234567890-compact2.jpg?amount=22990000&addInfo=ORD-20240619-A3F9C2&accountName=CONG+TY+MOBIVEXA"
}
```

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Token không hợp lệ hoặc hết hạn | Trả `401` — `Token không hợp lệ hoặc đã hết hạn` |
| 3 | Đơn hàng không tồn tại hoặc không thuộc user | Trả `404` — `Đơn hàng không tồn tại` |
| 4 | `paymentMethod ≠ BANK_TRANSFER` | Trả `400` — `Đơn hàng không dùng phương thức chuyển khoản ngân hàng` |
| 5 | Đơn hàng đã `PAID` | Trả `400` — `Đơn hàng đã được thanh toán` |
| Bất kỳ | Lỗi database | Trả `500` — `Lỗi hệ thống, vui lòng thử lại` |

**Ghi chú:**
- Ownership check đảm bảo customer chỉ xem được thông tin thanh toán của đơn hàng mình
- URL VietQR được generate sẵn với đầy đủ thông tin để khách có thể quét và chuyển khoản ngay
- Nội dung chuyển khoản (content) là orderCode — hệ thống dùng mã này để đối soát khi nhận webhook

---

### UC-02: Xử lý webhook thanh toán

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | SePay System |
| **Mục tiêu** | Xử lý callback từ SePay khi phát hiện giao dịch ngân hàng khớp với đơn hàng |
| **Tiền điều kiện** | SePay đã được cấu hình webhook URL và secret |
| **Hậu điều kiện** | Đơn hàng được đánh dấu đã thanh toán, trạng thái đơn được cập nhật |
| **Trigger** | SePay phát hiện giao dịch ngân hàng và gửi POST request |

**Luồng chính (Happy Path):**

1. SePay gửi request `POST /api/webhooks/sepay` với:
   - Header: `x-sepay-secret: {SEPAY_WEBHOOK_SECRET}`
   - Body: Payload thông tin giao dịch
2. Hệ thống xác thực `x-sepay-secret` header với `SEPAY_WEBHOOK_SECRET` từ environment
3. Hệ thống kiểm tra `transferType === 'in'` — chỉ xử lý giao dịch nhận tiền
4. Hệ thống parse `orderCode` từ `content` sử dụng regex: `/ORD-\d{8}-[0-9A-F]{6}/i`
5. Hệ thống tìm đơn hàng theo `orderCode`
6. Hệ thống kiểm tra đơn hàng chưa thanh toán (`paymentStatus !== PAID`)
7. Hệ thống kiểm tra số tiền khớp: `transferAmount === order.total`
8. Hệ thống validate `transactionDate` là ngày hợp lệ
9. Hệ thống cập nhật đơn hàng:
   - `paymentStatus = PAID`
   - `paidAt = transactionDate`
   - Nếu `order.status === PENDING` → `status = CONFIRMED`
10. Hệ thống trả về `200` + `{ handled: true, orderCode }`

**Payload mẫu từ SePay:**
```json
{
  "id": 12345,
  "gateway": "MB",
  "transactionDate": "2024-01-01 10:00:00",
  "accountNumber": "1234567890",
  "content": "Thanh toan ORD-20240101-AABBCC",
  "transferType": "in",
  "transferAmount": 500000,
  "accumulated": 1500000,
  "referenceCode": "REF123",
  "description": "Chuyen khoan",
  "body": "Noi dung chuyen khoan"
}
```

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Thiếu header `x-sepay-secret` hoặc sai | Trả `401` — `Webhook secret không hợp lệ` |
| 3 | `transferType = 'out'` | Trả `200` + `{ handled: false }` (bỏ qua giao dịch chuyển đi) |
| 4 | Không tìm thấy `orderCode` trong nội dung | Trả `200` + `{ handled: false }` (không phải giao dịch hệ thống) |
| 5 | Đơn hàng không tồn tại | Trả `200` + `{ handled: false }` (orderCode không hợp lệ) |
| 6 | Đơn hàng đã `PAID` | Trả `200` + `{ handled: false }` (idempotent — webhook trùng lặp) |
| 7 | `transferAmount ≠ order.total` | Trả `200` + `{ handled: false }` (số tiền không khớp) |
| 8 | `transactionDate` không parse được | Trả `200` + `{ handled: false }` (dữ liệu lỗi) |
| Bất kỳ | Lỗi database khi update | Trả `500` — `Lỗi hệ thống, vui lòng thử lại` |

**Ghi chú:**
- Webhook luôn trả HTTP `200` kể cả khi `handled: false` — tránh SePay retry vô hạn
- Chỉ trả `401` khi sai secret — SePay sẽ không retry trong trường hợp này
- Idempotency đảm bảo webhook trùng lặp không gây lỗi
- Tự động chuyển `PENDING` → `CONFIRMED` khi thanh toán thành công
- Webhook endpoint public (không cần JWT) — chỉ authenticate bằng secret header

---

### UC-03: Xem thống kê thanh toán

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Admin |
| **Mục tiêu** | Xem thống kê doanh thu, đơn chờ thanh toán, đã hoàn tiền để đối soát |
| **Tiền điều kiện** | Admin đã đăng nhập và có quyền `STAFF+` |
| **Hậu điều kiện** | Admin nhận được số liệu thống kê thanh toán |
| **Trigger** | Admin truy cập dashboard thống kê thanh toán |

**Luồng chính (Happy Path):**

1. Admin gửi request `GET /api/admin/payment/stats` với JWT token trong header `Authorization: Bearer <token>`
2. Hệ thống xác thực JWT token và kiểm tra quyền `STAFF+`
3. Hệ thống chạy 4 aggregation query song song:
   - **Revenue**: Tổng `total` của đơn có `paymentStatus = PAID`
   - **Pending**: Đơn `paymentStatus = UNPAID` (count + amount)
   - **Refunded**: Đơn `paymentStatus = REFUNDED` (count + amount)
   - **AwaitingBankTransfer**: Đơn `UNPAID` + `BANK_TRANSFER` (count + amount)
4. Hệ thống trả về `200` + thống kê đầy đủ

**Response mẫu:**
```json
{
  "revenue": 125000000,
  "pending": {
    "count": 12,
    "amount": 15000000
  },
  "refunded": {
    "count": 3,
    "amount": 4500000
  },
  "awaitingBankTransfer": {
    "count": 5,
    "amount": 7500000
  }
}
```

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Token không hợp lệ hoặc hết hạn | Trả `401` — `Token không hợp lệ hoặc đã hết hạn` |
| 2 | User không có quyền `STAFF+` | Trả `403` — `Không có quyền truy cập` |
| 3 | Lỗi database khi aggregate | Trả `500` — `Lỗi hệ thống, vui lòng thử lại` |

**Ghi chú:**
- 4 queries chạy song song để tối ưu hiệu năng
- `awaitingBankTransfer` giúp admin track các đơn đang chờ SePay webhook xác nhận
- Số liệu được tính real-time từ database

---

## 4. Mối quan hệ giữa Use Cases

```
UC-01 (Lấy mã QR) ──────────────────► Trả thông tin chuyển khoản
     │                                  Build URL VietQR
     │                                  Trả orderCode làm nội dung CK
     │
     ▼
Customer chuyển khoản ────────────────► Khách dùng app ngân hàng
     │                                  Điền nội dung: orderCode
     │                                  Số tiền: đúng total
     │
     ▼
Ngân hàng ghi nhận giao dịch ─────────► SePay giám sát tài khoản
     │
     ▼
UC-02 (Xử lý webhook) ─────────────────► SePay gửi callback
     │                                  Xác thực secret
     │                                  Parse orderCode từ content
     │                                  Khớp số tiền
     │                                  Cập nhật paymentStatus=PAID
     │                                  Tự động CONFIRMED nếu PENDING
     │
     ├───────────────────────────────► Idempotent (bỏ qua nếu đã PAID)
     │
     ▼
UC-03 (Thống kê) ─────────────────────► Admin xem dashboard
                                        Real-time aggregation
                                        Track awaitingBankTransfer
```

---

## 5. Use Case Diagram

```
┌─────────────────┐
│   Customer      │
│  (CUSTOMER)     │
└────────┬────────┘
         │
         │ uses
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Payment System                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐                                               │
│  │  UC-01:      │                                               │
│  │  Lấy mã QR   │                                               │
│  │  thanh toán  │                                               │
│  └──────────────┘                                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         │
         │ notifies
         ▼
┌─────────────────┐
│   SePay System  │
│  (Webhook Caller)│
└────────┬────────┘
         │
         │ sends webhook
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Payment System                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐                                               │
│  │  UC-02:      │                                               │
│  │  Xử lý       │                                               │
│  │  webhook     │                                               │
│  └──────────────┘                                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         │
         │ updates
         ▼
┌─────────────────┐
│   Admin         │
│  (STAFF+)       │
└────────┬────────┘
         │
         │ views
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Payment System                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐                                               │
│  │  UC-03:      │                                               │
│  │  Thống kê    │                                               │
│  │  thanh toán  │                                               │
│  └──────────────┘                                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Business Rules

### BR-01: Phương thức thanh toán
- Hệ thống hỗ trợ 2 phương thức: `COD` và `BANK_TRANSFER`
- Chỉ đơn hàng `BANK_TRANSFER` mới có thông tin QR để chuyển khoản
- Đơn hàng `COD` không có luồng payment — khách trả tiền mặt khi nhận hàng

### BR-02: Trạng thái thanh toán
- `UNPAID`: Mặc định khi tạo đơn
- `PAID`: Đã thanh toán (set bởi webhook SePay hoặc admin thủ công)
- `REFUNDED`: Đã hoàn tiền (set bởi admin sau khi đối soát)

### BR-03: Xác thực webhook SePay
- Webhook endpoint public (không cần JWT)
- Xác thực bằng `x-sepay-secret` header
- Secret được lưu trong biến môi trường `SEPAY_WEBHOOK_SECRET`
- Thiếu hoặc sai secret → trả `401`

### BR-04: Idempotency webhook
- Webhook luôn trả HTTP `200` để tránh retry vô hạn
- Nếu đơn đã `PAID` → trả `{ handled: false }` (không update lại)
- Đảm bảo webhook trùng lặp không gây lỗi

### BR-05: Validate số tiền
- Webhook chỉ xử lý nếu `transferAmount === order.total`
- Số tiền không khớp → trả `{ handled: false }`
- Tránh trường hợp khách chuyển sai số tiền

### BR-06: Tự động CONFIRMED khi thanh toán
- Nếu đơn đang `PENDING` khi webhook đến → tự động set `status = CONFIRMED`
- Nếu đơn đang `CONFIRMED` trở lên → chỉ cập nhật `paymentStatus`, không đổi `status`

### BR-07: Parse orderCode từ nội dung chuyển khoản
- Regex pattern: `/ORD-\d{8}-[0-9A-F]{6}/i`
- Case-insensitive — khách có thể nhập thường hoặc hoa
- Nếu không tìm thấy orderCode → bỏ qua webhook

### BR-08: Ownership check
- Customer chỉ xem được thông tin thanh toán của đơn hàng mình
- Query luôn kèm điều kiện `userId` từ JWT token
- Trả `404` thay vì `403` để tránh lộ thông tin

### BR-09: Thống kê real-time
- Số liệu được tính real-time từ database
- 4 aggregation queries chạy song song
- Admin có thể track các đơn đang chờ webhook SePay qua `awaitingBankTransfer`

### BR-10: Bỏ qua giao dịch chuyển đi
- Webhook chỉ xử lý `transferType === 'in'` (nhận tiền)
- `transferType === 'out'` → trả `{ handled: false }`
- Tránh xử lý sai giao dịch chuyển tiền đi

---

## 7. Preconditions & Postconditions

### UC-01: Lấy mã QR thanh toán

**Preconditions:**
- Customer đã đăng nhập và có JWT token hợp lệ
- Đơn hàng tồn tại và thuộc về customer
- Đơn hàng dùng phương thức `BANK_TRANSFER`
- Đơn hàng chưa thanh toán (`paymentStatus !== PAID`)

**Postconditions:**
- Customer nhận được thông tin tài khoản ngân hàng
- Customer nhận được mã QR VietQR để quét và chuyển khoản
- Customer biết nội dung chuyển khoản (orderCode) và số tiền cần chuyển

### UC-02: Xử lý webhook thanh toán

**Preconditions:**
- SePay đã được cấu hình webhook URL đúng
- SePay có secret header đúng
- Payload webhook chứa đầy đủ thông tin giao dịch

**Postconditions:**
- Đơn hàng được đánh dấu `paymentStatus = PAID`
- `paidAt` được set bằng `transactionDate`
- Nếu đơn đang `PENDING` → `status = CONFIRMED`
- Admin có thể thấy đơn trong thống kê doanh thu

### UC-03: Xem thống kê thanh toán

**Preconditions:**
- Admin đã đăng nhập và có JWT token hợp lệ
- Admin có quyền `STAFF+`
- Database có ít nhất một đơn hàng

**Postconditions:**
- Admin nhận được số liệu thống kê đầy đủ
- Admin biết doanh thu, đơn chờ thanh toán, đã hoàn tiền
- Admin track được các đơn đang chờ webhook SePay

---

## 8. Error Handling Summary

| HTTP Code | Khi nào dùng | Message mẫu |
|---|---|---|
| `200` | Webhook xử lý thành công hoặc bỏ qua | — |
| `200` | Lấy QR thành công / Thống kê thành công | — |
| `400` | Đơn hàng không dùng BANK_TRANSFER | `Đơn hàng không dùng phương thức chuyển khoản ngân hàng` |
| `400` | Đơn hàng đã thanh toán | `Đơn hàng đã được thanh toán` |
| `401` | Token không hợp lệ hoặc hết hạn | `Token không hợp lệ hoặc đã hết hạn` |
| `401` | Webhook secret không hợp lệ | `Webhook secret không hợp lệ` |
| `403` | Không có quyền truy cập thống kê | `Không có quyền truy cập` |
| `404` | Đơn hàng không tồn tại | `Đơn hàng không tồn tại` |
| `500` | Lỗi hệ thống | `Lỗi hệ thống, vui lòng thử lại` |

---

## 9. Special Requirements

### NFR-01: Hiệu năng
- Lấy mã QR: < 200ms (p95)
- Xử lý webhook: < 500ms (p95) — để tránh SePay timeout
- Thống kê thanh toán: < 1s (p95)
- Webhook endpoint phải available 99.9% — SePay sẽ retry nếu fail

### NFR-02: Bảo mật
- Webhook endpoint authenticate bằng secret header (not JWT)
- Secret lưu trong biến môi trường, không hardcode
- Không leak thông qua error messages (404 thay vì 403)
- Idempotency để tránh tấn công replay webhook

### NFR-03: Khả năng mở rộng
- Hỗ trợ 1000+ webhook calls/phút
- Hỗ trợ nhiều ngân hàng khác nhau (chỉ cần cấu hình env)
- Có thể mở rộng xử lý multiple payment gateways

### NFR-04: Độ tin cậy
- Idempotent webhook — xử lý trùng lặp an toàn
- Validate số tiền trước khi update — tránh thanh toán thiếu
- Validate transactionDate trước khi lưu — tránh dữ liệu lỗi
- Auto-confirm đơn hàng khi thanh toán — giảm manual work

---

## 10. Appendix

### 10.1 Terminology

| Term | Định nghĩa |
|---|---|
| **VietQR** | Chuẩn mã QR thanh toán của Việt Nam — dùng để generate mã QR chuyển khoản |
| **SePay** | Hệ thống giám sát giao dịch ngân hàng — phát hiện chuyển khoản và gửi webhook |
| **orderCode** | Mã định danh duy nhất của đơn hàng — dùng làm nội dung chuyển khoản |
| **Webhook** | Callback HTTP từ SePay khi phát hiện giao dịch ngân hàng |
| **Idempotency** | Tính chất đảm bảo operation trùng lặp không gây lỗi |
| **BANK_TRANSFER** | Phương thức thanh toán chuyển khoản ngân hàng |
| **COD** | Phương thức thanh toán tiền mặt khi nhận hàng |
| **awaitingBankTransfer** | Đơn hàng chờ webhook SePay xác nhận |

### 10.2 Related Documents

| Document | Link |
|---|---|
| BRD - Business Requirements | [BRD.md](./BRD.md) |
| SRS - Software Requirements | [SRS.md](./SRS.md) |
| API Specification | [APISpec.md](./APISpec.md) |
| Activity Diagram | [ActivityDiagram.md](./ActivityDiagram.md) |
| Sequence Diagram | [SequenceDiagram.md](./SequenceDiagram.md) |
| ERD | [ERD.md](./ERD.md) |
| Test Cases | [TestCase.md](./TestCase.md) |

### 10.3 Environment Variables

| Variable | Mô tả | Ví dụ |
|---|---|---|
| `SEPAY_BANK_ID` | Mã ngân hàng để build URL VietQR | `VIETCOMBANK`, `MB` |
| `SEPAY_ACCOUNT_NUMBER` | Số tài khoản nhận tiền | `1234567890` |
| `SEPAY_ACCOUNT_NAME` | Tên chủ tài khoản (hiển thị trong QR) | `CONG TY MOBIVEXA` |
| `SEPAY_WEBHOOK_SECRET` | Secret để xác thực webhook từ SePay | `super-secret-key-123` |

### 10.4 Integration Details

**VietQR Integration:**
- URL pattern: `https://img.vietqr.io/image/{bankId}-{accountNo}-compact2.jpg?amount={amount}&addInfo={orderCode}&accountName={accountName}`
- Template `compact2` trả ảnh QR PNG có sẵn để embed vào UI
- Params được URL-encoded để đảm bảo an toàn

**SePay Integration:**
- Webhook endpoint: `POST /api/webhooks/sepay`
- Authentication: Header `x-sepay-secret`
- Payload contains: `transferType`, `content`, `transferAmount`, `transactionDate`
- Order code is extracted from `content` field using regex

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-20  
> **Next Review:** After implementation complete  
> **Author:** Workflow Architect (generated from business requirements and implementation analysis)