# Test Case Document
## Module: Order
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| Tạo đơn hàng | 10 |
| Customer xem đơn | 4 |
| Customer hủy đơn | 5 |
| Admin xem đơn | 3 |
| Admin chuyển trạng thái | 7 |
| Admin cập nhật thanh toán | 3 |
| **Tổng** | **32** |

---

## TC-CREATE: Tạo đơn hàng

### TC-CREATE-01: Tạo từ giỏ hàng thành công

**Precondition:** Giỏ có 2 sản phẩm; address của user  
**Input:** `{ addressId }` (không truyền items)  
**Expected:**
- `201`
- `orderCode` format `ORD-YYYYMMDD-XXXXXX`
- `status = PENDING`
- `items.length === 2`
- Giỏ hàng bị xóa

---

### TC-CREATE-02: Tạo trực tiếp (buy now) — giỏ không bị xóa

**Input:** `{ addressId, items: [{variantId, quantity: 1}] }`  
**Expected:**
- `201`
- Giỏ hàng **còn nguyên**

---

### TC-CREATE-03: Address không thuộc user → 404

**Input:** `addressId` của user khác  
**Expected:** `404`

---

### TC-CREATE-04: Giỏ rỗng (không truyền items) → 400

**Precondition:** Giỏ trống  
**Expected:** `400 Giỏ hàng trống`

---

### TC-CREATE-05: Variant không active → 400

**Precondition:** Variant có `isActive = false`  
**Expected:** `400 Sản phẩm đã ngừng bán`

---

### TC-CREATE-06: Stock không đủ → 400 + rollback

**Precondition:** Variant có `stock = 1`  
**Input:** `quantity = 2`  
**Expected:**
- `400 không đủ hàng`
- Đơn hàng **không được tạo** trong DB

---

### TC-CREATE-07: Coupon hợp lệ → giảm giá chính xác

**Precondition:** Coupon PERCENT 10%, `minOrderValue = 100000`  
**Input:** subtotal = 27990000  
**Expected:**
- `discount = 2799000`
- `total = 25191000`
- `couponCode` được snapshot vào đơn

---

### TC-CREATE-08: Coupon hết lượt (race condition) → 409 + rollback

**Precondition:** Coupon `usageLimit = 1`, đã dùng 1 lần (usedCount = 1)  
**Expected:** `409 Mã giảm giá vừa hết lượt sử dụng`

---

### TC-CREATE-09: total = 0 → paymentStatus = PAID

**Precondition:** Coupon giảm 100% hoặc FIXED >= subtotal  
**Expected:**
- `paymentStatus = PAID`
- `paidAt != null`

---

### TC-CREATE-10: Coupon dùng hai lần cùng lúc (P2002) → 409

**Precondition:** 2 request đồng thời dùng cùng coupon với cùng user  
**Expected:** Chỉ 1 thành công; cái sau `409 Bạn đã sử dụng mã này rồi`

---

## TC-LIST: Customer xem đơn

### TC-LIST-01: Xem danh sách đơn của mình

**Expected:**
- `200`
- Chỉ trả đơn thuộc user đang đăng nhập
- Sort `createdAt DESC`

---

### TC-LIST-02: Lọc theo status

**Input:** `?status=PENDING`  
**Expected:** Tất cả đơn có `status === PENDING`

---

### TC-LIST-03: Xem chi tiết đơn — include items

**Expected:** `200`; response có `items[]` đầy đủ

---

### TC-LIST-04: Xem đơn của người khác → 404

**Input:** `orderId` của user khác  
**Expected:** `404`

---

## TC-CANCEL: Customer hủy đơn

### TC-CANCEL-01: Hủy đơn PENDING thành công + hoàn kho

**Precondition:** Stock biến thể = 5; đơn quantity = 2  
**Expected:**
- `200`, `status = CANCELLED`
- Stock biến thể = 7

---

