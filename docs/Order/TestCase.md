# Test Case Document
## Module: Order (Đơn hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [SRS.md](./SRS.md) | [APISpec.md](./APISpec.md)  
> **Test Framework:** Vitest + Supertest  
> **Môi trường:** Test DB (NODE_ENV=test)

---

## Tổng quan Test Suite

| Nhóm | Số TC | Phủ |
|---|---|---|
| POST /orders | 9 | Đặt hàng |
| GET /orders | 4 | Danh sách đơn của tôi |
| GET /orders/:id | 3 | Chi tiết đơn hàng |
| PATCH /orders/:id/cancel | 4 | Hủy đơn (Customer) |
| GET /admin/orders | 5 | Admin danh sách |
| GET /admin/orders/:id | 3 | Admin chi tiết |
| PATCH /admin/orders/:id/status | 7 | Admin update status |
| PATCH /admin/orders/:id/payment | 3 | Admin update payment |
| **Tổng cộng** | **38** | |

---

## TC-CREATE: Đặt hàng

### TC-CREATE-01: Đặt hàng từ giỏ - Happy Path

**ID:** TC-CREATE-01  
**Level:** Smoke

**Precondition:** 
- User đã đăng nhập
- Giỏ hàng có 2 items với variants tồn tại và đủ stock
- User có 1 address saved

**Input:** `POST /api/orders` với JWT token + `{ addressId }` (không gửi items)

**Expected Output:**
- HTTP: `201`
- Body: Order object với:
  - `orderCode` format đúng
  - `status = PENDING`
  - `paymentStatus = UNPAID`
  - `items` array có 2 items
  - Tổng `subtotal`, `total` tính đúng
- DB: CartItems bị xóa
- DB: Stock của variants bị trừ đúng quantity

---

### TC-CREATE-02: Đặt hàng mua ngay - Happy Path

**Input:** `POST /api/orders` với `{ addressId, items: [...] }`

**Expected Output:**
- HTTP: `201`
- Giống TC-CREATE-01
- DB: CartItems KHÔNG bị xóa

---

### TC-CREATE-03: Đặt hàng - Thiếu addressId

**Input:** `POST /api/orders` (không có addressId)

**Expected Output:**
- HTTP: `400`
- Message: `Vui lòng chọn địa chỉ giao hàng`

---

### TC-CREATE-04: Đặt hàng - Address không thuộc user

**Input:** `POST /api/orders` với `{ addressId: "addr_of_other_user" }`

**Expected Output:**
- HTTP: `404`
- Message: `Địa chỉ không tồn tại`

---

### TC-CREATE-05: Đặt hàng từ giỏ - Giỏ trống

**Precondition:** Giỏ hàng của user trống

**Input:** `POST /api/orders` (không gửi items)

**Expected Output:**
- HTTP: `400`
- Message: `Giỏ hàng trống, không thể đặt hàng`

---

### TC-CREATE-06: Đặt hàng - Variant không tồn tại

**Input:** `{ items: [{ variantId: "non_existing", quantity: 1 }] }`

**Expected Output:**
- HTTP: `400`
- Message: `Sản phẩm không tồn tại: non_existing`

---

### TC-CREATE-07: Đặt hàng - Variant inactive

**Precondition:** Variant var_123 có `isActive = false`

**Input:** `{ items: [{ variantId: "var_123", quantity: 1 }] }`

**Expected Output:**
- HTTP: `400`
- Message: `Sản phẩm đã ngừng bán: IP15-001`

---

### TC-CREATE-08: Đặt hàng - Hết hàng (Race Condition)

**Precondition:** Variant var_123 có `stock = 5`

**Input:** 
- Request 1: `{ items: [{ variantId: "var_123", quantity: 5 }] }`
- Request 2 (song song): `{ items: [{ variantId: "var_123", quantity: 5 }] }`

