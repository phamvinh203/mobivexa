# Nghiệp vụ Payment (Thanh toán) — Mobivexa

> **Phạm vi:** `src/services/payment.service.ts`, `src/controllers/payment.controller.ts`, `src/routes/payment.route.ts`, `src/types/payment.type.ts`
>
> **Cập nhật:** 2026-06-19
>
> **Xem thêm:** [order.md](./order.md) — Payment là module phụ trợ cho Order, không tạo đơn hàng.

---

## 1. Tổng quan

Module Payment xử lý 3 nghiệp vụ thanh toán:

| Nghiệp vụ | Mô tả |
|---|---|
| **Lấy thông tin QR** | Trả thông tin chuyển khoản + URL VietQR cho khách |
| **SePay Webhook** | Nhận callback từ SePay khi phát hiện giao dịch ngân hàng khớp |
| **Thống kê thanh toán** | Dashboard đối soát doanh thu cho admin |

Hệ thống hỗ trợ 2 phương thức thanh toán (xem thêm trong `order.md`):
- **COD**: Không có luồng payment — khách trả tiền mặt khi nhận hàng
- **BANK_TRANSFER**: Khách chuyển khoản → SePay phát hiện → webhook → hệ thống tự xác nhận

---

## 2. Danh sách endpoint

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/api/orders/:id/payment` | Lấy thông tin thanh toán QR | ✅ User |
| `POST` | `/api/webhooks/sepay` | Nhận callback từ SePay | 🔑 Secret Header |
| `GET` | `/api/admin/payment/stats` | Thống kê thanh toán | ✅ STAFF+ |

---

## 3. Luồng BANK_TRANSFER end-to-end

```
Khách đặt hàng (paymentMethod=BANK_TRANSFER)
         │
         ▼
GET /api/orders/:id/payment
  → Trả QR code VietQR + thông tin chuyển khoản
  → Nội dung CK: orderCode (VD: ORD-20240619-A3F9C2)
         │
         ▼
Khách chuyển khoản qua app ngân hàng
  → Điền nội dung: "ORD-20240619-A3F9C2"
  → Số tiền: đúng total của đơn
         │
         ▼
Ngân hàng ghi nhận giao dịch
         │
         ▼
SePay phát hiện giao dịch
         │
         ▼
POST /api/webhooks/sepay  (SePay → Server)
  → Xác thực x-sepay-secret header
  → Parse orderCode từ nội dung giao dịch
  → Tìm đơn hàng theo orderCode
  → Khớp số tiền (transferAmount === order.total)
  → Cập nhật: paymentStatus=PAID, paidAt=transactionDate
  → Nếu đơn đang PENDING → tự động chuyển sang CONFIRMED
         │
         ▼
Đơn hàng đã được thanh toán & xác nhận
```

---

## 4. Luồng nghiệp vụ chi tiết

### 4.1 Lấy thông tin thanh toán QR

```
GET /api/orders/:id/payment → [authenticate] → getOrderPaymentInfo → Response
```

**Happy Path:**
1. Tìm đơn theo `id` và `userId` (ownership check)
2. Kiểm tra `paymentMethod === BANK_TRANSFER` — chỉ phương thức này mới có QR
3. Kiểm tra `paymentStatus !== PAID` — đơn đã thanh toán không cần QR nữa
4. Build URL VietQR với params: `amount`, `addInfo = orderCode`, `accountName`
5. Trả về thông tin thanh toán

**Response:**
```json
{
  "bankId":      "VIETCOMBANK",
  "accountNo":   "1234567890",
  "accountName": "CONG TY MOBIVEXA",
  "amount":      22990000,
  "content":     "ORD-20240619-A3F9C2",
  "qrUrl":       "https://img.vietqr.io/image/VIETCOMBANK-1234567890-compact2.jpg?amount=22990000&addInfo=ORD-20240619-A3F9C2&accountName=CONG+TY+MOBIVEXA"
}
```

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Đơn không tồn tại / không thuộc user | 404 | `Đơn hàng không tồn tại` |
| `paymentMethod ≠ BANK_TRANSFER` | 400 | `Đơn hàng không dùng phương thức chuyển khoản ngân hàng` |
| Đơn đã `PAID` | 400 | `Đơn hàng đã được thanh toán` |

---

### 4.2 SePay Webhook

```
POST /api/webhooks/sepay → [verifySePaySecret] → processSePayWebhook → Response
```

**Xác thực Webhook:**
- Yêu cầu header: `x-sepay-secret: {SEPAY_WEBHOOK_SECRET}`
- Thiếu secret hoặc sai → `401` — SePay không được xử lý tiếp

**Logic xử lý (idempotent — luôn trả `200`):**

```
payload.transferType === 'in'?  ──No──► { handled: false }
         │ Yes
         ▼
Parse orderCode từ payload.content
  (regex: /ORD-\d{8}-[0-9A-F]{6}/i)
         │
