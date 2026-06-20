# Nghiệp vụ Cart (Giỏ hàng) — Mobivexa

> **Phạm vi:** `src/services/cart.service.ts`, `src/controllers/cart.controller.ts`, `src/routes/cart.route.ts`, `src/validators/cart.validator.ts`
>
> **Cập nhật:** 2026-06-19

---

## 1. Tổng quan

Module Cart quản lý **giỏ hàng của người dùng đã đăng nhập**. Mỗi user có đúng **1 giỏ hàng** (1:1), chứa nhiều `CartItem` — mỗi item tương ứng với 1 variant sản phẩm và số lượng.

**Thiết kế 2 loại response:**
- **Full response** (`GET /cart`): Trả đầy đủ thông tin items + variant + tên/ảnh sản phẩm — dùng khi user vào trang giỏ hàng
- **Lean summary** (sau mọi mutation): Chỉ trả `{ cartId, itemCount }` — dùng để cập nhật badge số lượng trên icon giỏ hàng mà không cần reload toàn bộ

---

## 2. Danh sách endpoint

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/api/cart` | Lấy toàn bộ giỏ hàng | ✅ |
| `POST` | `/api/cart/items` | Thêm sản phẩm vào giỏ | ✅ |
| `PUT` | `/api/cart/items/:itemId` | Cập nhật số lượng item | ✅ |
| `DELETE` | `/api/cart/items/:itemId` | Xóa 1 item khỏi giỏ | ✅ |
| `DELETE` | `/api/cart` | Xóa toàn bộ giỏ hàng | ✅ |

---

## 3. Chính sách & Ràng buộc nghiệp vụ

### 3.1 Giỏ hàng (Cart)

| Quy tắc | Giá trị |
|---|---|
| Quan hệ User–Cart | 1 user : 1 giỏ hàng (duy nhất, unique theo `userId`) |
| Tạo giỏ hàng | **Tự động** (`upsert`) khi user GET giỏ hàng hoặc thêm item lần đầu — không cần endpoint tạo riêng |
| Xóa giỏ hàng | Chỉ xóa các `CartItem` bên trong, **không xóa bảng ghi Cart** |

### 3.2 CartItem

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| `variantId` | ✅ | Phải là string hợp lệ; variant phải tồn tại và `isActive = true` |
| `quantity` | ✅ | Số nguyên từ **1 đến 100** |

**Ràng buộc khi thêm (`POST /cart/items`):**
- Nếu variant **chưa có** trong giỏ → tạo `CartItem` mới với quantity được gửi
- Nếu variant **đã có** trong giỏ → **cộng dồn** quantity (không thay thế)
- Tổng quantity sau cộng dồn không được vượt quá `stock` của variant

**Ràng buộc khi cập nhật (`PUT /cart/items/:itemId`):**
- Quantity mới thay thế trực tiếp (không cộng dồn)
- Phải ≤ `stock` hiện tại của variant

**Kiểm tra quyền sở hữu:**
- Mọi thao tác trên item đều kiểm tra `item.cartId === cart.id` của user hiện tại → `404` nếu không khớp

### 3.3 Tồn kho

- Kiểm tra `stock` tại thời điểm thêm/sửa — **không lock** tồn kho (không trừ stock cho đến khi đặt hàng)
- Nếu hàng hết kho sau khi đã thêm vào giỏ: hệ thống **không tự xóa** item (vẫn hiển thị trong giỏ, bị chặn khi đặt hàng)

---

## 4. Luồng nghiệp vụ chi tiết

### 4.1 Lấy giỏ hàng

```
GET /api/cart → [authenticate] → getCart(userId) → upsert Cart → Response (full)
```

**Happy Path:**
1. Upsert giỏ hàng: tạo mới nếu chưa có, không làm gì nếu đã có
2. Trả về giỏ hàng đầy đủ gồm `items[]`, mỗi item kèm:
   - Thông tin variant (color, storage, ram, salePrice, stock...)
   - Thông tin sản phẩm: `id`, `name`, `slug`, ảnh bìa (`isCover = true`)
3. Items sắp theo `createdAt ASC` (item thêm trước hiển thị trước)

**Response mẫu:**
```json
{
  "cart": {
    "id": "cart-1",
    "userId": "user-1",
    "items": [
      {
        "id": "item-1",
        "quantity": 2,
        "variant": {
          "id": "var-1",
          "sku": "IP15-BLK-128",
          "color": "Black",
          "storage": "128GB",
          "salePrice": 22990000,
          "stock": 10,
          "product": {
            "id": "prod-1",
            "name": "iPhone 15",
            "slug": "iphone-15",
            "images": [{ "url": "https://cdn.cloudinary.com/..." }]
          }
        }
      }
    ]
  }
}
```

---

### 4.2 Thêm sản phẩm vào giỏ

```
POST /api/cart/items → [authenticate] → [validate] → addItem → Response (lean summary)
```

**Happy Path:**
1. Validate: `variantId` là string hợp lệ; `quantity` là số nguyên từ 1–100
2. **Song song:**
   - Lấy variant (kiểm tra `isActive`, `stock`)
   - Upsert giỏ hàng (tạo nếu chưa có)
3. Kiểm tra variant tồn tại và đang `isActive = true`
4. Kiểm tra `quantity ≤ variant.stock`
5. Tra cứu item theo `(cartId, variantId)`:
   - **Chưa có** → tạo `CartItem` mới
   - **Đã có** → tính `newQty = existingQty + quantity`; kiểm tra `newQty ≤ stock`; cập nhật quantity
6. Trả về `201` + lean summary `{ cartId, itemCount }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Thiếu `variantId` | 400 | `variantId không hợp lệ` |
| `quantity` < 1 hoặc > 100 hoặc không nguyên | 400 | `Số lượng phải là số nguyên từ 1 đến 100` |
| Variant không tồn tại hoặc `isActive = false` | 404 | `Sản phẩm không tồn tại hoặc đã ngừng bán` |
| `quantity` > `stock` (lần thêm đầu) | 400 | `Sản phẩm không đủ hàng (còn {stock})` |
| Quantity cộng dồn > `stock` | 400 | `Số lượng vượt quá tồn kho (còn {stock})` |