**Expected Output:**
- Request 1: HTTP `201` (thành công)
- Request 2: HTTP `400` (stock không đủ)
- DB: Stock cuối cùng = 0 (đúng)

---

### TC-CREATE-09: Đặt hàng - paymentMethod không hợp lệ

**Input:** `{ addressId, paymentMethod: "INVALID" }`

**Expected Output:**
- HTTP: `400`
- Message: `Phương thức thanh toán không hợp lệ`

---

## TC-MYORDERS: Danh sách & Chi tiết đơn của tôi

### TC-MYORDERS-01: Danh sách đơn - Happy Path

**Input:** `GET /api/orders?page=1&limit=10` với JWT token

**Expected Output:**
- HTTP: `200`
- Body: `{ orders: [], pagination: {} }`
- Chỉ trả về đơn của user đang login
- Sort by `createdAt DESC`

---

### TC-MYORDERS-02: Danh sách đơn - Filter by status

**Input:** `GET /api/orders?status=CANCELLED`

**Expected Output:**
- HTTP: `200`
- Chỉ đơn có `status = CANCELLED`

---

### TC-MYORDERS-03: Chi tiết đơn - Happy Path

**Input:** `GET /api/orders/:id` với JWT token (id thuộc về user)

**Expected Output:**
- HTTP: `200`
- Order object đầy đủ với items, user info

---

### TC-MYORDERS-04: Chi tiết đơn - Not Found hoặc Not Belong to Me

**Input:** `GET /api/orders/order_of_other_user`

**Expected Output:**
- HTTP: `404`
- Message: `Đơn hàng không tồn tại`

---

## TC-CANCEL: Hủy đơn (Customer)

### TC-CANCEL-01: Hủy đơn - Happy Path (PENDING)

**Precondition:** Order với `status = PENDING` thuộc về user

**Input:** `PATCH /api/orders/:id/cancel` với `{ cancelReason: "Tôi muốn hủy" }`

**Expected Output:**
- HTTP: `200`
- Body: Order object với `status = CANCELLED`
- DB: Stock được hoàn trả (`increment`)

---

### TC-CANCEL-02: Hủy đơn - Không được phép (DELIVERED)

**Precondition:** Order với `status = DELIVERED`

**Input:** `PATCH /api/orders/:id/cancel`

**Expected Output:**
- HTTP: `400`
- Message: `Không thể hủy đơn hàng ở trạng thái hiện tại`

---

### TC-CANCEL-03: Hủy đơn - Not Found

**Input:** `PATCH /api/orders/non_existing/cancel`

**Expected Output:**
- HTTP: `404`

---

### TC-CANCEL-04: Hủy đơn - Stock được hoàn trả đúng

**Precondition:** Order có 2 items: var_123 (qty 5, stock gốc 10), var_456 (qty 3, stock gốc 8)

**Input:** `PATCH /api/orders/:id/cancel`

**Expected Output:**
- HTTP: `200`
- DB: 
  - var_123: stock = 10 + 5 = 15
  - var_456: stock = 8 + 3 = 11

---

## TC-ADMIN: Admin Endpoints

### TC-ADMIN-01: Admin danh sách - Happy Path

**Input:** `GET /api/admin/orders?status=PENDING` với JWT token (STAFF+)

**Expected Output:**
- HTTP: `200`
- Body: `{ orders: [], pagination: {} }`
- Mỗi order có `_count.items` (không hydrate toàn bộ items)
- Có `user` info (`id`, `fullName`, `email`)

---

### TC-ADMIN-02: Admin danh sách - Filter Multi

**Input:** `GET /api/admin/orders?status=PENDING&paymentMethod=COD&from=2026-06-01&to=2026-06-30`

**Expected Output:**
- HTTP: `200`
- Orders thỏa tất cả filters

---

### TC-ADMIN-03: Admin danh sách - Unauthorized

**Input:** `GET /api/admin/orders` với JWT token (CUSTOMER)

**Expected Output:**
- HTTP: `403`
- Message: `Bạn không có quyền thực hiện thao tác này`

