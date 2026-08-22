# Software Requirements Specification
## Module: Cart
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Routes

| Method | Path | Auth | Validator |
|---|---|---|---|
| GET | `/api/cart` | Customer+ | — |
| POST | `/api/cart/items` | Customer+ | `validateAddItem` |
| PUT | `/api/cart/items/:itemId` | Customer+ | `validateUpdateItem` |
| DELETE | `/api/cart/items/:itemId` | Customer+ | — |
| DELETE | `/api/cart` | Customer+ | — |

---

## 2. Functional Requirements

### FR-01: GET /cart — Xem giỏ hàng

- `cart.upsert WHERE userId` — tạo giỏ mới nếu chưa có
- Include `CART_INCLUDE`:
  ```
  items (orderBy: createdAt ASC) {
    variant {
      product: { id, name, slug, images (isCover=true, take:1) { url } }
      + tất cả scalar fields của variant (price, salePrice, stock, color, storage, ram, sku, isActive...)
    }
  }
  ```
- Trả full cart object với items đầy đủ

### FR-02: POST /cart/items — Thêm sản phẩm

1. Parallel:
   - `productVariant.findUnique WHERE id=variantId` select `id, isActive, stock`
   - `cart.upsert WHERE userId` select `id`
2. Variant không tồn tại hoặc `!isActive` → 404
3. `stock < quantity` → 400 với số tồn thực tế
4. `cartItem.findUnique WHERE cartId_variantId` (unique constraint):
   - **Đã có:** `newQty = existing.quantity + quantity`; `newQty > stock` → 400; update quantity
   - **Chưa có:** create `{ cartId, variantId, quantity }`
5. Trả `fetchCartSummary(cartId)` = `{ cartId, itemCount }`

### FR-03: PUT /cart/items/:itemId — Cập nhật số lượng

1. `getCartOrThrow(userId)` — 404 nếu giỏ không tồn tại
2. `findOwnedItem(cartId, itemId)` — 404 nếu item không trong giỏ
3. `productVariant.findUnique WHERE id=item.variantId` select `stock`
4. `body.quantity > stock` → 400
5. Update quantity
6. Trả `fetchCartSummary(cartId)`

### FR-04: DELETE /cart/items/:itemId — Xóa item

1. `getCartOrThrow(userId)`
2. `findOwnedItem(cartId, itemId)` — ownership check
3. `cartItem.delete WHERE id=itemId`
4. Trả `fetchCartSummary(cartId)`

### FR-05: DELETE /cart — Xóa toàn bộ giỏ

- `cartItem.deleteMany WHERE cart.userId=userId`
- Cart record vẫn tồn tại; chỉ xóa items
- Không trả data (204 / 200 empty)

---

## 3. Response strategy

| Endpoint | Response |
|---|---|
| `GET /cart` | Full cart + items + variant + product (4 cấp join) |
| Mutations (add/update/remove) | `{ cartId, itemCount }` (lean — FE update badge) |
| `DELETE /cart` | Empty / no content |

---

## 4. Validation

### validateAddItem
- `variantId`: `checkId` (string, truthy)
- `quantity`: `checkQuantity(Number(quantity), 100)` — phải là integer 1–100

### validateUpdateItem
- `quantity`: `checkQuantity(Number(req.body.quantity), 100)` — integer 1–100

---

## 5. Helpers

| Helper | Mô tả |
|---|---|
| `fetchCartSummary(cartId)` | `count CartItem WHERE cartId` → `{ cartId, itemCount }` |
| `getCartOrThrow(userId)` | `findUnique Cart WHERE userId`; 404 nếu không có |
| `findOwnedItem(cartId, itemId)` | `findFirst CartItem WHERE id AND cartId`; 404 nếu không phải của giỏ này |

---

## 6. Prisma schema liên quan

```
Cart:
  id        String @id
  userId    String @unique  ← 1 user 1 giỏ
  items     CartItem[]

CartItem:
  id        String @id
  cartId    String
  variantId String
  quantity  Int @default(1)
  @@unique([cartId, variantId])  ← chống trùng variant, dùng để merge
```
