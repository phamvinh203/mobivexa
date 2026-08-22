# Business Requirements Document
## Module: Order
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Mục tiêu nghiệp vụ

Cho phép khách hàng đặt hàng từ giỏ hoặc trực tiếp từ sản phẩm, theo dõi và hủy đơn. Admin/Staff quản lý vòng đời đơn hàng và trạng thái thanh toán.

---

## 2. Actors

| Actor | Mô tả |
|---|---|
| **Customer** | Tạo đơn, xem đơn của mình, hủy đơn |
| **Staff / Admin** | Xem tất cả đơn, chuyển trạng thái, cập nhật thanh toán |

---

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-01 | Đặt hàng từ giỏ (nếu không truyền `items`) hoặc truyền `items[]` trực tiếp |
| BR-02 | Địa chỉ phải thuộc user đặt hàng |
| BR-03 | Biến thể phải `isActive = true`; stock kiểm tra atomic trong transaction |
| BR-04 | Giá snapshot tại thời điểm đặt: `unitPrice = salePrice`, `productName`, `sku`, `color`, `storage`, `ram` |
| BR-05 | `shippingFee` hiện tại = 0 (miễn phí ship); `total = subtotal + shippingFee - discount` |
| BR-06 | `couponCode` được snapshot vào đơn; mã thay đổi sau không ảnh hưởng đơn cũ |
| BR-07 | Đơn `total = 0` → `paymentStatus = PAID`, `paidAt = now()` ngay lúc tạo |
| BR-08 | Luồng trạng thái: `PENDING → CONFIRMED → SHIPPING → DELIVERED`; nhánh hủy: bất kỳ trạng thái nào có trong `VALID_TRANSITIONS` |
| BR-09 | Hủy đơn → hoàn kho (theo batch) + hoàn lượt dùng mã coupon (trong 1 transaction) |
| BR-10 | Customer chỉ hủy được khi trạng thái hiện tại cho phép (PENDING/CONFIRMED/SHIPPING) |
| BR-11 | Admin hủy phải kèm `cancelReason` |
| BR-12 | Nếu đặt từ giỏ (không truyền `items`) → xóa toàn bộ CartItem sau khi tạo đơn |
| BR-13 | Stock decrement atomic: `WHERE id=variantId AND stock >= quantity`; `count=0` → rollback + 400 |
| BR-14 | Coupon increment atomic: `WHERE id AND usedCount < usageLimit`; `count=0` → rollback + 409 |
| BR-15 | Concurrency guard: ghi trạng thái kèm `WHERE status=currentStatus`; P2025 → 409 |
| BR-16 | `orderCode` = `ORD-{YYYYMMDD}-{6HEX}` (random 3 bytes) |

---

## 4. Luồng trạng thái hợp lệ

```
PENDING   → CONFIRMED | CANCELLED
CONFIRMED → SHIPPING  | CANCELLED
SHIPPING  → DELIVERED | CANCELLED
DELIVERED → (terminal)
CANCELLED → (terminal)
```

---

## 5. Phạm vi module

**Trong phạm vi:**
- Tạo đơn (từ giỏ hoặc trực tiếp), kèm coupon tùy chọn
- Customer: xem danh sách, xem chi tiết, hủy đơn
- Admin: xem all, xem chi tiết, chuyển trạng thái, cập nhật paymentStatus

**Ngoài phạm vi:**
- Thanh toán online (xem module Payment)
- Webhook SePay (xem module Payment)
- Xóa đơn