---

### TC-ADMIN-04: Admin chi tiết - Happy Path

**Input:** `GET /api/admin/orders/:id` với JWT token (STAFF+)

**Expected Output:**
- HTTP: `200`
- Order object đầy đủ (kể cả CANCELLED)

---

### TC-ADMIN-05: Admin chi tiết - Not Found

**Input:** `GET /api/admin/orders/non_existing`

**Expected Output:**
- HTTP: `404`

---

## TC-UPDATE-STATUS: Admin Update Status

### TC-UPDATE-STATUS-01: Update status - Happy Path (PENDING → CONFIRMED)

**Input:** `PATCH /api/admin/orders/:id/status` với `{ status: "CONFIRMED" }`

**Expected Output:**
- HTTP: `200`
- Order object với `status = CONFIRMED`

---

### TC-UPDATE-STATUS-02: Update status - Invalid Transition

**Input:** `PATCH /api/admin/orders/:id/status` với `{ status: "DELIVERED" }` (hiện tại PENDING)

**Expected Output:**
- HTTP: `400`
- Message: `Không thể chuyển từ "PENDING" sang "DELIVERED"`

---

### TC-UPDATE-STATUS-03: Update status - Invalid Status Value

**Input:** `{ status: "INVALID" }`

**Expected Output:**
- HTTP: `400`
- Message: `Trạng thái đơn hàng không hợp lệ`

---

### TC-UPDATE-STATUS-04: Cancel order - Happy Path

**Input:** `PATCH /api/admin/orders/:id/status` với `{ status: "CANCELLED", cancelReason: "Sản phẩm hết hàng" }`

**Expected Output:**
- HTTP: `200`
- Order object với `status = CANCELLED`, `cancelReason`
- DB: Stock được hoàn trả

---

### TC-UPDATE-STATUS-05: Cancel order - Missing cancelReason

**Input:** `{ status: "CANCELLED" }` (không có cancelReason)

**Expected Output:**
- HTTP: `400`
- Message: `Vui lòng nhập lý do hủy đơn`

---

### TC-UPDATE-STATUS-06: Cancel order - Stock Restoration

**Precondition:** Order có items: var_123 (qty 5), var_456 (qty 2)

**Input:** Cancel order

**Expected Output:**
- HTTP: `200`
- DB: Stock được hoàn trả đúng số lượng

---

### TC-UPDATE-STATUS-07: Update status - Terminal State

**Precondition:** Order với `status = DELIVERED`

**Input:** `PATCH /api/admin/orders/:id/status` với `{ status: "CONFIRMED" }`

**Expected Output:**
- HTTP: `400`
- Message: `Không thể chuyển từ "DELIVERED" sang...` (DELIVERED là terminal state)

---

## TC-UPDATE-PAYMENT: Admin Update Payment

### TC-UPDATE-PAYMENT-01: Update payment - Happy Path (UNPAID → PAID)

**Input:** `PATCH /api/admin/orders/:id/payment` với `{ paymentStatus: "PAID" }`

**Expected Output:**
- HTTP: `200`
- Order object với `paymentStatus = PAID`
- `paidAt` được set (not null)

---

### TC-UPDATE-PAYMENT-02: Update payment - Invalid PaymentStatus

**Input:** `{ paymentStatus: "INVALID" }`

**Expected Output:**
- HTTP: `400`
- Message: `Trạng thái thanh toán không hợp lệ`

---

### TC-UPDATE-PAYMENT-03: Update payment - Not Found

**Input:** `PATCH /api/admin/orders/non_existing/payment`

**Expected Output:**
- HTTP: `404`

---

## TC-STATE-MACHINE: State Machine Tests

### TC-STATE-01: Valid Transitions - PENDING

**Precondition:** Order status = PENDING

**Test:**
- ✅ PENDING → CONFIRMED (valid)
- ✅ PENDING → CANCELLED (valid)
- ❌ PENDING → SHIPPING (invalid)
- ❌ PENDING → DELIVERED (invalid)

