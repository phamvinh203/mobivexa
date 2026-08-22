# Test Case Document
## Module: Cart
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| Xem giỏ hàng | 2 |
| Thêm sản phẩm | 7 |
| Cập nhật số lượng | 5 |
| Xóa item | 3 |
| Xóa toàn bộ | 2 |
| **Tổng** | **19** |

---

## TC-GET: Xem giỏ hàng

### TC-GET-01: Tự tạo giỏ nếu chưa có

**Precondition:** User mới, chưa có Cart  
**Expected:**
- `200`
- Cart được tạo trong DB
- `items = []`

---

### TC-GET-02: Trả đầy đủ 4 cấp join

**Precondition:** Giỏ có 2 items  
**Expected:**
- `items[0].variant.product.name` tồn tại
- `items[0].variant.product.images[0].url` tồn tại (isCover=true)
- Items sắp xếp `createdAt ASC`

---

## TC-ADD: Thêm sản phẩm

### TC-ADD-01: Thêm thành công — trả lean summary

**Input:** `{ variantId, quantity: 1 }` với variant active, stock=10  
**Expected:**
- `200 { cartId, itemCount: 1 }`
- CartItem được tạo trong DB

---

### TC-ADD-02: Thêm variant đã có → cộng dồn

**Precondition:** CartItem đã có `quantity = 2`; stock = 10  
**Input:** `quantity: 3`  
**Expected:**
- `200 { itemCount: 1 }` (vẫn 1 CartItem)
- CartItem.quantity === 5

---

### TC-ADD-03: Cộng dồn vượt tồn kho → 400

**Precondition:** CartItem có `quantity = 8`; stock = 10  
**Input:** `quantity: 5` (tổng = 13 > 10)  
**Expected:** `400 Số lượng vượt quá tồn kho (còn 10)`

---

### TC-ADD-04: Stock không đủ (variant mới) → 400

**Precondition:** stock = 2  
**Input:** `quantity: 5`  
**Expected:** `400 Sản phẩm không đủ hàng (còn 2)`

---

### TC-ADD-05: Variant không tồn tại → 404

**Input:** variantId ngẫu nhiên không có trong DB  
**Expected:** `404`

---

### TC-ADD-06: Variant inactive → 404

**Precondition:** `variant.isActive = false`  
**Expected:** `404 Sản phẩm không tồn tại hoặc đã ngừng bán`

---

### TC-ADD-07: quantity > 100 → 400 (validator)

**Input:** `quantity: 101`  
**Expected:** `400`

---

## TC-UPDATE: Cập nhật số lượng

### TC-UPDATE-01: Cập nhật thành công

**Input:** `{ quantity: 5 }`; stock = 10  
**Expected:** `200 { cartId, itemCount }`; CartItem.quantity === 5

---

### TC-UPDATE-02: Vượt tồn kho → 400

**Precondition:** stock = 3  
**Input:** `quantity: 5`  
**Expected:** `400 Số lượng vượt quá tồn kho (còn 3)`

---

### TC-UPDATE-03: Item không trong giỏ → 404

**Input:** itemId của user khác  
**Expected:** `404 Không tìm thấy sản phẩm trong giỏ hàng`

---

### TC-UPDATE-04: Giỏ không tồn tại → 404

**Precondition:** Xóa Cart trực tiếp trong DB  
**Expected:** `404 Giỏ hàng không tồn tại`

---

### TC-UPDATE-05: quantity = 0 → 400 (validator)

**Input:** `{ quantity: 0 }`  
**Expected:** `400`

---

## TC-REMOVE: Xóa item

### TC-REMOVE-01: Xóa thành công

**Expected:** `200 { cartId, itemCount }` (itemCount giảm 1)

---

### TC-REMOVE-02: Item không trong giỏ → 404

**Input:** itemId của user khác  
**Expected:** `404`

---

### TC-REMOVE-03: Giỏ không tồn tại → 404

**Expected:** `404`

---

## TC-CLEAR: Xóa toàn bộ giỏ

### TC-CLEAR-01: Xóa toàn bộ items — Cart record giữ nguyên

**Precondition:** Giỏ có 3 items  
**Expected:**
- `200`
- `CartItem.count WHERE cartId = 0`
- Cart record vẫn tồn tại trong DB

---

### TC-CLEAR-02: Giỏ rỗng — không lỗi

**Precondition:** Giỏ đã rỗng  
**Expected:** `200` (deleteMany trả count=0, không ném lỗi)

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Auto-create cart (upsert) | TC-GET-01 |
| Merge quantity khi add trùng | TC-ADD-02 |
| Stock check khi merge | TC-ADD-03 |
| variant isActive check | TC-ADD-06 |
| Lean summary sau mutations | TC-ADD-01, TC-UPDATE-01 |
| Ownership check item | TC-UPDATE-03, TC-REMOVE-02 |
| Cart record giữ sau clearCart | TC-CLEAR-01 |
| quantity max=100 validator | TC-ADD-07 |
