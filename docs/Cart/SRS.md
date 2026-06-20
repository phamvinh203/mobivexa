# SRS — Software Requirement Specification
## Module: Cart (Giỏ hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Phạm vi hệ thống

Module Cart cung cấp các chức năng:
- Lấy toàn bộ giỏ hàng (full response với variant + product + ảnh)
- Thêm sản phẩm vào giỏ (cộng dồn nếu đã có)
- Cập nhật số lượng item
- Xóa 1 item khỏi giỏ
- Xóa toàn bộ giỏ hàng

**Ngoài phạm vi:** Save cart (draft order), Share cart, Wishlist.

---

## 2. Yêu cầu chức năng (Functional Requirements)

### FR-01: Lấy giỏ hàng (Full Response)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-01 |
| **Tên** | Lấy toàn bộ giỏ hàng |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/cart` |
| **Auth** | CUSTOMER+ |

**Đầu vào:** Không có (truyền JWT token)

**Xử lý:**
1. Lấy `userId` từ JWT token
2. Upsert Cart: tạo mới nếu chưa có, không làm gì nếu đã có
3. Query CartItems theo `cartId`, sort by `createdAt ASC`
4. Include Variant (`color`, `storage`, `ram`, `salePrice`, `stock`)
5. Include Product (`id`, `name`, `slug`) + Cover Image (`isCover = true`)
6. Trả về `200` + `{ cart: { id, userId, items: [...] } }`

**Đầu ra thành công:** `200` + cart object

---

### FR-02: Thêm sản phẩm vào giỏ

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-02 |
| **Tên** | Thêm sản phẩm vào giỏ hàng |
| **Ưu tiên** | Cao |
| **Endpoint** | `POST /api/cart/items` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `variantId` (string, required): ID variant
- `quantity` (number, required): số nguyên từ 1–100

**Xử lý:**
1. Validate `variantId` là string hợp lệ
2. Validate `quantity` là số nguyên ≥ 1 và ≤ 100
3. **Song song:**
   - Lấy variant (`isActive`, `stock`)
   - Upsert Cart (tạo nếu chưa có)
4. Validate variant tồn tại và `isActive = true`
5. Kiểm tra quantity ≤ stock
6. Tra cứu item theo `(cartId, variantId)`:
   - **Chưa có** → tạo CartItem mới với quantity
   - **Đã có** → tính `newQty = existingQty + quantity`
7. Validate `newQty ≤ stock`
8. Cập nhật quantity (hoặc tạo mới)
9. Trả về `201` + lean summary `{ cartId, itemCount }`

**Đầu ra thành công:** `201` + `{ cartId, itemCount }`

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| variantId không hợp lệ | 400 | `variantId không hợp lệ` |
| quantity < 1 hoặc > 100 | 400 | `Số lượng phải là số nguyên từ 1 đến 100` |
| Variant không tồn tại/inactive | 404 | `Sản phẩm không tồn tại hoặc đã ngừng bán` |
| quantity > stock (lần đầu) | 400 | `Sản phẩm không đủ hàng (còn {stock}) |
| newQty > stock (cộng dồn) | 400 | `Số lượng vượt quá tồn kho (còn {stock}) |

---

### FR-03: Cập nhật số lượng item

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-03 |
| **Tên** | Cập nhật số lượng item trong giỏ |
| **Ưu tiên** | Cao |
| **Endpoint** | `PUT /api/cart/items/:itemId` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `quantity` (number, required): số nguyên từ 1–100

**Xử lý:**
1. Validate `quantity` là số nguyên ≥ 1 và ≤ 100
2. Lấy Cart theo `userId`
3. Lấy item theo `itemId` trong Cart đó
4. Validate item thuộc về cart (ownership check)
5. Lấy `stock` hiện tại của variant
6. Kiểm tra quantity ≤ stock
7. Update quantity (replace trực tiếp, không cộng dồn)
8. Trả về `200` + lean summary `{ cartId, itemCount }`

**Đầu ra thành công:** `200` + `{ cartId, itemCount }`

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| quantity không hợp lệ | 400 | `Số lượng phải là số nguyên từ 1 đến 100` |
| Giỏ không tồn tại | 404 | `Giỏ hàng không tồn tại` |
| Item không tồn tại/không thuộc giỏ | 404 | `Không tìm thấy sản phẩm trong giỏ hàng` |
| quantity > stock | 400 | `Số lượng vượt quá tồn kho (còn {stock}) |

---

### FR-04: Xóa 1 item

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-04 |
| **Tên** | Xóa 1 item khỏi giỏ |
| **Ưu tiên** | Cao |
| **Endpoint** | `DELETE /api/cart/items/:itemId` |
| **Auth** | CUSTOMER+ |

**Xử lý:**
1. Lấy Cart theo `userId`
2. Lấy item theo `itemId` trong Cart đó
3. Validate item thuộc về cart (ownership check)
4. Xóa item
5. Trả về `200` + lean summary `{ cartId, itemCount }`

**Đầu ra thành công:** `200` + `{ cartId, itemCount }`

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Giỏ không tồn tại | 404 | `Giỏ hàng không tồn tại` |
| Item không tồn tại/không thuộc giỏ | 404 | `Không tìm thấy sản phẩm trong giỏ hàng` |

---

### FR-05: Xóa toàn bộ giỏ hàng

| Thuộc tính | Giá trị |
|---|---||
| **ID** | FR-05 |
| **Tên** | Xóa toàn bộ giỏ hàng |
| **Ưu tiên** | Cao |
| **Endpoint** | `DELETE /api/cart` |
| **Auth** | CUSTOMER+ |

