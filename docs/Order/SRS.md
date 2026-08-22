# Software Requirements Specification
## Module: Order
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Routes

| Method | Path | Auth | Validator |
|---|---|---|---|
| POST | `/api/orders` | Customer+ | `validateCreateOrder` |
| GET | `/api/orders` | Customer+ | — |
| GET | `/api/orders/:id` | Customer+ | — |
| PATCH | `/api/orders/:id/cancel` | Customer+ | — |
| GET | `/api/admin/orders` | STAFF+ | — |
| GET | `/api/admin/orders/:id` | STAFF+ | — |
| PATCH | `/api/admin/orders/:id/status` | STAFF+ | `validateUpdateStatus` |
| PATCH | `/api/admin/orders/:id/payment` | STAFF+ | `validateUpdatePayment` |

---

## 2. Functional Requirements

### FR-01: POST /orders — Tạo đơn hàng

**Input:** `addressId` (required), `paymentMethod` (COD|BANK_TRANSFER, default COD), `note?`, `items?[]`, `couponCode?`

**Flow:**
1. Parallel: validate address (thuộc user) + resolve items (từ `items[]` hoặc giỏ hàng)
2. Fetch variants, validate `isActive`, build `orderItems[]` với snapshot giá
3. Tính `subtotal = sum(unitPrice * quantity)`; `shippingFee = 0`
4. Nếu có `couponCode`: normalize → `checkCouponUsable` → `computeDiscount`
5. `total = subtotal + shippingFee - discount`
6. `settled = total === 0` → `paymentStatus=PAID, paidAt=now()`
7. **Transaction:**
   - `order.create` với `items.create[]`
   - `productVariant.updateMany WHERE stock >= quantity` (atomic decrement); `count=0` → throw 400
   - Nếu có coupon với `usageLimit`: `coupon.updateMany WHERE usedCount < usageLimit`; `count=0` → throw 409
   - `couponUsage.create`; P2002 → throw 409
   - Nếu đặt từ giỏ: `cartItem.deleteMany`

### FR-02: GET /orders — Danh sách đơn của tôi

- Filter: `status`
- Include: `items` (tất cả fields)
- Sort: `createdAt DESC`; phân trang

### FR-03: GET /orders/:id — Chi tiết đơn của tôi

- Ownership check: `WHERE id=orderId AND userId=userId` (404 nếu không phải chủ)
- Include: `items`

### FR-04: PATCH /orders/:id/cancel — Khách hủy đơn

- Kiểm tra trạng thái cho phép hủy qua `VALID_TRANSITIONS`
- Gọi `cancelAndRestoreStock` với `cancelReason = 'Khách hàng hủy đơn'`

### FR-05: GET /admin/orders — Admin xem tất cả đơn

- Filter: `search` (contains orderCode, insensitive), `status`, `userId`, `paymentMethod`, `paymentStatus`, `from`/`to` (dateRange)
- Include: `_count.items`, `user {id, fullName, email}` (không load chi tiết items)
- Sort: `createdAt DESC`; phân trang

### FR-06: GET /admin/orders/:id — Admin xem chi tiết

- Include: `items` (tất cả fields)

### FR-07: PATCH /admin/orders/:id/status — Chuyển trạng thái

- Validate: `status` là OrderStatus hợp lệ; nếu CANCELLED thì `cancelReason` required
- Kiểm tra `VALID_TRANSITIONS`
- Nếu CANCELLED → `cancelAndRestoreStock`
- Các trạng thái khác → `order.update WHERE id AND status=currentStatus` (concurrency guard); P2025 → 409

### FR-08: PATCH /admin/orders/:id/payment — Cập nhật thanh toán

- Validate: `paymentStatus` là PaymentStatus hợp lệ
- Update trực tiếp, không guard concurrency (thanh toán không có state machine)

---

## 3. cancelAndRestoreStock (transaction)

```
1. order.update WHERE id=order.id AND status=order.status → CANCELLED
   P2025 → 409 (đơn vừa được cập nhật bởi request khác)
2. Group items by quantity → updateMany stock += quantity cho mỗi batch
   variantId=null (đã bị SetNull khi variant xóa) → skip
3. Tìm CouponUsage theo orderId
   Nếu tồn tại: xóa CouponUsage + coupon.updateMany usedCount -= 1 WHERE usedCount > 0
```

---

## 4. Validation

### validateCreateOrder
- `addressId`: required, string (checkId)
- `paymentMethod`: nếu có, phải là PaymentMethod enum
- `couponCode`: nếu truthy → `checkId` + `length <= 32` + `CODE_RE` test (uppercase)
- `items`: nếu có, phải là mảng không rỗng; mỗi item có `variantId` (checkId) + `quantity` (checkQuantity)

### validateUpdateStatus
- `status`: phải là OrderStatus enum
- Nếu `status === CANCELLED`: `cancelReason` required (không rỗng)

### validateUpdatePayment
- `paymentStatus`: phải là PaymentStatus enum

---

## 5. Enums

| Enum | Values |
|---|---|
| `OrderStatus` | PENDING, CONFIRMED, SHIPPING, DELIVERED, CANCELLED |
| `PaymentMethod` | COD, BANK_TRANSFER |
| `PaymentStatus` | UNPAID, PAID, REFUNDED |

---

## 6. Helpers

| Helper | Mô tả |
|---|---|
| `generateOrderCode()` | `ORD-{YYYYMMDD}-{randomBytes(3).hex.toUpperCase()}` |
| `resolveItems()` | Trả `itemsInput` nếu có, hoặc lấy từ giỏ hàng; export để coupon.service dùng |
| `VALID_TRANSITIONS` | Record<OrderStatus, OrderStatus[]> — nguồn sự thật duy nhất cho luồng |
| `asConflict()` | P2025 → AppError 409; dùng với `.catch(asConflict)` |
| `cancelAndRestoreStock()` | Transaction hủy đơn + hoàn kho + hoàn coupon |
