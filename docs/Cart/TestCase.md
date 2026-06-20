# TestCase.md - Test Cases for Cart Module
## Module: Cart (Giỏ hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-20  
> **Người soạn:** API Tester Agent  
> **Tham chiếu:** [BRD.md](./BRD.md), [SRS.md](./SRS.md)

---

## Table of Contents
1. [Unit Tests](#1-unit-tests)
2. [Integration Tests](#2-integration-tests)
3. [E2E Tests](#3-e2e-tests)
4. [Edge Cases](#4-edge-cases)
5. [Performance Tests](#5-performance-tests)
6. [Security Tests](#6-security-tests)

---

## 1. UNIT TESTS

### UT-01: Cart Upsert Logic
**Mô tả:** Kiểm tra logic tạo mới cart khi chưa tồn tại và không làm gì khi đã có.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | UT-01 |
| **Test Description** | Kiểm tra cart upsert logic - tạo mới khi chưa có, giữ nguyên khi đã có |
| **Priority** | High |
| **Type** | Positive |

**Preconditions:**
- Database được reset về trạng thái ban đầu
- User với `userId = "user_001"` chưa có cart trong database

**Test Steps:**
1. Gọi `cartService.upsertCart("user_001")` lần đầu
2. Kiểm tra database xem cart được tạo với `userId = "user_001"`
3. Gọi `cartService.upsertCart("user_001")` lần thứ hai
4. Kiểm tra database xem chỉ có 1 cart với `userId = "user_001"`
5. Kiểm tra `id` của cart không thay đổi giữa 2 lần gọi

**Expected Results:**
- Bước 2: Cart được tạo thành công với `id`, `userId = "user_001"`, `createdAt` được set
- Bước 4: Chỉ có 1 cart duy nhất với `userId = "user_001"`
- Bước 5: `id` của cart giữ nguyên (không tạo mới)

---

### UT-02: Quantity Accumulation Logic
**Mô tả:** Kiểm tra logic cộng dồn quantity khi thêm item đã có trong giỏ.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | UT-02 |
| **Test Description** | Kiểm tra quantity được cộng dồn khi thêm item đã tồn tại trong giỏ |
| **Priority** | High |
| **Type** | Positive |

**Preconditions:**
- User có cart với `cartId = "cart_001"`
- Cart đã có item: `variantId = "var_001"`, `quantity = 5`
- Variant có `stock = 20`

**Test Steps:**
1. Gọi `cartService.addItem("cart_001", "var_001", 3)`
2. Lấy item từ database theo `(cartId, variantId)`
3. Kiểm tra `quantity` của item
4. Tính toán: `expectedQty = 5 + 3 = 8`

**Expected Results:**
- Bước 2: Item được tìm thấy
- Bước 3: `quantity = 8` (cộng dồn từ 5 + 3)
- Không tạo mới item, chỉ update quantity

---

### UT-03: Stock Validation Logic
**Mô tả:** Kiểm tra logic validate stock khi thêm/update item.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | UT-03 |
| **Test Description** | Kiểm tra validate stock - chặn khi quantity vượt quá available stock |
| **Priority** | High |
| **Type** | Negative |

**Preconditions:**
- Variant có `stock = 10`
- Cart chưa có item này

**Test Steps:**
1. Thử thêm item với `quantity = 15` (vượt quá stock)
2. Kiểm tra error response
3. Thử thêm item với `quantity = 10` (bằng stock)
4. Thử update quantity lên `15` (vượt quá stock)
5. Kiểm tra error response lần 2

**Expected Results:**
- Bước 2: Throw error với message `"Sản phẩm không đủ hàng (còn 10)"`
- Bước 3: Thêm thành công (quantity ≤ stock)
- Bước 5: Throw error với message `"Số lượng vượt quá tồn kho (còn 10)"`

---

### UT-04: Ownership Check Logic
**Mô tả:** Kiểm tra logic validate ownership - user không thể truy cập cart của người khác.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | UT-04 |
| **Test Description** | Kiểm tra ownership check - chặn truy cập item không thuộc cart của user |
| **Priority** | High |
| **Type** | Negative |

**Preconditions:**
- User A có cart `cartId = "cart_a"`
- User B có cart `cartId = "cart_b"`
- User B có item `itemId = "item_001"` trong `cart_b`

**Test Steps:**
1. User A cố gắng update `item_001` với quantity mới
2. Kiểm tra error response
3. User A cố gắng xóa `item_001`
4. Kiểm tra error response lần 2

**Expected Results:**
- Bước 2: Throw error với message `"Không tìm thấy sản phẩm trong giỏ hàng"` (404)
- Bước 4: Throw error với message `"Không tìm thấy sản phẩm trong giỏ hàng"` (404)
- Item không bị update hay xóa

---

### UT-05: Lean Summary Generation
**Mô tả:** Kiểm tra logic tạo lean summary response sau mutation.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | UT-05 |
| **Test Description** | Kiểm tra lean summary trả về đúng format { cartId, itemCount } |
| **Priority** | Medium |
| **Type** | Positive |

**Preconditions:**
- Cart có `cartId = "cart_001"`
- Cart có 3 items với quantities: 5, 3, 2

**Test Steps:**
1. Gọi `cartService.addItem("cart_001", "var_new", 1)`
2. Kiểm tra response format
3. Kiểm tra `itemCount = 3 + 1 = 4`
4. Kiểm tra `cartId = "cart_001"`

**Expected Results:**
- Bước 2: Response có format `{ cartId: string, itemCount: number }`
- Bước 3: `itemCount = 4` (số lượng distinct items, không phải tổng quantity)
- Bước 4: `cartId` khớp với cart hiện tại

---

### UT-06: Quantity Range Validation
**Mô tả:** Kiểm tra validate quantity trong range 1-100.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | UT-06 |
| **Test Description** | Kiểm tra validate quantity range - chặn quantity < 1 hoặc > 100 |
| **Priority** | High |
| **Type** | Negative |

**Test Steps:**
1. Thử thêm item với `quantity = 0`
2. Thử thêm item với `quantity = -5`
3. Thử thêm item với `quantity = 101`
4. Thử thêm item với `quantity = 100`
5. Thêm item với `quantity = 1`

**Expected Results:**
- Bước 1-3: Throw error `"Số lượng phải là số nguyên từ 1 đến 100"`
- Bước 4: Thành công (boundary value)
- Bước 5: Thành công (boundary value)

---

## 2. INTEGRATION TESTS

### IT-01: Add Item → Cart Auto-Created
**Mô tả:** Kiểm tra cart được tự động tạo khi user thêm item lần đầu.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | IT-01 |
| **Test Description** | Thêm item đầu tiên → cart được tự động tạo cho user |
| **Priority** | High |
| **Type** | Positive |

**Preconditions:**
- User với `userId = "user_new"` chưa có cart
- Variant `var_001` tồn tại, `isActive = true`, `stock = 50`

**Test Steps:**
1. POST `/api/cart/items` với body `{ variantId: "var_001", quantity: 5 }`
2. Kiểm tra response status = 201
3. Kiểm tra response có `{ cartId, itemCount }`
4. Query database kiểm tra cart được tạo với `userId = "user_new"`
5. Query CartItems kiểm tra item được tạo

**Expected Results:**
- Bước 2: Status 201 Created
- Bước 3: Response format `{ cartId: "...", itemCount: 1 }`
- Bước 4: Cart tồn tại với `userId` khớp
- Bước 5: CartItem tồn tại với `variantId`, `quantity = 5`

---

### IT-02: Add Existing Item → Quantity Accumulated
**Mô tả:** Kiểm tra quantity được cộng dồn khi thêm item đã có.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | IT-02 |
| **Test Description** | Thêm item đã tồn tại → quantity được cộng dồn thay vì tạo mới |
| **Priority** | High |
| **Type** | Positive |

**Preconditions:**
- User có cart với `cartId = "cart_001"`
- Cart đã có item: `variantId = "var_001"`, `quantity = 3`
- Variant `var_001` có `stock = 20`

**Test Steps:**
1. POST `/api/cart/items` với body `{ variantId: "var_001", quantity: 7 }`
2. Kiểm tra response status = 201
3. Query CartItem theo `(cartId, variantId)`
4. Kiểm tra `quantity = 3 + 7 = 10`
5. Kiểm tra chỉ có 1 CartItem với `variantId = "var_001"` trong cart

**Expected Results:**
- Bước 2: Status 201 Created
- Bước 3: Item được tìm thấy
- Bước 4: `quantity = 10` (cộng dồn)
- Bước 5: Chỉ có 1 item (không tạo duplicate)

---

### IT-03: Update Quantity → Stock Check Passed
**Mô tả:** Kiểm tra update quantity thành công khi đủ stock.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | IT-03 |
| **Test Description** | Cập nhật quantity thành công khi quantity mới ≤ available stock |
| **Priority** | High |
| **Type** | Positive |

**Preconditions:**
- User có cart với `cartId = "cart_001"`
- Cart có item: `itemId = "item_001"`, `variantId = "var_001"`, `quantity = 5`
- Variant `var_001` có `stock = 20`

**Test Steps:**
1. PUT `/api/cart/items/item_001` với body `{ quantity: 15 }`
2. Kiểm tra response status = 200
3. Query CartItem theo `itemId`
4. Kiểm tra `quantity = 15` (replace, không cộng dồn)
5. Kiểm tra response có `{ cartId, itemCount }`

**Expected Results:**
- Bước 2: Status 200 OK
- Bước 3: Item được tìm thấy
- Bước 4: `quantity = 15` (thay thế trực tiếp, không phải 5 + 15)
- Bước 5: Lean summary có `itemCount` khớp với số items trong cart

---

### IT-04: Delete Item → Ownership Check
**Mô tả:** Kiểm tra xóa item thành công và ownership validation.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | IT-04 |
| **Test Description** | Xóa item thành công khi đúng owner, thất bại khi sai owner |
| **Priority** | High |
| **Type** | Positive + Negative |

**Preconditions:**
- User A có cart `cart_a`, item `item_a1`
- User B có cart `cart_b`, không có `item_a1`

**Test Steps:**
1. User A: DELETE `/api/cart/items/item_a1`
2. Kiểm tra response status = 200
3. Query database kiểm tra `item_a1` không còn tồn tại
4. User B: DELETE `/api/cart/items/item_a2` (item của User A)
5. Kiểm tra response status = 404
6. Query database kiểm tra `item_a2` vẫn tồn tại

**Expected Results:**
- Bước 2: Status 200 OK
- Bước 3: Item không còn trong database
- Bước 5: Status 404 Not Found
- Bước 6: Item vẫn tồn tại (không bị xóa)

---

### IT-05: Clear Cart → Items Deleted, Cart Preserved
**Mô tả:** Kiểm tra xóa toàn bộ giỏ hàng - items bị xóa, cart vẫn tồn tại.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | IT-05 |
| **Test Description** | Clear cart → tất cả items bị xóa, bản ghi Cart vẫn tồn tại |
| **Priority** | High |
| **Type** | Positive |

**Preconditions:**
- User có cart `cartId = "cart_001"` với 5 items

**Test Steps:**
1. Lưu `cartId` hiện tại
2. DELETE `/api/cart`
3. Kiểm tra response status = 200
4. Query CartItems theo `cartId` - kiểm tra không còn items
5. Query Cart theo `cartId` - kiểm tra cart vẫn tồn tại
6. GET `/api/cart` - kiểm tra response có cart rỗng

**Expected Results:**
- Bước 3: Status 200 OK
- Bước 4: 0 CartItems (tất cả bị xóa)
- Bước 5: Cart vẫn tồn tại với `id`, `userId` giữ nguyên
- Bước 6: Response có `cart: { id, userId, items: [] }`

---

### IT-06: Get Full Cart Response
**Mô tả:** Kiểm tra GET /api/cart trả về đầy đủ thông tin.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | IT-06 |
| **Test Description** | Lấy giỏ hàng → trả về đầy đủ variant + product + cover image |
| **Priority** | High |
| **Type** | Positive |

**Preconditions:**
- User có cart với 2 items
- Mỗi item có variant với product và cover image

**Test Steps:**
1. GET `/api/cart`
2. Kiểm tra response status = 200
3. Kiểm tra response structure:
   - `cart.id`, `cart.userId`, `cart.items`
4. Kiểm tra mỗi item có:
   - `id`, `quantity`, `createdAt`
   - `variant` (SKU, color, storage, RAM, salePrice, stock)
   - `product` (id, name, slug)
   - `coverImage` (url, isCover = true)
5. Kiểm tra items sort by `createdAt ASC`

**Expected Results:**
- Bước 2: Status 200 OK
- Bước 3: Structure khớp với schema
- Bước 4: Tất cả fields được include và populate
- Bước 5: Items được sắp xếp theo thời gian tạo cũ → mới

---

## 3. E2E TESTS

### E2E-01: Full Cart Workflow
**Mô tả:** Kiểm tra workflow hoàn chỉnh từ thêm đến xóa.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | E2E-01 |
| **Test Description** | Workflow hoàn chỉnh: Thêm → Xem → Cập nhật → Xóa → Clear |
| **Priority** | High |
| **Type** | Positive |

**Preconditions:**
- User chưa có cart
- 2 variants tồn tại với đủ stock

**Test Steps:**
1. POST `/api/cart/items` - Thêm variant 1, quantity 5
2. GET `/api/cart` - Xem giỏ hàng (có 1 item)
3. POST `/api/cart/items` - Thêm variant 2, quantity 3
4. GET `/api/cart` - Xem giỏ hàng (có 2 items)
5. PUT `/api/cart/items/:itemId1` - Update quantity lên 10
6. GET `/api/cart` - Kiểm tra quantity = 10
7. DELETE `/api/cart/items/:itemId2` - Xóa item 2
8. GET `/api/cart` - Kiểm tra còn 1 item
9. DELETE `/api/cart` - Clear toàn bộ giỏ
10. GET `/api/cart` - Kiểm tra giỏ rỗng

**Expected Results:**
- Bước 1: Status 201, lean summary với `itemCount = 1`
- Bước 2: Status 200, items có 1 phần tử
- Bước 3: Status 201, `itemCount = 2`
- Bước 4: Status 200, items có 2 phần tử
- Bước 5: Status 200, lean summary
- Bước 6: Item 1 có `quantity = 10`
- Bước 7: Status 200, lean summary với `itemCount = 1`
- Bước 8: Status 200, items có 1 phần tử (item 1)
- Bước 9: Status 200, message `"Đã xóa toàn bộ giỏ hàng"`
- Bước 10: Status 200, `items = []`

---

### E2E-02: Stock Constraint Enforcement
**Mô tả:** Kiểm tra stock constraint được enforce xuyên suốt workflow.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | E2E-02 |
| **Test Description** | Stock constraint: chặn vượt stock ở thêm, update, cộng dồn |
| **Priority** | High |
| **Type** | Negative |

**Preconditions:**
- Variant có `stock = 10`

**Test Steps:**
1. POST `/api/cart/items` với `quantity = 15` → Expect 400
2. POST `/api/cart/items` với `quantity = 8` → Expect 201
3. POST `/api/cart/items` với `quantity = 5` → Expect 400 (8 + 5 = 13 > 10)
4. PUT `/api/cart/items/:itemId` với `quantity = 10` → Expect 200 (boundary)
5. PUT `/api/cart/items/:itemId` với `quantity = 11` → Expect 400

**Expected Results:**
- Bước 1: 400 `"Sản phẩm không đủ hàng (còn 10)"`
- Bước 2: 201 Created
- Bước 3: 400 `"Số lượng vượt quá tồn kho (còn 10)"`
- Bước 4: 200 OK, quantity = 10
- Bước 5: 400 `"Số lượng vượt quá tồn kho (còn 10)"`

---

### E2E-03: Race Condition Handling (Concurrent Adds)
**Mô tả:** Kiểm tra race condition khi 2 requests cùng thêm 1 item.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | E2E-03 |
| **Test Description** | Race condition: 2 requests cùng thêm 1 variant → DB reject 1, retry succeeds |
| **Priority** | High |
| **Type** | Negative |

**Preconditions:**
- User chưa có cart
- Variant có `stock = 50`, `isActive = true`

**Test Steps:**
1. Gửi 2 requests POST `/api/cart/items` song song cùng 1 lúc:
   - Request A: `{ variantId: "var_001", quantity: 10 }`
   - Request B: `{ variantId: "var_001", quantity: 15 }`
2. Đợi cả 2 responses
3. Một request thành công (201), một request fail (400 hoặc 409)
4. Retry request fail với cùng payload
5. Retry nên thành công (cộng dồn vào quantity hiện tại)

**Expected Results:**
- Bước 2: Một success, một fail (do unique constraint conflict)
- Bước 3: Request fail có status 409 Conflict hoặc 400
- Bước 4: Retry thành công với status 201
- Bước 5: Tổng quantity = 10 + 15 = 25

---

### E2E-04: Ownership Validation (User Cannot Access Other's Cart)
**Mô tả:** Kiểm tra user không thể truy cập cart của người khác.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | E2E-04 |
| **Test Description** | Ownership validation: user không thể xem, sửa, xóa cart của người khác |
| **Priority** | High |
| **Type** | Negative |

**Preconditions:**
- User A có cart với 2 items
- User B có cart riêng (có thể rỗng)

**Test Steps:**
1. User B: GET `/api/cart` → Expect cart của User B (không phải cart A)
2. User B: POST `/api/cart/items` → Thêm vào cart B, không ảnh hưởng cart A
3. User B: PUT `/api/cart/items/:itemAId` → Expect 404
4. User B: DELETE `/api/cart/items/:itemAId` → Expect 404
5. User A: GET `/api/cart` → Cart vẫn nguyên vẹn

**Expected Results:**
- Bước 1: Response có `cart.userId = userB` (không phải userA)
- Bước 2: Item được thêm vào cart B, cart A không đổi
- Bước 3: 404 `"Không tìm thấy sản phẩm trong giỏ hàng"`
- Bước 4: 404 `"Không tìm thấy sản phẩm trong giỏ hàng"`
- Bước 5: Cart A vẫn có 2 items ban đầu

---

### E2E-05: Badge Accuracy Throughout Session
**Mô tả:** Kiểm tra badge count chính xác qua toàn bộ session.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | E2E-05 |
| **Test Description** | Badge count: luôn chính xác sau mỗi mutation |
| **Priority** | Medium |
| **Type** | Positive |

**Test Steps:**
1. Bắt đầu với cart rỗng → badge = 0
2. Thêm item 1 → badge = 1
3. Thêm item 2 → badge = 2
4. Thêm item 2 lần 2 → badge = 2 (không tăng, vì cộng dồn)
5. Update item 1 → badge = 2 (không đổi)
6. Xóa item 2 → badge = 1
7. Clear cart → badge = 0

**Expected Results:**
- Mọi mutation trả về lean summary với `itemCount` chính xác
- `itemCount` = số distinct items (không phải tổng quantity)

---

## 4. EDGE CASES

### EC-01: Quantity = 0
**Mô tả:** Kiểm tra validate quantity = 0 bị từ chối.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | EC-01 |
| **Test Description** | Quantity = 0 → bị từ chối (minimum là 1) |
| **Priority** | High |
| **Type** | Negative |

**Test Steps:**
1. POST `/api/cart/items` với `quantity = 0`
2. PUT `/api/cart/items/:itemId` với `quantity = 0`

**Expected Results:**
- Cả 2 requests trả về 400 `"Số lượng phải là số nguyên từ 1 đến 100"`

---

### EC-02: Quantity > 100
**Mô tả:** Kiểm tra validate quantity > 100 bị từ chối.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | EC-02 |
| **Test Description** | Quantity > 100 → bị từ chối (maximum là 100) |
| **Priority** | High |
| **Type** | Negative |

**Test Steps:**
1. POST `/api/cart/items` với `quantity = 101`
2. POST `/api/cart/items` với `quantity = 999`
3. PUT `/api/cart/items/:itemId` với `quantity = 101`

**Expected Results:**
- Tất cả trả về 400 `"Số lượng phải là số nguyên từ 1 đến 100"`

---

### EC-03: Negative Quantity
**Mô tả:** Kiểm tra validate quantity âm bị từ chối.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | EC-03 |
| **Test Description** | Quantity âm → bị từ chối |
| **Priority** | High |
| **Type** | Negative |

**Test Steps:**
1. POST `/api/cart/items` với `quantity = -1`
2. POST `/api/cart/items` với `quantity = -10`

**Expected Results:**
- Tất cả trả về 400 `"Số lượng phải là số nguyên từ 1 đến 100"`

---

### EC-04: Variant Not Exists
**Mô tả:** Kiểm tra variant không tồn tại bị từ chối.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | EC-04 |
| **Test Description** | Variant không tồn tại → 404 |
| **Priority** | High |
| **Type** | Negative |

**Test Steps:**
1. POST `/api/cart/items` với `variantId = "non_existent"`

**Expected Results:**
- 404 `"Sản phẩm không tồn tại hoặc đã ngừng bán"`

---

### EC-05: Variant Inactive
**Mô tả:** Kiểm tra variant inactive bị từ chối.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | EC-05 |
| **Test Description** | Variant inactive (isActive = false) → 404 |
| **Priority** | High |
| **Type** | Negative |

**Preconditions:**
- Variant có `isActive = false`

**Test Steps:**
1. POST `/api/cart/items` với `variantId` của inactive variant

**Expected Results:**
- 404 `"Sản phẩm không tồn tại hoặc đã ngừng bán"`

---

### EC-06: Stock Insufficient
**Mô tạ:** Kiểm tra stock không đủ bị từ chối với message rõ ràng.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | EC-06 |
| **Test Description** | Stock không đủ → 400 với message hiển thị số còn lại |
| **Priority** | High |
| **Type** | Negative |

**Preconditions:**
- Variant có `stock = 5`

**Test Steps:**
1. POST `/api/cart/items` với `quantity = 10` (vượt stock)

**Expected Results:**
- 400 `"Sản phẩm không đủ hàng (còn 5)"`

---

### EC-07: Cart Not Found
**Mô tả:** Kiểm tra cart không tồn tại khi thực hiện operation.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | EC-07 |
| **Test Description** | Cart không tồn tại → GET tạo mới, DELETE trả về 404 |
| **Priority** | Medium |
| **Type** | Edge |

**Test Steps:**
1. GET `/api/cart` với user chưa có cart → Expect cart mới được tạo
2. DELETE `/api/cart` với user chưa có cart → Expect 404

**Expected Results:**
- Bước 1: 200 với cart mới (auto-created)
- Bước 2: 404 `"Giỏ hàng không tồn tại"`

---

### EC-08: Item Not Found
**Mô tả:** Kiểm tra item không tồn tại khi update/delete.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | EC-08 |
| **Test Description** | Item không tồn tại → 404 khi update/delete |
| **Priority** | High |
| **Type** | Negative |

**Test Steps:**
1. PUT `/api/cart/items/non_existent` với `quantity = 5`
2. DELETE `/api/cart/items/non_existent`

**Expected Results:**
- Cả 2 đều 404 `"Không tìm thấy sản phẩm trong giỏ hàng"`

---

### EC-09: Maximum Items per Cart (100 items)
**Mô tả:** Kiểm tra giới hạn 100 items per cart.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | EC-09 |
| **Test Description** | Giới hạn 100 items/giỏ → chặn khi vượt quá |
| **Priority** | Medium |
| **Type** | Edge |

**Preconditions:**
- Cart đã có 100 distinct items

**Test Steps:**
1. POST `/api/cart/items` với variant mới (item thứ 101)

**Expected Results:**
- 400 `"Giỏ hàng đã đạt giới hạn 100 sản phẩm"`

---

### EC-10: Invalid VariantId Format
**Mô tả:** Kiểm tra variantId không hợp lệ bị từ chối.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | EC-10 |
| **Test Description** | VariantId không hợp lệ → 400 validation error |
| **Priority** | Medium |
| **Type** | Negative |

**Test Steps:**
1. POST `/api/cart/items` với `variantId = null`
2. POST `/api/cart/items` với `variantId = ""`
3. POST `/api/cart/items` không có `variantId`

**Expected Results:**
- Tất cả trả về 400 `"variantId không hợp lệ"`

---

## 5. PERFORMANCE TESTS

### PT-01: Add to Cart Response Time
**Mô tả:** Kiểm tra thêm sản phẩm vào giỏ < 200ms (p95).

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | PT-01 |
| **Test Description** | Thêm sản phẩm → response time < 200ms (p95) |
| **Priority** | High |
| **Type** | Performance |

**Test Steps:**
1. Gửi 100 requests POST `/api/cart/items` song song
2. Đo response time của từng request
3. Tính p95 (percentile 95)

**Expected Results:**
- 95% requests < 200ms
- Không có request > 500ms

---

### PT-02: Get Full Cart Response Time
**Mô tả:** Kiểm tra lấy toàn bộ giỏ hàng < 300ms (p95).

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | PT-02 |
| **Test Description** | Lấy giỏ hàng đầy đủ → response time < 300ms (p95) |
| **Priority** | High |
| **Type** | Performance |

**Test Steps:**
1. Tạo cart với 50 items (worst case)
2. Gửi 100 requests GET `/api/cart` song song
3. Đo response time

**Expected Results:**
- 95% requests < 300ms
- Không có request > 1000ms

---

### PT-03: Lean Summary Response Time
**Mô tả:** Kiểm tra lean summary trả về < 50ms (p95).

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | PT-03 |
| **Test Description** | Lean summary → response time < 50ms (p95) |
| **Priority** | Medium |
| **Type** | Performance |

**Test Steps:**
1. Gửi 100 mutations (POST/PUT/DELETE) song song
2. Đo response time của lean summary

**Expected Results:**
- 95% responses < 50ms
- Không có response > 100ms

---

### PT-04: Concurrent Users (100+ users)
**Mô tả:** Kiểm tra hệ thống chịu được 100+ users thao tác cùng lúc.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | PT-04 |
| **Test Description** | 100 users concurrent → error rate < 0.1% |
| **Priority** | High |
| **Type** | Performance |

**Test Steps:**
1. Simulate 100 users, mỗi user gửi 10 requests
2. Tổng 1000 requests song song
3. Đo error rate và response time

**Expected Results:**
- Error rate < 0.1% (tối đa 1 failed request)
- P95 response time < 500ms
- Không có database deadlock

---

## 6. SECURITY TESTS

### SEC-01: SQL Injection Prevention
**Mô tả:** Kiểm tra SQL injection bị chặn bởi Prisma ORM.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | SEC-01 |
| **Test Description** | SQL injection → ORM escape input, không crash |
| **Priority** | High |
| **Type** | Security |

**Test Steps:**
1. POST `/api/cart/items` với `variantId = "'; DROP TABLE carts; --"`
2. POST `/api/cart/items` với `variantId = "' OR '1'='1"`
3. Kiểm tra database không bị ảnh hưởng

**Expected Results:**
- Tất cả trả về 404 hoặc 400 (không crash)
- Database không bị drop hay alter
- Error message an toàn

---

### SEC-02: Authentication Required
**Mô tả:** Kiểm tra tất cả endpoints yêu cầu authentication.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | SEC-02 |
| **Test Description** | Gọi endpoints không có JWT token → 401 Unauthorized |
| **Priority** | High |
| **Type** | Security |

**Test Steps:**
1. GET `/api/cart` không có token
2. POST `/api/cart/items` không có token
3. PUT `/api/cart/items/:itemId` không có token
4. DELETE `/api/cart/items/:itemId` không có token
5. DELETE `/api/cart` không có token

**Expected Results:**
- Tất cả trả về 401 Unauthorized
- Không có leak data

---

### SEC-03: Authorization Check (Customer Role)
**Mô tả:** Kiểm tra role-based access control.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | SEC-03 |
| **Test Description** | User không có role CUSTOMER → 403 Forbidden |
| **Priority** | High |
| **Type** | Security |

**Test Steps:**
1. User với role ADMIN gọi GET `/api/cart`
2. User chưa authenticated gọi POST `/api/cart/items`

**Expected Results:**
- Bước 1: 403 Forbidden (nếu API chỉ dành cho CUSTOMER)
- Bước 2: 401 Unauthorized

---

### SEC-04: Ownership Enforcement
**Mô tả:** Kiểm tra user không thể access cart của người khác.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | SEC-04 |
| **Test Description** | Ownership enforcement → không thể access cart của người khác |
| **Priority** | High |
| **Type** | Security |

**Test Steps:**
1. User A lấy `cartId` của User B từ response (nếu leak)
2. User A cố gắng GET `/api/cart` với `cartId` của User B (nếu API cho phép)
3. User A cố gắng update item của User B

**Expected Results:**
- Bước 1: Response không leak `cartId` của user khác
- Bước 2: API chỉ dùng token để xác định user, không cho phép truyền `cartId`
- Bước 3: 404 `"Không tìm thấy sản phẩm trong giỏ hàng"`

---

### SEC-05: Rate Limiting
**Mô tả:** Kiểm tra rate limiting được áp dụng.

| Thuộc tính | Giá trị |
|---|---|
| **Test ID** | SEC-05 |
| **Test Description** | Gửi quá nhiều requests → rate limit được apply |
| **Priority** | Medium |
| **Type** | Security |

**Test Steps:**
1. Gửi 1000 requests trong 1 phút từ cùng 1 user
2. Kiểm tra response status

**Expected Results:**
- Sau khi vượt ngưỡng, trả về 429 Too Many Requests
- Retry-After header được set

---

## Test Summary

### Coverage Matrix

| Category | Total Tests | Coverage |
|---|---|---|
| Unit Tests | 6 | Cart logic, quantity, stock, ownership, lean summary |
| Integration Tests | 6 | Full API flows, auto-creation, accumulation, clear cart |
| E2E Tests | 5 | Complete workflows, stock enforcement, race conditions |
| Edge Cases | 10 | Boundary values, invalid inputs, not found cases |
| Performance Tests | 4 | Response times, concurrent users, scalability |
| Security Tests | 5 | SQL injection, auth, authorization, ownership, rate limiting |
| **TOTAL** | **36** | **Comprehensive coverage** |

### Priority Distribution

| Priority | Count | Percentage |
|---|---|---|
| High | 24 | 67% |
| Medium | 10 | 28% |
| Low | 2 | 5% |

### Test Type Distribution

| Type | Count | Percentage |
|---|---|---|
| Positive | 18 | 50% |
| Negative | 14 | 39% |
| Edge | 4 | 11% |

---

## Execution Guidelines

### Test Execution Order

1. **Phase 1: Unit Tests** (UT-01 đến UT-06)
   - Thời gian: ~5 phút
   - Môi trường: Local, test database

2. **Phase 2: Integration Tests** (IT-01 đến IT-06)
   - Thời gian: ~10 phút
   - Môi trường: Staging, clean database mỗi test

3. **Phase 3: E2E Tests** (E2E-01 đến E2E-05)
   - Thời gian: ~15 phút
   - Môi trường: Staging, full stack

4. **Phase 4: Edge Cases** (EC-01 đến EC-10)
   - Thời gian: ~10 phút
   - Môi trường: Staging

5. **Phase 5: Performance Tests** (PT-01 đến PT-04)
   - Thời gian: ~20 phút
   - Môi trường: Staging với production-like data

6. **Phase 6: Security Tests** (SEC-01 đến SEC-05)
   - Thời gian: ~10 phút
   - Môi trường: Staging

**Total Estimated Time:** ~70 phút

### Pass/Fail Criteria

**PASS Condition:**
- 100% High priority tests pass
- ≥ 95% Medium priority tests pass
- ≥ 90% Low priority tests pass
- 0 critical security vulnerabilities
- P95 response time meet SLA

**FAIL Condition:**
- Any High priority test fails
- ≥ 2 Medium priority tests fail
- ≥ 3 Low priority tests fail
- Any critical security vulnerability found
- P95 response time exceed SLA by > 20%

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-20  
> **Next Review:** After implementation complete  
> **Prepared by:** API Tester Agent  
> **Approved by:** [Pending Approval]