### TC-CANCEL-02: Hủy đơn CONFIRMED thành công

**Expected:** `200`, `status = CANCELLED`

---

### TC-CANCEL-03: Hủy đơn DELIVERED → 400

**Expected:** `400 Không thể hủy đơn hàng ở trạng thái hiện tại`

---

### TC-CANCEL-04: Hủy đơn đã CANCELLED → 400

**Expected:** `400`

---

### TC-CANCEL-05: Hủy đơn có coupon → hoàn lượt mã

**Precondition:** Đơn dùng coupon; `usedCount = 1`  
**Expected:** Sau khi hủy: `usedCount = 0`; `CouponUsage` bị xóa

---

## TC-ADMIN-LIST: Admin xem đơn

### TC-ADMIN-LIST-01: CUSTOMER không có quyền → 403

**Expected:** `403`

---

### TC-ADMIN-LIST-02: Search theo orderCode (partial)

**Input:** `?search=A1B2`  
**Expected:** Chỉ đơn có orderCode chứa "A1B2" (case-insensitive)

---

### TC-ADMIN-LIST-03: Admin list trả _count.items, không trả items[]

**Expected:** Response có `_count.items` (number), **không** có `items[]`

---

## TC-STATUS: Admin chuyển trạng thái

### TC-STATUS-01: PENDING → CONFIRMED thành công

**Expected:** `200`, `status = CONFIRMED`

---

### TC-STATUS-02: CONFIRMED → DELIVERED → 400 (nhảy cóc)

**Expected:** `400 Không thể chuyển từ "CONFIRMED" sang "DELIVERED"`

---

### TC-STATUS-03: Admin hủy SHIPPING thành công + hoàn kho

**Input:** `{ status: CANCELLED, cancelReason: "Lỗi hàng" }`  
**Expected:**
- `200`, `status = CANCELLED`
- Stock được hoàn

---

### TC-STATUS-04: Admin hủy thiếu cancelReason → 400

**Input:** `{ status: CANCELLED }` (thiếu cancelReason)  
**Expected:** `400 Vui lòng nhập lý do hủy đơn`

---

### TC-STATUS-05: DELIVERED → không thể chuyển tiếp → 400

**Expected:** `400`

---

### TC-STATUS-06: Concurrency conflict → 409

**Scenario:** 2 admin cùng chuyển 1 đơn  
**Expected:** Cái sau nhận `409 Đơn hàng vừa được cập nhật ở nơi khác`

---

### TC-STATUS-07: variantId null khi hủy → skip, không lỗi

**Precondition:** OrderItem có `variantId = null` (variant đã bị xóa)  
**Expected:** `200`, kho không cộng thêm cho variant null

---

## TC-PAYMENT: Admin cập nhật thanh toán

### TC-PAYMENT-01: UNPAID → PAID thành công

**Expected:** `200`, `paymentStatus = PAID`

---

### TC-PAYMENT-02: paymentStatus không hợp lệ → 400

**Input:** `{ paymentStatus: "INVALID" }`  
**Expected:** `400`

---

### TC-PAYMENT-03: Đơn không tồn tại → 404

**Expected:** `404`

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Stock atomic decrement + rollback | TC-CREATE-06 |
| total=0 → PAID ngay lúc tạo | TC-CREATE-09 |
| Coupon race condition | TC-CREATE-08, TC-CREATE-10 |
| Đặt từ giỏ → xóa giỏ | TC-CREATE-01 |
| Buy now → giỏ giữ nguyên | TC-CREATE-02 |
| Hoàn kho khi hủy | TC-CANCEL-01, TC-STATUS-03 |
| Hoàn coupon khi hủy | TC-CANCEL-05 |
| null variantId skip khi hủy | TC-STATUS-07 |
| Concurrency guard P2025 | TC-STATUS-06 |
| VALID_TRANSITIONS | TC-STATUS-02, TC-STATUS-05 |