Tìm thấy?  ──No──► { handled: false }
         │ Yes
         ▼
Tìm đơn theo orderCode
         │
Tìm thấy VÀ chưa PAID?  ──No──► { handled: false }
         │ Yes
         ▼
transferAmount === order.total?  ──No──► { handled: false }
         │ Yes
         ▼
transactionDate hợp lệ (parseable)?  ──No──► { handled: false }
         │ Yes
         ▼
Update order:
  paymentStatus = PAID
  paidAt = transactionDate
  (nếu order.status === PENDING) status = CONFIRMED
         │
         ▼
{ handled: true, orderCode }
```

**Điều kiện bỏ qua (trả `handled: false`, không ghi DB):**

| Điều kiện | Lý do |
|---|---|
| `transferType = 'out'` | Giao dịch chuyển đi, không phải nhận tiền |
| Không tìm thấy `orderCode` trong nội dung | CK không liên quan đến hệ thống |
| Đơn không tồn tại | orderCode không hợp lệ hoặc đã xóa |
| Đơn đã `PAID` | Webhook trùng lặp — idempotent |
| `transferAmount ≠ order.total` | Số tiền không khớp — có thể nhập sai |
| `transactionDate` không parse được | Dữ liệu lỗi từ SePay |

> **Quan trọng:** Webhook luôn trả HTTP `200` kể cả khi `handled: false` — tránh SePay retry vô hạn. Chỉ trả `401` khi sai secret.

**Tự động CONFIRMED khi thanh toán:**
- Nếu đơn đang `PENDING` khi webhook đến → đồng thời set `status = CONFIRMED`
- Nếu đơn đang `CONFIRMED` trở lên → chỉ cập nhật `paymentStatus`, không đổi `status`

---

### 4.3 Thống kê thanh toán (Admin)

```
GET /api/admin/payment/stats → [authenticate] → [authorize STAFF+] → getPaymentStats
```

Chạy **4 aggregation query song song**:

| Metric | Query |
|---|---|
| `revenue` | Tổng `total` của đơn có `paymentStatus = PAID` |
| `pending.count` + `pending.amount` | Đơn `paymentStatus = UNPAID` |
| `refunded.count` + `refunded.amount` | Đơn `paymentStatus = REFUNDED` |
| `awaitingBankTransfer.count` + `amount` | Đơn `UNPAID` + `BANK_TRANSFER` (chờ SePay xác nhận) |

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

---

## 5. Bảo mật Webhook

| Biện pháp | Mô tả |
|---|---|
| `x-sepay-secret` header | Shared secret giữa SePay và server; thiếu/sai → `401` |
| `SEPAY_WEBHOOK_SECRET` env | Secret lưu trong biến môi trường, không hardcode |
| Idempotency | Đơn đã `PAID` → bỏ qua webhook trùng lặp |
| Validate số tiền | `transferAmount === order.total` — tránh thanh toán thiếu |
| Validate `transactionDate` | Parse kiểm tra trước khi lưu DB |
| Public endpoint | `/api/webhooks/sepay` không cần JWT — xác thực bằng secret header |

---

## 6. Cấu hình môi trường

| Biến | Mô tả |
|---|---|
| `SEPAY_BANK_ID` | Mã ngân hàng (VD: `VIETCOMBANK`, `MB`) dùng để build URL VietQR |
| `SEPAY_ACCOUNT_NUMBER` | Số tài khoản nhận tiền |
| `SEPAY_ACCOUNT_NAME` | Tên chủ tài khoản (hiển thị trong QR) |
| `SEPAY_WEBHOOK_SECRET` | Secret dùng để xác thực webhook từ SePay |

---

## 7. Tích hợp bên ngoài

### VietQR

- **URL pattern:** `https://img.vietqr.io/image/{bankId}-{accountNo}-compact2.jpg?amount=...&addInfo=...&accountName=...`
- `addInfo` = `orderCode` — khách nhìn thấy trong app ngân hàng và điền làm nội dung CK
- Template `compact2` trả ảnh QR PNG sẵn để embed trực tiếp vào UI

### SePay

- SePay giám sát tài khoản ngân hàng thực tế
- Khi phát hiện giao dịch khớp → POST đến `/api/webhooks/sepay`
- Payload gồm `content` (nội dung CK), `transferAmount`, `transferType`, `transactionDate`...
- Server parse `orderCode` từ `content` bằng regex: `/ORD-\d{8}-[0-9A-F]{6}/i`

---

## 8. Sơ đồ trạng thái thanh toán

```
                    UNPAID (mặc định)
                       │
          ┌────────────┼────────────────┐
          │            │                │
       COD order    SePay webhook   Admin thủ công
       (giao xong)  (khớp CK)      (đối soát)
          │            │                │
          └────────────▼────────────────┘
                      PAID
                       │
                  Admin hoàn tiền
                       │
                    REFUNDED
```
