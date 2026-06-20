# SRS — Software Requirement Specification
## Module: Order (Đơn hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Phạm vi hệ thống

Module Order cung cấp các chức năng:
- Đặt hàng từ giỏ hàng hoặc mua ngay
- Xem danh sách và chi tiết đơn hàng
- Hủy đơn hàng (Customer và Admin)
- Cập nhật trạng thái đơn hàng (Admin)
- Cập nhật trạng thái thanh toán (Admin)

**Ngoài phạm vi:** Payment gateway integration (webhook SePay), Coupon system, Shipping fee calculation.

---

## 2. Yêu cầu chức năng (Functional Requirements)

### FR-01: Đặt hàng

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-01 |
| **Tên** | Tạo đơn hàng mới |
| **Ưu tiên** | Cao |
| **Endpoint** | `POST /api/orders` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `addressId` (string, required): ID địa chỉ giao hàng
- `paymentMethod` (string, optional): `COD` (default) hoặc `BANK_TRANSFER`
- `note` (string, optional): Ghi chú cho shop
- `items` (array, optional): Nếu không gửi → lấy từ Cart

**Mỗi item trong `items`:**
- `variantId` (string, required)
- `quantity` (number, required): ≥ 1

**Xử lý:**
1. Validate `addressId` bắt buộc
2. Resolve items: từ body hoặc từ Cart của user
3. Validate items không rỗng
4. **Song song:** Check address thuộc user + lấy tất cả variants
5. Validate variants tồn tại + `isActive = true`
6. Tính toán: `unitPrice`, `subtotal` từng item, `total` toàn đơn
7. Sinh `orderCode`: `ORD-{YYYYMMDD}-{6 HEX chars}`
8. **DB Transaction:**
   - Tạo Order + OrderItems (snapshot info)
   - Atomic decrement stock: `WHERE stock >= quantity`
   - Nếu `count === 0` → rollback + lỗi `400`
   - Xóa CartItems (nếu đặt từ giỏ)
9. Trả về `201` + order object đầy đủ

**Đầu ra thành công:** `201` + order object với items, shipping address, user info

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Thiếu addressId | 400 | `Vui lòng chọn địa chỉ giao hàng` |
| paymentMethod không hợp lệ | 400 | `Phương thức thanh toán không hợp lệ` |
| items rỗng (body hoặc cart) | 400 | `Danh sách sản phẩm không hợp lệ` |
| Giỏ hàng trống (đặt từ giỏ) | 400 | `Giỏ hàng trống, không thể đặt hàng` |
| Address không tồn tại/không thuộc user | 404 | `Địa chỉ không tồn tại` |
| Variant không tồn tại | 400 | `Sản phẩm không tồn tại: {variantId}` |
| Variant inactive | 400 | `Sản phẩm đã ngừng bán: {sku}` |
| Hết hàng (race condition) | 400 | `Sản phẩm "{sku}" không đủ hàng` |

---

### FR-02: Danh sách đơn của tôi

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-02 |
| **Tên** | Xem danh sách đơn hàng của chính mình |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/orders` |
| **Auth** | CUSTOMER+ |

**Đầu vào (Query params):**
- `page` (number, optional): default 1
- `limit` (number, optional): default 10, max 50
- `status` (string, optional): `OrderStatus` filter

**Xử lý:**
1. Lấy `userId` từ JWT token
2. Query: `WHERE userId = req.user.userId`
3. Apply filter status nếu có
4. Sort by `createdAt DESC`
5. Paginate

**Đầu ra thành công:** `200` + `{ orders, pagination }`

---

### FR-03: Chi tiết đơn hàng của tôi

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-03 |
| **Tên** | Xem chi tiết đơn hàng |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/orders/:id` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `id` (string, required): Order ID

**Xử lý:**
1. Query: `WHERE id = ? AND userId = req.user.userId`
2. Include OrderItems, User, Address snapshot
3. Nếu không tìm thấy → `404` (không phân biệt không tồn tại hay không thuộc user)