---

### TC-STATE-02: Valid Transitions - CONFIRMED

**Precondition:** Order status = CONFIRMED

**Test:**
- ✅ CONFIRMED → SHIPPING (valid)
- ✅ CONFIRMED → CANCELLED (valid)
- ❌ CONFIRMED → PENDING (invalid)
- ❌ CONFIRMED → DELIVERED (invalid)

---

### TC-STATE-03: Valid Transitions - SHIPPING

**Precondition:** Order status = SHIPPING

**Test:**
- ✅ SHIPPING → DELIVERED (valid)
- ✅ SHIPPING → CANCELLED (valid)
- ❌ SHIPPING → PENDING (invalid)
- ❌ SHIPPING → CONFIRMED (invalid)

---

### TC-STATE-04: Terminal States - DELIVERED

**Precondition:** Order status = DELIVERED

**Test:**
- ❌ DELIVERED → CONFIRMED (invalid)
- ❌ DELIVERED → SHIPPING (invalid)
- ❌ DELIVERED → CANCELLED (invalid)
- ❌ DELIVERED → PENDING (invalid)

---

### TC-STATE-05: Terminal States - CANCELLED

**Precondition:** Order status = CANCELLED

**Test:**
- ❌ CANCELLED → CONFIRMED (invalid)
- ❌ CANCELLED → SHIPPING (invalid)
- ❌ CANCELLED → DELIVERED (invalid)
- ❌ CANCELLED → PENDING (invalid)

---

## TC-STOCK: Stock Management

### TC-STOCK-01: Stock Decrement - Atomic

**Precondition:** var_123 có stock = 10

**Concurrent requests:**
- Request 1: order 5 units
- Request 2: order 6 units

**Expected Output:**
- Request 1: `201` (thành công), stock còn 5
- Request 2: `400` (stock không đủ), stock vẫn 5 (rollback)

---

### TC-STOCK-02: Stock Restoration - Cancel

**Precondition:** var_123 stock = 5 (sau khi đặt)

**Input:** Hủy đơn có item var_123 qty = 5

**Expected Output:**
- HTTP: `200`
- DB: var_123 stock = 10 (được hoàn trả đầy đủ)

---

### TC-STOCK-03: Stock Restoration - Partial

**Precondition:** Order có 3 items:
- var_123 qty 5
- var_456 qty 3
- var_789 qty 2

**Input:** Hủy đơn

**Expected Output:**
- HTTP: `200`
- DB: Tất cả stock được hoàn trả đúng quantity

---

## TC-ORDER-CODE: Order Code Generation

### TC-ORDERCODE-01: Order Code Format

**Precondition:** Tạo đơn hàng thành công

**Expected Output:**
- `orderCode` match regex: `^ORD-\d{8}-[A-F0-9]{6}$`
- Example: `ORD-20240619-A3F9C2`

---

### TC-ORDERCODE-02: Order Code Unique

**Test:** Tạo 100 đơn hàng song song

**Expected Output:**
- Tất cả 100 `orderCode` unique
- Không trùng lặp

---

## TC-SNAPSHOT: Snapshot Data Integrity

### TC-SNAPSHOT-01: OrderItem Snapshot - Price Change

**Precondition:** 
- Đặt hàng với var_123, `salePrice = 100000`
- Sau đó admin update var_123 `salePrice = 120000`

**Input:** `GET /api/orders/:id`

**Expected Output:**
- OrderItem với `unitPrice = 100000` (snapshot)
- Không bị ảnh hưởng bởi giá mới

---

### TC-SNAPSHOT-02: OrderItem Snapshot - Product Deleted

**Precondition:**
- Đặt hàng với var_123
- Sau đó admin xóa var_123

**Input:** `GET /api/orders/:id`

**Expected Output:**
- OrderItem vẫn hiển thị đầy đủ (snapshot info)
- `variantId` = null hoặc vẫn giữ ID cũ (không lỗi)