**Xử lý:**
1. Lấy Cart theo `userId`
2. Xóa tất cả CartItems (`deleteMany`)
3. **Không xóa** bản ghi Cart
4. Trả về `200` + `{ message: 'Đã xóa toàn bộ giỏ hàng' }`

**Đầu ra thành công:** `200` + `{ message }`

---

## 3. Yêu cầu phi chức năng (Non-Functional Requirements)

### NFR-01: Hiệu năng

| Chỉ tiêu | Giá trị |
|---|---|
| Thêm sản phẩm vào giỏ | < 200ms (p95) |
| Cập nhật số lượng | < 150ms (p95) |
| Xóa item/giỏ | < 100ms (p95) |
| Lấy toàn bộ giỏ hàng | < 300ms (p95) |
| Lean summary | < 50ms (p95) |

---

### NFR-02: Bảo mật

| Yêu cầu | Mô tả |
|---|---|
| Customer endpoints | Yêu cầu JWT token (CUSTOMER+) |
| Ownership check | Check `item.cartId === user.cartId` cho mọi operation |
| SQL Injection prevention | Prisma ORM escape input |

---

### NFR-03: Độ tin cậy

| Yêu cầu | Giá trị |
|---|---|
| Uptime | ≥ 99.9% |
| Auto-upsert cart | Always succeed (fallback to existing cart) |
| Unique constraint (cartId, variantId) | DB reject race condition |

---

### NFR-04: Khả năng bảo trì

| Yêu cầu | Mô tả |
|---|---|
| Quantity range | Config trong code (1–100) |
| Lean summary format | Dễ mở rộng nếu cần thêm field |
| Không cache | Cart là data cá nhân, thay đổi liên tục |

---

### NFR-05: Scalability

| Yêu cầu | Giá trị |
|---|---|
| Items tối đa/giỏ | 100 items |
| Số lượng/item | 1–100 |
| Concurrent users | 100+ users thao tác cùng lúc |

---

## 4. Yêu cầu dữ liệu

### 4.1 Bảng Cart

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `id` | `VARCHAR` (cuid) | PK, auto-generated |
| `userId` | `VARCHAR` | FK → User.id, **unique**, not null |
| `createdAt` | `TIMESTAMPTZ` | auto-generated |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (userId)` — 1 user = 1 cart
- `INDEX (createdAt)`

**Cascade:**
- Khi xóa `User` → `Cart` bị xóa theo (cascade delete)

---

### 4.2 Bảng CartItem

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `id` | `VARCHAR` (cuid) | PK, auto-generated |
| `cartId` | `VARCHAR` | FK → Cart.id, not null |
| `variantId` | `VARCHAR` | FK → ProductVariant.id, not null |
| `quantity` | `INTEGER` | not null, ≥ 1, ≤ 100 |
| `createdAt` | `TIMESTAMPTZ` | auto-generated |

**Indexes:**
- `PRIMARY KEY (id)`
- `INDEX (cartId)` — cho lookup items của cart
- `INDEX (variantId)` — cho lookup carts theo variant
- `UNIQUE (cartId, variantId)` — mỗi variant chỉ xuất hiện 1 lần trong 1 giỏ

**Cascade:**
- Khi xóa `Cart` → tất cả `CartItem` bị xóa theo (cascade delete)

---

## 5. Môi trường & Cấu hình

| Biến môi trường | Mô tả | Ràng buộc |
|---|---|---|
| Không có env vars đặc biệt | — | Module Cart không cần config đặc biệt |

---

## 6. Phụ thuộc

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| `@prisma/client` | latest | ORM tương tác DB |
| `crypto` (Node built-in) | — | (nếu cần random string) |

---

## 7. Error Handling

### 7.1 HTTP Status Codes

| Code | Khi nào dùng |
|---|---|
| `200` | Thành công (GET, PUT, DELETE) |
| `201` | Tạo thành công (POST) |
| `400` | Validation error, stock không đủ, quantity vượt quá |
| `401` | Không xác thực |
| `403` | Không đủ quyền (nếu có role-based access trong tương lai) |
| `404` | Không tìm thấy (cart, item, variant) |

### 7.2 Error Response Format

```json
{
  "message": "Sản phẩm không đủ hàng (còn 5)",
  "errors": [
    { "field": "quantity", "variantId": "var_123", "message": "Stock không đủ" }
  ]
}
```

---

## 8. Testing Requirements

### 8.1 Unit Tests

- Cart upsert logic
- Quantity calculation (cộng dồn)
- Stock validation logic
- Ownership check logic

### 8.2 Integration Tests

- Thêm item → cart được upsert
- Cộng dồn quantity → tổng ≤ stock
- Xóa item → ownership check fail
- Clear cart → CartItems bị xóa, Cart vẫn tồn tại

### 8.3 E2E Tests

- Flow: Thêm → Xem giỏ → Cập nhật → Xóa → Clear
- Flow: Thêm item đã có → quantity được cộng dồn
- Flow: Race condition thêm cùng 1 item → DB reject 1

---

## 9. Migration & Rollback

### 9.1 Database Migration

- Tạo unique constraint cho `userId` trong bảng Cart
- Tạo unique constraint cho `(cartId, variantId)` trong CartItem
- Migrate data từ hệ thống cũ (nếu có)

### 9.2 Rollback Plan

- Revert code deployment
- Restore DB backup (nếu schema change)
- Không có data migration phức tạp

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Next Review:** After implementation complete
