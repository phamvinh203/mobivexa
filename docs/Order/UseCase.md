# Use Case Document
## Module: Order
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## UC-01: Đặt hàng từ giỏ hàng

**Actor:** Customer  
**Precondition:** Giỏ hàng có ít nhất 1 sản phẩm; có địa chỉ giao hàng  
**Flow:**
1. POST `/api/orders` với `addressId` (không truyền `items`)
2. Hệ thống lấy items từ giỏ hàng
3. Validate address, variant `isActive`, stock
4. Tính tổng tiền, áp dụng coupon nếu có
5. Tạo đơn + decrement stock + xóa giỏ (trong 1 transaction)
6. Trả đơn mới

**Exception:**
- Giỏ rỗng → 400
- Address không phải của user → 404
- Variant không `isActive` → 400
- Stock không đủ → 400 (transaction rollback)
- Coupon hết lượt → 409

---

## UC-02: Đặt hàng trực tiếp (buy now)

**Actor:** Customer  
**Precondition:** Có địa chỉ giao hàng  
**Flow:**
1. POST `/api/orders` với `addressId` + `items: [{ variantId, quantity }]`
2. Hệ thống dùng `items` được truyền (không đọc giỏ)
3. Giỏ hàng **không** bị xóa
4. Các bước còn lại giống UC-01

---

## UC-03: Xem danh sách đơn hàng

**Actor:** Customer  
**Flow:**
1. GET `/api/orders?status=PENDING`
2. Hệ thống lọc đơn thuộc user, phân trang
3. Trả danh sách kèm items

---

## UC-04: Xem chi tiết đơn hàng

**Actor:** Customer  
**Flow:**
1. GET `/api/orders/:id`
2. Ownership check: đơn phải thuộc user

**Exception:** Đơn không tồn tại hoặc không phải của user → 404

---

## UC-05: Khách hủy đơn

**Actor:** Customer  
**Precondition:** Trạng thái đơn cho phép hủy  
**Flow:**
1. PATCH `/api/orders/:id/cancel`
2. Kiểm tra ownership
3. Kiểm tra `VALID_TRANSITIONS[status].includes(CANCELLED)`
4. Hủy đơn + hoàn kho + hoàn coupon (transaction)

**Exception:**
- Đơn đã DELIVERED/CANCELLED → 400
- Concurrency: đơn vừa được cập nhật → 409

---

## UC-06: Admin xem tất cả đơn

**Actor:** Staff / Admin  
**Flow:**
1. GET `/api/admin/orders?search=ORD-2026&status=PENDING`
2. Tìm kiếm theo orderCode (contains, insensitive), lọc theo status/userId/paymentMethod/paymentStatus/date range
3. Trả danh sách kèm `_count.items` và thông tin user (không load chi tiết items)

---

## UC-07: Admin xem chi tiết đơn

**Actor:** Staff / Admin  
**Flow:**
1. GET `/api/admin/orders/:id`
2. Trả đơn với `items[]` đầy đủ

**Exception:** 404

---

## UC-08: Admin chuyển trạng thái đơn

**Actor:** Staff / Admin  
**Precondition:** Trạng thái mới phải nằm trong `VALID_TRANSITIONS[currentStatus]`  
**Flow:**
1. PATCH `/api/admin/orders/:id/status` với `{ status, cancelReason? }`
2. Validate transition hợp lệ
3. Nếu CANCELLED → `cancelAndRestoreStock`
4. Nếu không → update với guard `WHERE status=currentStatus`

**Exception:**
- Transition không hợp lệ → 400
- CANCELLED thiếu `cancelReason` → 400
- Concurrency → 409

---

## UC-09: Admin cập nhật trạng thái thanh toán

**Actor:** Staff / Admin  
**Flow:**
1. PATCH `/api/admin/orders/:id/payment` với `{ paymentStatus }`
2. Validate enum
3. Update trực tiếp

**Exception:** 404
