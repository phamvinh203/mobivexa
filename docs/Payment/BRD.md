# Business Requirements Document
## Module: Payment
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Mục tiêu nghiệp vụ

Tích hợp thanh toán chuyển khoản qua VietQR + SePay: hiển thị mã QR cho khách, tự động đối soát khi tiền về qua webhook, và cung cấp công cụ cho admin xử lý ngoại lệ (giao dịch không khớp, webhook rớt).

---

## 2. Actors

| Actor | Mô tả |
|---|---|
| **Customer** | Lấy thông tin QR để chuyển khoản; polling trạng thái thanh toán |
| **SePay** | Gọi webhook khi phát hiện biến động số dư tài khoản ngân hàng |
| **Staff / Admin** | Xem sổ cái giao dịch, xem hàng chờ UNMATCHED, gán tay, trigger sync |

---

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-01 | Chỉ đơn `paymentMethod = BANK_TRANSFER` mới có QR info; COD trả 400 |
| BR-02 | Đơn đã PAID không lấy được QR (trả 400) |
| BR-03 | Mọi giao dịch SePay đều được ghi vào `SePayTransaction` — không nuốt im lặng |
| BR-04 | Dedup theo `sepayId UNIQUE`: cùng giao dịch đến nhiều lần (SePay retry) chỉ xử lý 1 lần |
| BR-05 | Chỉ giao dịch tiền vào (`transferType = 'in'`) mới khớp đơn; tiền ra → IGNORED |
| BR-06 | Nội dung chuyển khoản phải chứa `ORDER_CODE_RE` match để tìm đơn |
| BR-07 | Số tiền phải khớp chính xác `order.total`; lệch → UNMATCHED |
| BR-08 | Đơn đã PAID → UNMATCHED (không thu tiền hai lần) |
| BR-09 | `markOrderPaid` dùng `updateMany WHERE paymentStatus=UNPAID` (atomic, chống race) |
| BR-10 | Nếu đơn đang PENDING khi tiền về → tự động chuyển sang CONFIRMED |
| BR-11 | `matchTransaction` (gán tay): cho phép lệch tiền nếu truyền `force=true` |
| BR-12 | `syncFromSePay` xử lý tuần tự (không song song) tránh hai giao dịch gán cùng một đơn |
| BR-13 | Đơn `total = 0` đã PAID lúc tạo; không cần QR, webhook không ảnh hưởng |
| BR-14 | `rawPayload` (JSON thô từ SePay) được lưu nhưng bị omit khỏi mọi API response |

---

## 4. Luồng xử lý giao dịch (ingestTransaction)

```
1. Validate sepayId (finite) + transactionDate (valid Date)
2. Dedup: findUnique by sepayId → nếu tồn tại → trả duplicate=true
3. resolveAndRecord:
   a. transferType != 'in' → ghi IGNORED
   b. Không match ORDER_CODE_RE trong content → ghi UNMATCHED
   c. Order not found → ghi UNMATCHED
   d. Order đã PAID → ghi UNMATCHED
   e. transferAmount != order.total → ghi UNMATCHED
   f. Transaction: markOrderPaid + ghi MATCHED
      (count=0 nghĩa là race condition → ghi UNMATCHED "vừa được thanh toán bởi giao dịch khác")
4. P2002 lọt qua dedup (hai webhook song song) → trả duplicate=true
```

---

## 5. Phạm vi module

**Trong phạm vi:**
- Tạo VietQR URL cho đơn BANK_TRANSFER
- Polling trạng thái thanh toán (nhẹ, không load items)
- Webhook nhận giao dịch SePay (tự động đối soát)
- Admin: sổ cái giao dịch, hàng chờ UNMATCHED, gán tay, sync từ SePay API
- Dashboard stats (revenue, pending, refunded, awaitingBankTransfer, unmatched)

**Ngoài phạm vi:**
- COD (không cần thanh toán online)
- Hoàn tiền tự động (admin đổi paymentStatus=REFUNDED thủ công qua `/admin/orders/:id/payment`)
- Thanh toán qua Stripe/VNPAY/MoMo