**Đầu ra thành công:** `200` + order object (full detail)

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không tìm thấy hoặc không thuộc user | 404 | `Đơn hàng không tồn tại` |

---

### FR-04: Hủy đơn hàng (Customer)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-04 |
| **Tên** | Khách hàng hủy đơn hàng |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `PATCH /api/orders/:id/cancel` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `cancelReason` (string, optional): Lý do hủy

**Xử lý:**
1. Query: `WHERE id = ? AND userId = req.user.userId`
2. Validate trạng thái hiện tại có trong `VALID_TRANSITIONS` cho CANCELLED
3. **DB Transaction:**
   - Update `status = CANCELLED`, `cancelReason`
   - Hoàn trả stock cho từng item (`increment by quantity`)
4. Trả về `200` + order object

**Đầu ra thành công:** `200` + order object với `status = CANCELLED`

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không tìm thấy hoặc không thuộc user | 404 | `Đơn hàng không tồn tại` |
| Trạng thái không cho phép hủy | 400 | `Không thể hủy đơn hàng ở trạng thái hiện tại` |

---

### FR-05: Danh sách đơn hàng (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-05 |
| **Tên** | Admin xem tất cả đơn hàng |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/admin/orders` |
| **Auth** | STAFF+ |

**Đầu vào (Query params):**
- `page`, `limit` (pagination)
- `status` (OrderStatus filter)
- `userId` (filter theo user)
- `paymentMethod` (`COD` / `BANK_TRANSFER`)
- `paymentStatus` (`UNPAID` / `PAID` / `REFUNDED`)
- `from` (ISO date start)
- `to` (ISO date end)

**Xử lý:**
1. Build where clause theo tất cả filters
2. Sort by `createdAt DESC`
3. Return `_count.items` thay vì hydrate toàn bộ items (optimization)
4. Include User (`id`, `fullName`, `email`)

**Đầu ra thành công:** `200` + `{ orders, pagination }`

---

### FR-06: Chi tiết đơn hàng (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-06 |
| **Tên** | Admin xem chi tiết đơn hàng bất kỳ |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/admin/orders/:id` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `id` (string, required): Order ID

**Xử lý:**
1. Find order by ID
2. Include đầy đủ: OrderItems, User, Address

**Đầu ra thành công:** `200` + order object (full detail)

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không tìm thấy | 404 | `Đơn hàng không tồn tại` |

---

### FR-07: Cập nhật trạng thái đơn (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-07 |
| **Tên** | Admin cập nhật trạng thái đơn hàng |
| **Ưu tiên** | Cao |
| **Endpoint** | `PATCH /api/admin/orders/:id/status` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `status` (OrderStatus, required)
- `cancelReason` (string, required if `status = CANCELLED`)

**Xử lý:**
1. Validate `status` là giá trị hợp lệ của OrderStatus
2. Nếu `status = CANCELLED` → validate `cancelReason` bắt buộc
3. Find order by ID
4. Validate transition theo `VALID_TRANSITIONS`
5. Nếu `status ≠ CANCELLED` → update thẳng
6. Nếu `status = CANCELLED` → **DB Transaction:** update status + hoàn stock

**Đầu ra thành công:** `200` + order object

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| status không hợp lệ | 400 | `Trạng thái đơn hàng không hợp lệ` |
| Hủy mà thiếu cancelReason | 400 | `Vui lòng nhập lý do hủy đơn` |
| Chuyển trạng thái không được phép | 400 | `Không thể chuyển từ "{from}" sang "{to}"` |
| Không tìm thấy | 404 | `Đơn hàng không tồn tại` |

---

### FR-08: Cập nhật thanh toán (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-08 |
| **Tên** | Admin cập nhật trạng thái thanh toán |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `PATCH /api/admin/orders/:id/payment` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `paymentStatus` (PaymentStatus, required): `UNPAID` / `PAID` / `REFUNDED`

