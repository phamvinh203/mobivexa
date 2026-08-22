# Test Case Document
## Module: Payment
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| QR info | 4 |
| Polling status | 3 |
| Webhook ingest | 9 |
| Admin stats | 2 |
| Admin transactions list | 3 |
| Admin gán tay | 7 |
| Admin sync | 4 |
| **Tổng** | **32** |

---

## TC-QR: Thông tin thanh toán QR

### TC-QR-01: Lấy QR thành công

**Precondition:** Đơn BANK_TRANSFER, UNPAID, thuộc user  
**Expected:**
- `200`
- `qrUrl` chứa `img.vietqr.io`
- `content === orderCode`
- `amount` đúng với `order.total`

---

### TC-QR-02: Đơn COD → 400

**Expected:** `400 Đơn hàng không dùng phương thức chuyển khoản`

---

### TC-QR-03: Đơn đã PAID → 400

**Expected:** `400 Đơn hàng đã được thanh toán`

---

### TC-QR-04: Đơn không phải của user → 404

**Expected:** `404`

---

## TC-STATUS: Polling trạng thái

### TC-STATUS-01: Trả đủ fields

**Expected:** `200`; có `paymentStatus`, `orderStatus`, `isPaid`, `paidAt`, `orderCode`

---

### TC-STATUS-02: isPaid = true khi PAID

**Precondition:** Đơn đã PAID  
**Expected:** `isPaid === true`, `paidAt !== null`

---

### TC-STATUS-03: Đơn không phải của user → 404

**Expected:** `404`

---

## TC-WEBHOOK: Webhook ingest

### TC-WH-01: Giao dịch tiền vào khớp đơn → MATCHED

**Input:**
```json
{ "id": 1001, "transferType": "in", "transferAmount": 25191000,
  "content": "ORD-20260822-A1B2C3 chuyen tien", "transactionDate": "2026-08-22 09:15:00" }
```
**Precondition:** Đơn ORD-20260822-A1B2C3 tồn tại, total=25191000, UNPAID  
**Expected:**
- `200 { handled: true, status: MATCHED }`
- `order.paymentStatus = PAID`
- `order.status = CONFIRMED` (nếu trước đó là PENDING)
- `SePayTransaction` được tạo với `status=MATCHED`

---

### TC-WH-02: Dedup — giao dịch đã xử lý (SePay retry)

**Action:** Gửi cùng payload 2 lần  
**Expected lần 2:** `200 { handled: false, duplicate: true }`  
**Verify:** `SePayTransaction` chỉ có 1 record với `sepayId=1001`

---

### TC-WH-03: Giao dịch tiền ra → IGNORED

**Input:** `transferType = 'out'`  
**Expected:** `200`; SePayTransaction với `status=IGNORED`

---

### TC-WH-04: Nội dung không có mã đơn → UNMATCHED

**Input:** `content = "chuyen khoan khong co ma"`  
**Expected:** `200`; SePayTransaction với `status=UNMATCHED`, `note` chứa "Không tìm thấy mã đơn"

---

### TC-WH-05: Mã đơn không tồn tại → UNMATCHED

**Input:** `content = "ORD-20260101-FFFFFF"`  
**Expected:** `200`; `status=UNMATCHED`, note chứa "Không tìm thấy đơn hàng"

---

### TC-WH-06: Số tiền lệch → UNMATCHED

**Input:** `transferAmount = 20000000` nhưng `order.total = 25191000`  
**Expected:** `200`; `status=UNMATCHED`, note chứa "Số tiền không khớp"

---

### TC-WH-07: Đơn đã PAID → UNMATCHED (chặn thanh toán 2 lần)

**Precondition:** Đơn đã `paymentStatus=PAID`  
**Expected:** `200`; SePayTransaction với `status=UNMATCHED`, note "Đã thanh toán trước đó"

---

### TC-WH-08: Race condition — 2 webhook cùng đơn song song

**Action:** 2 request webhook với cùng `id` khác nhau nhưng cùng orderCode  
**Expected:**
- Cái đến trước: `status=MATCHED`; `order.paymentStatus=PAID`
- Cái sau: `status=UNMATCHED`, note "vừa được thanh toán bởi giao dịch khác"
- `order.paymentStatus` không bị cập nhật 2 lần