---

### TC-SNAPSHOT-03: Order Shipping Address - Address Deleted

**Precondition:**
- Đặt hàng với addressId = addr_123
- Sau đó user xóa address addr_123

**Input:** `GET /api/orders/:id`

**Expected Output:**
- Order vẫn hiển thị đầy đủ shipping info (snapshot)
- Không có lỗi

---

## TC-CALCULATION: Price Calculation

### TC-CALC-01: Tính toán subtotal - Single Item

**Input:** `{ items: [{ variantId, quantity, unitPrice: 100000 }] }`

**Expected Output:**
- `subtotal = unitPrice × quantity = 100000`

---

### TC-CALC-02: Tính toán subtotal - Multiple Items

**Input:** `{ items: [{ variantId, quantity: 2, unitPrice: 100000 }, { variantId, quantity: 1, unitPrice: 50000 }] }`

**Expected Output:**
- Item 1 subtotal = 200000
- Item 2 subtotal = 50000
- Total subtotal = 250000

---

### TC-CALC-03: Tính toán total - Với shippingFee

**Precondition:** `shippingFee = 30000`, `discount = 0`

**Input:** `{ subtotal: 250000 }`

**Expected Output:**
- `total = subtotal + shippingFee - discount = 280000`

---

## TC-AUTH: Authentication & Authorization

### TC-AUTH-01: Customer endpoint - No Token

**Input:** `POST /api/orders` (không có JWT token)

**Expected Output:**
- HTTP: `401`
- Message: `Không có token xác thực`

---

### TC-AUTH-02: Customer endpoint - Expired Token

**Input:** `POST /api/orders` với JWT token hết hạn

**Expected Output:**
- HTTP: `401`
- Message: `Token không hợp lệ hoặc đã hết hạn`

---

### TC-AUTH-03: Admin endpoint - Wrong Role (CUSTOMER)

**Input:** `GET /api/admin/orders` với JWT token (CUSTOMER)

**Expected Output:**
- HTTP: `403`
- Message: `Bạn không có quyền thực hiện thao tác này`

---

## Checklist Coverage

| Tiêu chí | Trạng thái |
|---|---|
| Happy path tất cả endpoints | ✅ |
| Validation errors (400) | ✅ |
| Not found (404) | ✅ |
| Unauthorized (401) | ✅ |
| Forbidden (403) | ✅ |
| State machine transitions | ✅ |
| Atomic stock check-and-decrement | ✅ |
| Stock restoration on cancel | ✅ |
| Snapshot data integrity | ✅ |
| Price calculation accuracy | ✅ |
| Order code uniqueness & format | ✅ |
| DB state verification sau mỗi action | ✅ |

---

## Test Data Setup

**Seed Data:**

```typescript
// User
const user = await db.user.create({
  data: {
    email: "customer@test.com",
    fullName: "Test Customer",
    passwordHash: bcrypt.hash("password123", 12),
    role: "CUSTOMER"
  }
});

// Address
const address = await db.address.create({
  data: {
    userId: user.id,
    fullName: "Test Customer",
    phone: "0901234567",
    province: "Hà Nội",
    district: "Quận Hoàn Kiếm",
    ward: "Phường Chương Dương",
    streetDetail: "123 Đường ABC"
  }
});

// Variants (với đủ stock)
const variant1 = await db.productVariant.create({
  data: {
    productId: "prod_123",
    sku: "TEST-001",
    color: "Đen",
    originalPrice: 100000,
    salePrice: 80000,
    stock: 10
  }
});

// Cart items (nếu test đặt từ giỏ)
await db.cartItem.createMany({
  data: [
    { userId: user.id, variantId: variant1.id, quantity: 2 },
    { userId: user.id, variantId: variant2.id, quantity: 1 }
  ]
});
```

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Total Test Cases:** 38  
> **Next Review:** After test implementation