**Xử lý:**
1. Validate `paymentStatus` hợp lệ
2. Find order (lean check)
3. Update `paymentStatus`
4. Nếu `paymentStatus = PAID` → set `paidAt = NOW()`

**Đầu ra thành công:** `200` + order object

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| paymentStatus không hợp lệ | 400 | `Trạng thái thanh toán không hợp lệ` |
| Không tìm thấy | 404 | `Đơn hàng không tồn tại` |

---

## 3. Yêu cầu phi chức năng (Non-Functional Requirements)

### NFR-01: Hiệu năng

| Chỉ tiêu | Giá trị |
|---|---|
| Thời gian đặt hàng (transaction) | < 500ms (p95) |
| Thời gian xem danh sách đơn | < 300ms (p95) |
| Thời gian update trạng thái | < 200ms (p95) |
| Atomic stock operation | No DB timeout |

---

### NFR-02: Bảo mật

| Yêu cầu | Mô tả |
|---|---|
| Customer endpoints | JWT token required (CUSTOMER+) |
| Admin endpoints | JWT token + role STAFF+ |
| Ownership check | Check at DB level (WHERE userId) |
| SQL Injection prevention | Prisma ORM |

---

### NFR-03: Độ tin cậy

| Yêu cầu | Giá trị |
|---|---|
| Uptime | ≥ 99.9% |
| Transaction rollback | Đảm bảo rollback nếu stock fail |
| Atomic operations | Đặt hàng, hủy đơn dùng transaction |

---

### NFR-04: Khả năng bảo trì

| Yêu cầu | Mô tả |
|---|---|
| VALID_TRANSITIONS | Config trong code, dễ sửa |
| Payment status update | Admin được phép set tự do |
| Order code generation | Dễ format lại |

---

### NFR-05: Scalability

| Yêu cầu | Giá trị |
|---|---|
| Đơn hàng tối đa | 100,000+ orders |
| Items per order | Max 50 items |
| Concurrent placement | 100+ concurrent |
| Race condition prevention | WHERE clause in transaction |

---

## 4. Yêu cầu dữ liệu

