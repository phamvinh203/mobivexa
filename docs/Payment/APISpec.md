# API Specification
## Module: Payment
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## Customer Endpoints

### GET /api/orders/:id/payment

**Auth:** Customer+ | **Rate limit:** `qrLimiter`

**Response 200:**
```json
{
  "bankId": "970418",
  "accountNo": "123456789",
  "accountName": "CONG TY MOBIVEXA",
  "amount": 25191000,
  "content": "ORD-20260822-A1B2C3",
  "qrUrl": "https://img.vietqr.io/image/970418-123456789-compact2.jpg?amount=25191000&addInfo=ORD-20260822-A1B2C3&accountName=CONG+TY+MOBIVEXA"
}
```

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Đơn COD hoặc đã PAID |
| 404 | Đơn không tồn tại hoặc không phải của user |

---

### GET /api/orders/:id/payment/status

**Auth:** Customer+ | **Rate limit:** Không

**Response 200:**
```json
{
  "orderId": "uuid",
  "orderCode": "ORD-20260822-A1B2C3",
  "paymentStatus": "UNPAID",
  "orderStatus": "PENDING",
  "paidAt": null,
  "isPaid": false
}
```

**Sau khi webhook khớp:**
```json
{
  "paymentStatus": "PAID",
  "orderStatus": "CONFIRMED",
  "paidAt": "2026-08-22T09:15:00.000Z",
  "isPaid": true
}
```

**Lỗi:** `404`

---

## Webhook

### POST /api/webhooks/sepay

**Auth:** `verifySePaySecret` (header token từ SePay) | **Rate limit:** `webhookLimiter`

**Body (SePay format):**
```json
{
  "id": 12345678,
  "gateway": "VietcomBank",
  "transactionDate": "2026-08-22 09:15:00",
  "accountNumber": "123456789",
  "transferType": "in",
  "transferAmount": 25191000,
  "accumulated": 25191000,
  "code": null,
  "content": "ORD-20260822-A1B2C3 chuyen khoan",
  "referenceCode": "FT26234000001",
  "description": "..."
}
```

**Validate:** `id` (number), `transferType` (in|out), `transferAmount` (number), `transactionDate` (valid date)

**Response 200** (luôn, trừ khi payload sai):
```json
{ "handled": true, "status": "MATCHED", "orderCode": "ORD-20260822-A1B2C3" }
```
hoặc:
```json
{ "handled": false, "status": "UNMATCHED", "reason": "Số tiền không khớp: nhận 25000000, cần 25191000" }
```
hoặc:
```json
{ "handled": false, "duplicate": true }
```

**Lỗi:** `400` chỉ khi payload thiếu field bắt buộc (để SePay biết cấu hình sai)

---

## Admin Endpoints (STAFF+)

### GET /api/admin/payment/stats

**Auth:** STAFF+

**Response 200:**
```json
{
  "revenue": 152890000,
  "pending": { "count": 12, "amount": 35280000 },
  "refunded": { "count": 2, "amount": 4500000 },
  "awaitingBankTransfer": { "count": 5, "amount": 18750000 },
  "unmatchedTransactions": { "count": 3, "amount": 12000000 }
}
```

---

### GET /api/admin/payment/transactions

**Auth:** STAFF+

**Query params:**

| Param | Mô tả |
|---|---|
| `status` | MATCHED \| UNMATCHED \| IGNORED |
| `orderCode` | Tìm chính xác (uppercase) |
| `from`, `to` | Date range trên `transactionDate` |
| `page`, `limit` | Phân trang |

**Response 200:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "sepayId": 12345678,
      "gateway": "VietcomBank",
      "accountNumber": "123456789",
      "transferType": "in",
      "transferAmount": 25191000,
      "content": "ORD-20260822-A1B2C3 chuyen khoan",
      "referenceCode": "FT26234000001",
      "transactionDate": "2026-08-22T09:15:00.000Z",
      "status": "MATCHED",
      "orderId": "uuid",
      "orderCode": "ORD-20260822-A1B2C3",
      "note": null,
      "matchedBy": null,
      "matchedAt": null,
      "source": "WEBHOOK",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

> `rawPayload` bị **omit** khỏi response.

---

### GET /api/admin/payment/transactions/unmatched

**Auth:** STAFF+

**Response 200:** Giống format trên, chỉ gồm `status = UNMATCHED`

---

### POST /api/admin/payment/transactions/:txId/match

**Auth:** STAFF+

**Body:**
```json
{
  "orderCode": "ORD-20260822-A1B2C3",
  "force": false
}
```

> `force = true` cho phép gán dù số tiền lệch.

**Response 200:** Transaction đã MATCHED (omit rawPayload)

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | tx đã MATCHED / là tiền ra / số tiền lệch không có force / đơn đã PAID |
| 404 | tx không tồn tại / order không tồn tại |
| 409 | Race: đơn vừa được thanh toán bởi giao dịch khác |

---

### POST /api/admin/payment/sync

**Auth:** STAFF+ | **Rate limit:** `syncLimiter`

**Body (optional):**
```json
{
  "limit": 50,
  "from": "2026-08-20",
  "to": "2026-08-22"
}
```

> `limit` max 200, default 50.

**Response 200:**
```json
{
  "fetched": 35,
  "matched": 28,
  "unmatched": 4,
  "ignored": 1,
  "duplicate": 2
}
```

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 500 | `SEPAY_API_TOKEN` chưa cấu hình |
| 502 | SePay API timeout (15s) hoặc trả HTTP error |
