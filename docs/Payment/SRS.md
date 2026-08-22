# Software Requirements Specification
## Module: Payment
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Routes

| Method | Path | Auth | Middleware |
|---|---|---|---|
| GET | `/api/orders/:id/payment` | Customer+ | `qrLimiter` |
| GET | `/api/orders/:id/payment/status` | Customer+ | — |
| POST | `/api/webhooks/sepay` | Public | `webhookLimiter`, `verifySePaySecret`, `validateSePayWebhook` |
| GET | `/api/admin/payment/stats` | STAFF+ | — |
| GET | `/api/admin/payment/transactions` | STAFF+ | `validateTransactionQuery` |
| GET | `/api/admin/payment/transactions/unmatched` | STAFF+ | — |
| POST | `/api/admin/payment/transactions/:txId/match` | STAFF+ | `validateMatchTransaction` |
| POST | `/api/admin/payment/sync` | STAFF+ | `syncLimiter` |

---

## 2. Functional Requirements

### FR-01: GET /orders/:id/payment — Thông tin thanh toán (VietQR)

- Ownership check: đơn phải thuộc user
- `paymentMethod !== BANK_TRANSFER` → 400
- `paymentStatus === PAID` → 400
- Trả `bankId`, `accountNo`, `accountName`, `amount`, `content` (= orderCode), `qrUrl`
- `qrUrl` = `https://img.vietqr.io/image/{BANK_ID}-{ACCOUNT_NO}-compact2.jpg?amount=...&addInfo={orderCode}&accountName=...`

### FR-02: GET /orders/:id/payment/status — Polling trạng thái

- Ownership check
- Chỉ select: `id`, `orderCode`, `paymentStatus`, `status`, `paidAt`
- Trả thêm `isPaid = paymentStatus === PAID` (convenience field)
- Không rate limit (FE polling mỗi 2–3 giây)

### FR-03: POST /webhooks/sepay — Nhận webhook

- `verifySePaySecret`: verify header/token từ SePay
- `validateSePayWebhook`: check 4 field bắt buộc (id, transferType, transferAmount, transactionDate)
- Gọi `processSePayWebhook` → `ingestTransaction(normalizeWebhook(payload))`
- **Luôn trả 200** (kể cả UNMATCHED/IGNORED/duplicate) để SePay không retry vô ích
- Ngoại lệ: `validateSePayWebhook` trả 400 để SePay biết payload sai cấu hình

### FR-04: GET /admin/payment/stats — Dashboard stats

5 aggregate song song:
- `revenue`: sum(total) WHERE PAID
- `pending`: count + sum(total) WHERE UNPAID
- `refunded`: count + sum(total) WHERE REFUNDED
- `awaitingBankTransfer`: count + sum(total) WHERE UNPAID + BANK_TRANSFER
- `unmatchedTransactions`: count + sum(transferAmount) FROM SePayTransaction WHERE UNMATCHED

### FR-05: GET /admin/payment/transactions — Sổ cái giao dịch

- Filter: `status` (SePayTxStatus), `orderCode`, `from`/`to` (dateRange trên transactionDate)
- Sort: `transactionDate DESC`; phân trang
- `rawPayload` bị omit; `transferAmount` convert Decimal → Number

### FR-06: GET /admin/payment/transactions/unmatched — Hàng chờ xử lý

- Giao dịch `status = UNMATCHED`; cần admin gán tay hoặc điều tra

### FR-07: POST /admin/payment/transactions/:txId/match — Gán tay

1. Tìm tx; 404 nếu không tồn tại
2. tx.status === MATCHED → 400 (đã gán rồi)
3. tx.transferType !== 'in' → 400
4. Tìm order theo `orderCode` (uppercase); 404 nếu không tìm thấy
5. order.paymentStatus === PAID → 400
6. Số tiền lệch + `!force` → 400 với thông tin lệch
7. **Transaction:** `markOrderPaid` + update tx → MATCHED, ghi `matchedBy`, `matchedAt`, `note`
8. count=0 → 409 (đơn vừa được thanh toán bởi giao dịch khác)
9. Trả tx đã cập nhật (omit rawPayload)

### FR-08: POST /admin/payment/sync — Sync từ SePay API

- Gọi SePay UserAPI `/userapi/transactions/list`
- Params: `limit` (max 200, default 50), `account_number`, `from`/`to`
- Timeout 15 giây; SePay không trả lời → 502
- Xử lý **tuần tự** (for..of, không Promise.all) tránh race condition
- Trả summary: `{ fetched, matched, unmatched, ignored, duplicate }`

---

## 3. ingestTransaction — Core Logic

```typescript
async function ingestTransaction(tx: NormalizedSePayTx): Promise<IngestResult>
```

| Bước | Điều kiện | Kết quả |
|---|---|---|
| 1 | `!isFinite(sepayId)` hoặc `isNaN(transactionDate)` | `{ handled: false, reason }` |
| 2 | `findUnique by sepayId` → tồn tại | `{ handled: false, duplicate: true }` |
| 3 | P2002 (2 webhook song song qua dedup) | `{ handled: false, duplicate: true }` |
| 4 | `transferType !== 'in'` | Ghi IGNORED |
| 5 | Không match `ORDER_CODE_RE` | Ghi UNMATCHED |
| 6 | Order không tồn tại | Ghi UNMATCHED |
| 7 | Order đã PAID | Ghi UNMATCHED |
| 8 | `transferAmount !== order.total` | Ghi UNMATCHED |
| 9 | `markOrderPaid` count=0 (race) | Ghi UNMATCHED "vừa được thanh toán" |
| 10 | Thành công | Ghi MATCHED, `handled: true` |

---

## 4. markOrderPaid

```typescript
function markOrderPaid(t, order, paidAt) {
  return t.order.updateMany({
    where: { id: order.id, paymentStatus: PaymentStatus.UNPAID },
    data: {
      paymentStatus: PAID,
      paidAt,
      ...(order.status === PENDING && { status: CONFIRMED }),
    },
  })
}
```

- Dùng `updateMany` thay vì `update` để atomic guard không ném P2025 khi race
- count=0 → đơn đã PAID → caller ghi UNMATCHED thay vì throw

---

## 5. Validators

### validateSePayWebhook
Kiểm tra 4 field bắt buộc: `id` (finite number), `transferType` ('in'|'out'), `transferAmount` (finite), `transactionDate` (valid Date)

### validateMatchTransaction
- `orderCode` required (checkId)
- Format `ORDER_CODE_EXACT_RE` = `ORD-YYYYMMDD-XXXXXX`
- Normalize: `req.body.orderCode = orderCode.trim()`

### validateTransactionQuery
- `status` nếu có phải là `SePayTxStatus` enum

---

## 6. Rate Limiters

| Route | Limiter |
|---|---|
| `GET /orders/:id/payment` | `qrLimiter` |
| `POST /webhooks/sepay` | `webhookLimiter` |
| `POST /admin/payment/sync` | `syncLimiter` |
| `GET /orders/:id/payment/status` | Không rate limit (polling) |