### 4.1 Bảng Order

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `id` | string | PK, auto-generated |
| `orderCode` | string | unique, format `ORD-YYYYMMDD-XXXXXX` |
| `userId` | string | FK → User, not null |
| `status` | OrderStatus | default PENDING |
| `paymentMethod` | PaymentMethod | `COD` / `BANK_TRANSFER` |
| `paymentStatus` | PaymentStatus | default UNPAID |
| `paidAt` | DateTime? | nullable |
| `subtotal` | Decimal | not null |
| `shippingFee` | Decimal | default 0 |
| `discount` | Decimal | default 0 |
| `total` | Decimal | not null |
| `shippingName` | string | snapshot, not null |
| `shippingPhone` | string | snapshot, not null |
| `shippingProvince` | string | snapshot, not null |
| `shippingDistrict` | string | snapshot, not null |
| `shippingWard` | string | snapshot, not null |
| `shippingDetail` | string | snapshot, not null |
| `note` | string? | nullable |
| `cancelReason` | string? | nullable |
| `createdAt` | DateTime | auto |
| `updatedAt` | DateTime | auto |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (orderCode)`
- `INDEX (userId)`
- `INDEX (status)`
- `INDEX (paymentStatus)`
- `INDEX (paymentMethod)`
- `INDEX (createdAt)`

---

### 4.2 Bảng OrderItem

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `id` | string | PK, auto-generated |
| `orderId` | string | FK → Order, not null |
| `variantId` | string? | FK → ProductVariant, nullable |
| `productName` | string | snapshot, not null |
| `sku` | string | snapshot, not null |
| `color` | string? | snapshot, nullable |
| `storage` | string? | snapshot, nullable |
| `ram` | string? | snapshot, nullable |
| `unitPrice` | Decimal | snapshot, not null |
| `quantity` | int | not null, ≥ 1 |
| `subtotal` | Decimal | not null |

**Indexes:**
- `PRIMARY KEY (id)`
- `INDEX (orderId)`
- `INDEX (variantId)`

**Cascade:**
- Khi xóa `Order` → `OrderItem` bị xóa theo

---

## 5. Enum Definitions

### 5.1 OrderStatus

```typescript
enum OrderStatus {
  PENDING     // Chờ xác nhận
  CONFIRMED   // Đã xác nhận
  SHIPPING    // Đang giao hàng
  DELIVERED   // Đã giao thành công
  CANCELLED   // Đã hủy
}
```

### 5.2 PaymentStatus

```typescript
enum PaymentStatus {
  UNPAID    // Chưa thanh toán
  PAID      // Đã thanh toán
  REFUNDED  // Đã hoàn tiền
}
```

### 5.3 PaymentMethod

```typescript
enum PaymentMethod {
  COD           // Thanh toán khi nhận hàng
  BANK_TRANSFER // Chuyển khoản ngân hàng
}
```

---

## 6. State Machine - VALID_TRANSITIONS

```typescript
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [], // Terminal state
  CANCELLED: []  // Terminal state
};
```

**Quy tắc:**
- Chuyển trạng thái phải theo `VALID_TRANSITIONS`
- `DELIVERED` và `CANCELLED` là trạng thái cuối — không thể chuyển tiếp
- Admin có thể hủy từ bất kỳ trạng thái nào (trừ terminal)

---

## 7. Môi trường & Cấu hình

| Biến môi trường | Mô tả | Ràng buộc |
|---|---|---|
| Không có env vars đặc biệt | — | Module Order không cần config đặc biệt |

---

## 8. Phụ thuộc

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| `@prisma/client` | latest | ORM tương tác DB |
| `crypto` (Node built-in) | — | Sinh order code ngẫu nhiên |

---

## 9. Error Handling

### 9.1 HTTP Status Codes

| Code | Khi nào dùng |
|---|---|
| `200` | Thành công (GET, PATCH) |
| `201` | Tạo thành công (POST) |
| `400` | Validation error, stock không đủ, chuyển trạng thái sai |
| `401` | Không xác thực |
| `403` | Không đủ quyền (admin endpoint với role CUSTOMER) |
| `404` | Không tìm thấy (order, address) |
| `409` | Conflict (hiện tại không dùng) |
| `500` | Server error |

### 9.2 Error Response Format

```json
{
  "message": "Sản phẩm 'IP15-001' không đủ hàng",
  "errors": [
    { "field": "items", "variantId": "var_123", "message": "Stock không đủ" }
  ]
}
```

---

## 10. Testing Requirements

### 10.1 Unit Tests

- Order code generation uniqueness
- VALID_TRANSITIONS validation
- Price calculation (subtotal, total)
- Stock check-and-decrement logic

### 10.2 Integration Tests

- Đặt hàng từ giỏ hàng → cart bị xóa
- Đặt hàng với items trực tiếp → cart không đổi
- Atomic stock decrement (concurrent requests)
- Hủy đơn → stock được hoàn trả

### 10.3 E2E Tests

- Flow: Đặt hàng → Xác nhận → Giao → Hoàn thành
- Flow: Đặt hàng → Hủy → Stock được hoàn
- Flow: Admin update status → Customer thấy trạng thái mới

---

## 11. Migration & Rollback

### 11.1 Database Migration

- Tạo indexes cho userId, status, paymentStatus
- Migrate data từ hệ thống cũ (nếu có)
- Validate orderCode uniqueness

### 11.2 Rollback Plan

- Revert code deployment
- Restore DB backup (nếu schema change)
- Không có data migration phức tạp

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Next Review:** After implementation complete