---

### 4.3 Cập nhật số lượng item

```
PUT /api/cart/items/:itemId → [authenticate] → [validate] → updateItem → Response (lean summary)
```

**Happy Path:**
1. Validate: `quantity` là số nguyên từ 1–100
2. Tìm giỏ hàng theo `userId` — `404` nếu không tồn tại
3. Tìm item theo `itemId` trong giỏ đó — `404` nếu không có hoặc không thuộc giỏ
4. Lấy `stock` hiện tại của variant
5. Kiểm tra `quantity ≤ stock`
6. Cập nhật quantity (replace, không cộng dồn)
7. Trả về `200` + lean summary

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `quantity` không hợp lệ | 400 | `Số lượng phải là số nguyên từ 1 đến 100` |
| Giỏ hàng không tồn tại | 404 | `Giỏ hàng không tồn tại` |
| Item không tồn tại / không thuộc giỏ | 404 | `Không tìm thấy sản phẩm trong giỏ hàng` |
| `quantity` > `stock` | 400 | `Số lượng vượt quá tồn kho (còn {stock})` |

---

### 4.4 Xóa 1 item

```
DELETE /api/cart/items/:itemId → [authenticate] → removeItem → Response (lean summary)
```

**Happy Path:**
1. Tìm giỏ hàng — `404` nếu không có
2. Tìm item trong giỏ — `404` nếu không có hoặc không thuộc giỏ
3. Xóa item
4. Trả về `200` + lean summary `{ cartId, itemCount }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Giỏ hàng không tồn tại | 404 | `Giỏ hàng không tồn tại` |
| Item không tồn tại / không thuộc giỏ | 404 | `Không tìm thấy sản phẩm trong giỏ hàng` |

---

### 4.5 Xóa toàn bộ giỏ hàng

```
DELETE /api/cart → [authenticate] → clearCart → Response
```

**Happy Path:**
1. Xóa tất cả `CartItem` của user (`deleteMany` theo `cart.userId`)
2. **Không** xóa bản ghi `Cart` — giỏ hàng vẫn tồn tại, chỉ trống
3. Trả về `200` + `{ message: 'Đã xóa toàn bộ giỏ hàng' }`

> Không trả lean summary vì itemCount rõ ràng là 0.

---

## 5. Sơ đồ luồng thêm sản phẩm

```
POST /cart/items
        │
   [Validate] ─── fail ──► 400
        │
   Song song:
   ┌────┴────┐
 Lấy      Upsert
 variant   Cart
   └────┬────┘
        │
  variant tồn tại? ── No ──► 404
  isActive = true?
        │ Yes
        │
  quantity ≤ stock? ── No ──► 400
        │ Yes
        │
  Item đã có trong giỏ?
        │
   ┌────┴────────────────┐
   │ Chưa có             │ Đã có
   │                     │
  Tạo CartItem mới   newQty = existing + quantity
                         │
                    newQty ≤ stock? ── No ──► 400
                         │ Yes
                    Update CartItem
        │
   Fetch itemCount
        │
   201 + { cartId, itemCount }
```

---

## 6. Bảng dữ liệu

### Bảng `Cart`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `userId` | string | FK → User; **unique** (1 user 1 cart) |
| `items` | CartItem[] | Relation 1:N |

### Bảng `CartItem`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `cartId` | string | FK → Cart |
| `variantId` | string | FK → ProductVariant |
| `quantity` | int | Số lượng (1–100) |
| `createdAt` | DateTime | Dùng để sắp xếp hiển thị (ASC) |

**Unique constraint:** `(cartId, variantId)` — mỗi variant chỉ xuất hiện 1 lần trong 1 giỏ hàng

---

## 7. Thiết kế đáng chú ý

| # | Thiết kế | Lý do |
|---|---|---|
| 1 | **Upsert cart** (không tạo thủ công) | User không cần bước tạo giỏ hàng — trải nghiệm liền mạch |
| 2 | **Cộng dồn** khi thêm item đã có | Tránh ghi đè nhầm khi user thêm cùng sản phẩm từ nhiều màn hình |
| 3 | **Lean summary** sau mutation | Frontend chỉ cần cập nhật badge, không reload toàn bộ giỏ hàng |
| 4 | **Không lock stock** | Stock chỉ kiểm tra tại thời điểm thêm/sửa; không trừ kho cho đến khi đặt hàng |
| 5 | **Không xóa Cart** khi clear | Bản ghi Cart tồn tại vĩnh viễn, chỉ xóa items bên trong |
| 6 | **Kiểm tra ownership** item | `item.cartId === cart.id` — ngăn user A xóa item của user B |
| 7 | **Không cache** | Cart là data cá nhân, thay đổi liên tục — không phù hợp để cache |

---

## 8. Liên kết với module khác

| Module | Quan hệ |
|---|---|
| **Product/Variant** | Cart item tham chiếu `ProductVariant`; kiểm tra `isActive` và `stock` khi thêm/sửa |
| **Order** | Khi đặt hàng thành công, `clearCart` được gọi để xóa toàn bộ giỏ hàng |
| **Auth** | Toàn bộ cart route yêu cầu Access Token (`authenticate`) |
