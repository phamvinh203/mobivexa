# Use Case Document
## Module: Cart
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## UC-01: Xem giỏ hàng

**Actor:** Customer  
**Flow:**
1. GET `/api/cart`
2. Nếu chưa có giỏ → tự tạo (upsert)
3. Trả giỏ đầy đủ với variant, ảnh sản phẩm, sắp xếp theo `createdAt ASC`

---

## UC-02: Thêm sản phẩm vào giỏ (variant chưa có)

**Actor:** Customer  
**Flow:**
1. POST `/api/cart/items` với `{ variantId, quantity }`
2. Validate variantId, quantity (1–100)
3. Kiểm tra variant `isActive`, stock đủ
4. Tạo CartItem mới
5. Trả `{ cartId, itemCount }`

**Exception:**
- Variant inactive hoặc không tồn tại → 404
- Stock < quantity → 400 với số tồn thực tế

---

## UC-03: Thêm sản phẩm đã có trong giỏ (cộng dồn)

**Actor:** Customer  
**Flow:**
1. POST `/api/cart/items` với variantId đã có trong giỏ
2. `newQty = existing.quantity + quantity`
3. Kiểm tra `newQty <= stock`
4. Update quantity

**Exception:** `newQty > stock` → 400

---

## UC-04: Cập nhật số lượng item

**Actor:** Customer  
**Flow:**
1. PUT `/api/cart/items/:itemId` với `{ quantity }`
2. Kiểm tra giỏ tồn tại, item thuộc giỏ
3. Kiểm tra `quantity <= stock`
4. Update; trả lean summary

**Exception:**
- Giỏ không tồn tại → 404
- Item không trong giỏ → 404
- Vượt tồn kho → 400

---

## UC-05: Xóa một item khỏi giỏ

**Actor:** Customer  
**Flow:**
1. DELETE `/api/cart/items/:itemId`
2. Ownership check (item phải trong giỏ của user)
3. Delete item; trả lean summary

**Exception:**
- Giỏ không tồn tại → 404
- Item không trong giỏ → 404

---

## UC-06: Xóa toàn bộ giỏ

**Actor:** Customer (hoặc Order module sau khi đặt hàng)  
**Flow:**
1. DELETE `/api/cart`
2. `deleteMany CartItem WHERE cart.userId=userId`
3. Cart record giữ nguyên; itemCount = 0

---

## UC-07: Đặt hàng từ giỏ (liên kết với Order module)

**Actor:** Customer  
**Note:** Khi POST `/api/orders` không truyền `items` → Order module gọi `resolveItems()` đọc giỏ hàng, sau khi tạo đơn xong gọi `clearCart()` xóa toàn bộ items. Module Cart không có route đặt hàng riêng.
