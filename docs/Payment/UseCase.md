# Use Case Document
## Module: Payment
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## UC-01: Lấy thông tin QR chuyển khoản

**Actor:** Customer  
**Precondition:** Đơn hàng `paymentMethod = BANK_TRANSFER`, `paymentStatus = UNPAID`  
**Flow:**
1. GET `/api/orders/:id/payment`
2. Hệ thống xác nhận đơn thuộc user, đúng phương thức, chưa thanh toán
3. Trả VietQR URL + thông tin ngân hàng

**Exception:**
- Đơn không phải BANK_TRANSFER → 400
- Đơn đã PAID → 400
- Đơn không tồn tại hoặc không phải của user → 404

---

## UC-02: Polling trạng thái thanh toán

**Actor:** Customer (FE gọi mỗi 2–3 giây khi hiển thị QR)  
**Flow:**
1. GET `/api/orders/:id/payment/status`
2. Trả `paymentStatus`, `orderStatus`, `isPaid`, `paidAt`
3. FE hiển thị "Đang chờ thanh toán" / "Thanh toán thành công"

---

## UC-03: Tự động đối soát khi tiền về (Webhook)

**Actor:** SePay (hệ thống bên ngoài)  
**Trigger:** Phát hiện biến động số dư tài khoản ngân hàng  
**Flow:**
1. SePay POST `/api/webhooks/sepay` với payload giao dịch
2. `verifySePaySecret` xác thực nguồn gốc
3. `validateSePayWebhook` kiểm tra 4 field bắt buộc
4. `ingestTransaction`:
   - Dedup theo `sepayId` — nếu đã có → trả 200 ngay
   - `transferType = 'in'` → tìm `ORDER_CODE_RE` trong content → tìm đơn → kiểm tra số tiền
   - Nếu khớp → đánh dấu đơn PAID (+ CONFIRMED nếu đang PENDING)
   - Nếu không khớp → ghi UNMATCHED để admin xử lý
5. **Luôn trả 200** (trừ payload sai format → 400)

**Exception:** SePay retry → dedup ngăn xử lý hai lần

---

## UC-04: Admin xem dashboard thanh toán

**Actor:** Staff / Admin  
**Flow:**
1. GET `/api/admin/payment/stats`
2. Trả tổng doanh thu, đơn chờ thanh toán, hoàn tiền, chờ đối soát CK, giao dịch không khớp

---

## UC-05: Admin tra cứu sổ cái giao dịch

**Actor:** Staff / Admin  
**Flow:**
1. GET `/api/admin/payment/transactions?status=UNMATCHED&orderCode=ORD-2026...`
2. Lọc theo status, orderCode, date range
3. Xem từng giao dịch (omit rawPayload)

---

## UC-06: Admin xem hàng chờ xử lý

**Actor:** Staff / Admin  
**Flow:**
1. GET `/api/admin/payment/transactions/unmatched`
2. Danh sách giao dịch `status = UNMATCHED` — tiền đã về nhưng chưa gán được đơn

---

## UC-07: Admin gán tay giao dịch vào đơn

**Actor:** Staff / Admin  
**Precondition:** Giao dịch UNMATCHED (thường do khách ghi sai nội dung CK)  
**Flow:**
1. POST `/api/admin/payment/transactions/:txId/match` với `{ orderCode, force? }`
2. Validate tx chưa MATCHED, là tiền vào
3. Tìm đơn theo orderCode; kiểm tra chưa PAID
4. Nếu số tiền lệch + không có `force` → 400 với thông tin lệch
5. Nếu `force = true` → cho phép gán dù lệch; ghi note "Gán tay dù lệch tiền"
6. `markOrderPaid` + update tx → MATCHED, ghi `matchedBy`/`matchedAt`

**Exception:**
- Tx đã MATCHED → 400
- Order đã PAID → 400
- Số tiền lệch + thiếu force → 400
- Race condition (đơn vừa được thanh toán) → 409

---

## UC-08: Admin kéo lại giao dịch từ SePay API

**Actor:** Staff / Admin  
**Precondition:** Nghi ngờ webhook bị rớt  
**Flow:**
1. POST `/api/admin/payment/sync` với `{ limit?, from?, to? }`
2. Gọi SePay UserAPI; xử lý giao dịch tuần tự
3. Giao dịch đã có trong DB → bỏ qua (dedup)
4. Trả summary: `{ fetched, matched, unmatched, ignored, duplicate }`

**Exception:** SePay API không trả lời (timeout 15s) → 502