---

### TC-WH-09: Payload thiếu field bắt buộc → 400

**Input:** Bỏ `transferAmount`  
**Expected:** `400` (không phải 200 — để SePay biết cấu hình sai)

---

## TC-STATS: Admin dashboard

### TC-STATS-01: Trả đủ 5 keys

**Expected:** `revenue`, `pending`, `refunded`, `awaitingBankTransfer`, `unmatchedTransactions`

---

### TC-STATS-02: awaitingBankTransfer chỉ đếm BANK_TRANSFER + UNPAID

**Precondition:** 2 đơn COD UNPAID; 1 đơn BANK_TRANSFER UNPAID  
**Expected:** `awaitingBankTransfer.count === 1`

---

## TC-TX-LIST: Admin sổ cái giao dịch

### TC-TX-LIST-01: rawPayload bị omit

**Expected:** Response không có `rawPayload` field

---

### TC-TX-LIST-02: Filter status=UNMATCHED

**Expected:** Tất cả tx trong response có `status === UNMATCHED`

---

### TC-TX-LIST-03: Filter orderCode chính xác (case-insensitive normalize)

**Input:** `?orderCode=ord-20260822-a1b2c3` (chữ thường)  
**Expected:** Tìm thấy tx của `ORD-20260822-A1B2C3`

---

## TC-MATCH: Admin gán tay

### TC-MATCH-01: Gán tay thành công (số tiền khớp)

**Expected:**
- `200`; `tx.status=MATCHED`, `tx.matchedBy=adminId`, `tx.matchedAt!=null`
- `order.paymentStatus=PAID`

---

### TC-MATCH-02: Gán tay với force=true (số tiền lệch)

**Precondition:** tx.transferAmount=20000000; order.total=25191000  
**Input:** `{ orderCode, force: true }`  
**Expected:**
- `200`; `tx.note` chứa "Gán tay dù lệch tiền"
- `order.paymentStatus=PAID`

---

### TC-MATCH-03: Số tiền lệch không có force → 400

**Expected:** `400` chứa thông tin số tiền lệch và gợi ý `force=true`

---

### TC-MATCH-04: tx đã MATCHED → 400

**Expected:** `400 Giao dịch đã được gán đơn`

---

### TC-MATCH-05: tx tiền ra → 400

**Expected:** `400 Không thể gán giao dịch tiền ra`

---

### TC-MATCH-06: Order đã PAID → 400

**Expected:** `400 Đơn hàng đã được thanh toán`

---

### TC-MATCH-07: Race — đơn vừa được thanh toán → 409

**Scenario:** webhook khớp đơn ngay trước khi admin gán tay  
**Expected:** `409 Đơn hàng vừa được thanh toán bởi giao dịch khác`

---

## TC-SYNC: Admin sync từ SePay API

### TC-SYNC-01: Sync thành công trả summary

**Expected:** `200`; có `fetched`, `matched`, `unmatched`, `ignored`, `duplicate`

---

### TC-SYNC-02: Giao dịch đã có trong DB → duplicate (dedup)

**Precondition:** sepayId đã có trong DB  
**Expected:** `summary.duplicate` tăng; không tạo bản ghi mới

---

### TC-SYNC-03: SePay API timeout → 502

**Mock:** Không có response sau 15 giây  
**Expected:** `502`

---

### TC-SYNC-04: Chưa cấu hình SEPAY_API_TOKEN → 500

**Expected:** `500 Chưa cấu hình SEPAY_API_TOKEN`

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Dedup qua sepayId | TC-WH-02, TC-SYNC-02 |
| Tiền ra → IGNORED | TC-WH-03 |
| markOrderPaid atomic (race) | TC-WH-08 |
| PENDING → CONFIRMED khi PAID | TC-WH-01 |
| Không thu tiền 2 lần | TC-WH-07 |
| rawPayload omit | TC-TX-LIST-01 |
| force bypass amount check | TC-MATCH-02 |
| Race condition gán tay | TC-MATCH-07 |
| SEPAY_API_TOKEN missing | TC-SYNC-04 |
