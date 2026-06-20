# Use Case Document
## Module: Cart (Giỏ hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-20  
> **Tham chiếu:** [BRD.md](./BRD.md) | [SRS.md](./SRS.md)

---

## 1. Actors

| Actor | Mô tả | Role |
|---|---|---|
| **Customer** | Khách hàng đã đăng nhập | `CUSTOMER` |
| **Cart System** | Module giỏ hàng (backend) | Hệ thống nội bộ |
| **Product Service** | Module sản phẩm (backend) | Hệ thống nội bộ |
| **Database** | Cơ sở dữ liệu lưu trữ giỏ hàng | Hệ thống lưu trữ |

---

## 2. Danh sách Use Case

| ID | Tên Use Case | Actor chính | Độ ưu tiên |
|---|---|---|---|
| UC-01 | Xem giỏ hàng | Customer | Cao |
| UC-02 | Thêm sản phẩm vào giỏ | Customer | Cao |
| UC-03 | Cập nhật số lượng sản phẩm | Customer | Cao |
| UC-04 | Xóa sản phẩm khỏi giỏ | Customer | Trung bình |
| UC-05 | Xóa toàn bộ giỏ hàng | Customer | Trung bình |

---

## 3. Chi tiết Use Case

---

### UC-01: Xem giỏ hàng

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Xem toàn bộ sản phẩm trong giỏ hàng với thông tin đầy đủ |
| **Tiền điều kiện** | Customer đã đăng nhập và có JWT token hợp lệ |
| **Hậu điều kiện** | Hiển thị danh sách items kèm variant + product + ảnh bìa; giỏ hàng tự động tạo nếu chưa có |
| **Trigger** | Customer truy cập trang giỏ hàng hoặc click icon giỏ |

**Luồng chính (Happy Path):**

1. Customer gửi request với JWT token trong header `Authorization: Bearer <token>`
2. Hệ thống xác thực JWT token và lấy `userId` từ payload
3. Hệ thống kiểm tra và upsert Cart:
   - Nếu chưa có cart cho user này → tạo mới Cart với `userId`
   - Nếu đã có → sử dụng Cart hiện tại
4. Hệ thống query CartItems theo `cartId`, sắp xếp theo `createdAt ASC`
5. Hệ thống load thông tin đầy đủ cho mỗi item:
   - ProductVariant: `color`, `storage`, `ram`, `salePrice`, `stock`
   - Product: `id`, `name`, `slug`
   - ProductImage: ảnh bìa (`isCover = true`)
6. Hệ thống trả về `200` + `{ cart: { id, userId, items: [...] } }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Token không hợp lệ hoặc hết hạn | Trả `401` — `Token không hợp lệ hoặc đã hết hạn` |
| 2 | User không tồn tại trong DB | Trả `404` — `Không tìm thấy người dùng` |
| 3 | Database lỗi khi upsert cart | Trả `500` — `Lỗi hệ thống, vui lòng thử lại` |
| 4 | Database lỗi khi query items | Trả `500` — `Lỗi hệ thống, vui lòng thử lại` |
| 5 | Variant không tồn tại hoặc inactive | Bỏ qua item này (không hiển thị) |

**Ghi chú:**
- Upsert cart đảm bảo user luôn có giỏ hàng mà không cần bước tạo riêng
- Full response cho phép hiển thị thông tin sản phẩm đầy đủ trên UI
- Items được sắp xếp theo thời gian thêm (cũ nhất trước)

---

### UC-02: Thêm sản phẩm vào giỏ

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Thêm sản phẩm vào giỏ hàng, tự động cộng dồn nếu đã có |
| **Tiền điều kiện** | Customer đã đăng nhập; variant tồn tại và hoạt động |
| **Hậu điều kiện** | Item được thêm hoặc cập nhật quantity; badge trên UI được cập nhật |
| **Trigger** | Customer nhấn "Thêm vào giỏ" từ trang sản phẩm |

**Luồng chính (Happy Path):**

1. Customer gửi request với `{ variantId, quantity }`
2. Hệ thống validate input:
   - `variantId` là string hợp lệ
   - `quantity` là số nguyên ≥ 1 và ≤ 100
3. Hệ thống thực hiện song song:
   - Query ProductVariant để lấy `isActive` và `stock`
   - Upsert Cart (tạo mới nếu chưa có)
4. Hệ thống kiểm tra variant tồn tại và `isActive = true`
5. Hệ thống kiểm tra `quantity ≤ stock`
6. Hệ thống tra cứu CartItem theo `(cartId, variantId)`:
   - **Chưa có** → tạo CartItem mới với quantity
   - **Đã có** → tính `newQty = existingQty + quantity`
7. Hệ thống kiểm tra `newQty ≤ stock` (trường hợp cộng dồn)
8. Hệ thống cập nhật database:
   - Tạo mới hoặc update CartItem
9. Hệ thống trả về `201` + lean summary `{ cartId, itemCount }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | variantId không hợp lệ | Trả `400` — `variantId không hợp lệ` |
| 2 | quantity < 1 hoặc > 100 | Trả `400` — `Số lượng phải là số nguyên từ 1 đến 100` |
| 4 | Variant không tồn tại | Trả `404` — `Sản phẩm không tồn tại hoặc đã ngừng bán` |
| 4 | Variant inactive | Trả `404` — `Sản phẩm không tồn tại hoặc đã ngừng bán` |
| 5 | quantity > stock | Trả `400` — `Sản phẩm không đủ hàng (còn {stock})` |
| 7 | newQty > stock (cộng dồn) | Trả `400` — `Số lượng vượt quá tồn kho (còn {stock})` |
| 8 | Race condition (concurrent add) | Database reject 1 request nhờ unique constraint |
| Bất kỳ | Lỗi database | Trả `500` — `Lỗi hệ thống, vui lòng thử lại` |

**Ghi chú:**
- Cộng dồn quantity giúp tránh trùng lặp items trong giỏ
- Lean response `{ cartId, itemCount }` giúp update badge nhanh mà không cần reload toàn bộ giỏ
- Unique constraint `(cartId, variantId)` ngăn race condition

---

### UC-03: Cập nhật số lượng sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Thay đổi số lượng của một item trong giỏ hàng |
| **Tiền điều kiện** | Customer đã đăng nhập; item tồn tại và thuộc giỏ của user |
| **Hậu điều kiện** | Quantity của item được cập nhật; badge trên UI được cập nhật |
| **Trigger** | Customer chỉnh số lượng trong trang giỏ hàng và nhấn "Cập nhật" |

**Luồng chính (Happy Path):**

1. Customer gửi request `PUT /api/cart/items/:itemId` với `{ quantity }`
2. Hệ thống validate `quantity` là số nguyên ≥ 1 và ≤ 100
3. Hệ thống lấy Cart theo `userId` từ JWT token
4. Hệ thống tìm CartItem theo `itemId` trong cart đó
5. Hệ thống kiểm tra item thuộc về cart (ownership check)
6. Hệ thống query `stock` hiện tại của variant
7. Hệ thống kiểm tra `quantity ≤ stock`
8. Hệ thống update quantity (thay thế trực tiếp, không cộng dồn)
9. Hệ thống trả về `200` + lean summary `{ cartId, itemCount }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | quantity không hợp lệ | Trả `400` — `Số lượng phải là số nguyên từ 1 đến 100` |
| 3 | Giỏ không tồn tại | Trả `404` — `Giỏ hàng không tồn tại` |
| 4 | Item không tồn tại | Trả `404` — `Không tìm thấy sản phẩm trong giỏ hàng` |
| 5 | Item không thuộc về cart | Trả `404` — `Không tìm thấy sản phẩm trong giỏ hàng` |
| 7 | quantity > stock | Trả `400` — `Số lượng vượt quá tồn kho (còn {stock})` |
| Bất kỳ | Lỗi database | Trả `500` — `Lỗi hệ thống, vui lòng thử lại` |

**Ghi chú:**
- Ownership check ngăn user sửa item của user khác
- Quantity được thay thế, không cộng dồn (khác với thêm sản phẩm)
- Lean response giúp update badge nhanh

---

### UC-04: Xóa sản phẩm khỏi giỏ

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Xóa một item cụ thể khỏi giỏ hàng |
| **Tiền điều kiện** | Customer đã đăng nhập; item tồn tại và thuộc giỏ của user |
| **Hậu điều kiện** | Item bị xóa; badge trên UI được cập nhật |
| **Trigger** | Customer nhấn "Xóa" bên cạnh item trong trang giỏ hàng |

**Luồng chính (Happy Path):**

1. Customer gửi request `DELETE /api/cart/items/:itemId`
2. Hệ thống lấy Cart theo `userId` từ JWT token
3. Hệ thống tìm CartItem theo `itemId` trong cart đó
4. Hệ thống kiểm tra item thuộc về cart (ownership check)
5. Hệ thống xóa CartItem khỏi database
6. Hệ thống trả về `200` + lean summary `{ cartId, itemCount }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Giỏ không tồn tại | Trả `404` — `Giỏ hàng không tồn tại` |
| 3 | Item không tồn tại | Trả `404` — `Không tìm thấy sản phẩm trong giỏ hàng` |
| 4 | Item không thuộc về cart | Trả `404` — `Không tìm thấy sản phẩm trong giỏ hàng` |
| Bất kỳ | Lỗi database khi xóa | Trả `500` — `Lỗi hệ thống, vui lòng thử lại` |

**Ghi chú:**
- Ownership check là bắt buộc để bảo mật
- Xóa item không ảnh hưởng đến bản ghi Cart
- Lean response trả về số lượng items còn lại

---

### UC-05: Xóa toàn bộ giỏ hàng

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Xóa tất cả items trong giỏ hàng (giải phóng giỏ) |
| **Tiền điều kiện** | Customer đã đăng nhập và có giỏ hàng |
| **Hậu điều kiện** | Tất cả CartItems bị xóa; bản ghi Cart vẫn tồn tại |
| **Trigger** | Customer nhấn "Xóa tất cả" trong trang giỏ hàng HOẶC hệ thống tự động clear sau khi đặt hàng thành công |

**Luồng chính (Happy Path):**

1. Customer (hoặc Order System) gửi request `DELETE /api/cart`
2. Hệ thống lấy Cart theo `userId` từ JWT token
3. Hệ thống xóa tất cả CartItems thuộc cart này (`deleteMany`)
4. Hệ thống **GIỮ LẠI** bản ghi Cart (không xóa)
5. Hệ thống trả về `200` + `{ message: 'Đã xóa toàn bộ giỏ hàng' }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Giỏ không tồn tại | Trả `404` — `Giỏ hàng không tồn tại` |
| 3 | Lỗi database khi xóa items | Trả `500` — `Lỗi hệ thống, vui lòng thử lại` |

**Ghi chú:**
- Clear cart KHÔNG xóa bản ghi Cart — chỉ xóa CartItems
- Giữ Cart giúp dễ dàng khôi phục hoặc thêm items sau này
- Clear cart thường được gọi bởi Order System sau khi đặt hàng thành công

---

## 4. Mối quan hệ giữa Use Cases

```
UC-01 (Xem giỏ) ──────────────────────► Auto-upsert cart nếu chưa có
     │
     ├──────────────────────────────► Hiển thị đầy đủ info (variant + product + ảnh)
     │
     ▼
UC-02 (Thêm item) ──────────────────► Tạo cart nếu chưa có
     │                                 Cộng dồn quantity nếu đã có
     │                                 Kiểm tra stock
     │
     ├──────────────────────────────► Lean response update badge
     │
     ▼
UC-03 (Cập nhật số lượng) ───────────► Ownership check
     │                                 Kiểm tra stock
     │
     ├──────────────────────────────► Lean response update badge
     │
     ▼
UC-04 (Xóa item) ───────────────────► Ownership check
     │                                 Xóa item cụ thể
     │
     ├──────────────────────────────► Lean response update badge
     │
     ▼
UC-05 (Xóa toàn bộ) ─────────────────► Xóa tất cả CartItems
                                       GIỮ LẠI bản ghi Cart
```

---

## 5. Use Case Diagram

```
┌─────────────────┐
│   Customer      │
│  (CUSTOMER)     │
└────────┬────────┘
         │
         │ uses
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cart System                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  UC-01:      │  │  UC-02:      │  │  UC-03:      │          │
│  │  Xem giỏ     │  │  Thêm item   │  │  Cập nhật    │          │
│  │  hàng        │  │  vào giỏ     │  │  số lượng    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │  UC-04:      │  │  UC-05:      │                          │
│  │  Xóa item    │  │  Xóa toàn    │                          │
│  │  khỏi giỏ    │  │  bộ giỏ      │                          │
│  └──────────────┘  └──────────────┘                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         │                                  ▲
         │ extends                          │
         ▼                                  │
┌─────────────────┐               ┌──────────────────┐
│ Product Service │               │   Order System    │
│  (kiểm tra      │               │  (clear cart      │
│   variant,      │               │   sau khi đặt)    │
│   stock)        │               └──────────────────┘
└─────────────────┘
```

---

## 6. Business Rules

### BR-01: Sở hữu giỏ hàng
- Mỗi customer có đúng 1 giỏ hàng (1:1)
- Customer chỉ có thể truy cập/sửa giỏ hàng của chính mình
- Mọi operation phải kiểm tra ownership (`cartId === user.cartId`)

### BR-02: Quản lý số lượng
- Quantity range: 1–100 cho mỗi item
- Thêm item đã có → cộng dồn quantity (không thay thế)
- Cập nhật quantity → thay thế trực tiếp (không cộng dồn)
- Tổng quantity (sau cộng) không được vượt quá stock

### BR-03: Kiểm tra tồn kho
- Stock được kiểm tra tại thời điểm thêm/sửa
- Không lock stock cho đến khi đặt hàng
- Nếu quantity > stock → từ chối và hiển thị số lượng còn lại
- Item đã thêm trong giỏ có thể hết hàng sau đó → sẽ bị chặn khi đặt hàng

### BR-04: Auto-upsert giỏ hàng
- Giỏ hàng tự động tạo khi customer GET hoặc thêm item lần đầu
- Không cần bước tạo giỏ hàng riêng
- Giỏ hàng không bao giờ bị xóa (chỉ xóa CartItems)

### BR-05: Cộng dồn quantity
- Khi thêm item đã tồn tại → cộng dồn vào quantity hiện tại
- Unique constraint `(cartId, variantId)` đảm bảo không trùng lặp
- Race condition được xử lý bởi database constraint

### BR-06: Ownership check
- Mọi operation trên item phải kiểm tra item thuộc về cart của user
- Ngăn chặn việc user sửa/xóa item của user khác
- Return `404` thay vì `403` để tránh lộ thông tin

### BR-07: Lean vs Full response
- GET /cart → Full response (variant + product + ảnh)
- POST/PUT/DELETE → Lean response `{ cartId, itemCount }`
- Lean response giúp update badge nhanh mà không reload toàn bộ giỏ

### BR-08: Xóa giỏ hàng
- Clear cart chỉ xóa CartItems, không xóa bản ghi Cart
- Cho phép khôi phục hoặc thêm lại items sau này
- Clear cart được gọi tự động sau khi đặt hàng thành công

---

## 7. Preconditions & Postconditions

### UC-01: Xem giỏ hàng

**Preconditions:**
- Customer đã đăng nhập và có JWT token hợp lệ
- User tồn tại trong database

**Postconditions:**
- Giỏ hàng được tạo nếu chưa có
- Danh sách items được hiển thị đầy đủ
- UI hiển thị thông tin sản phẩm chi tiết

### UC-02: Thêm sản phẩm vào giỏ

**Preconditions:**
- Customer đã đăng nhập
- Variant tồn tại và `isActive = true`
- Quantity trong range 1–100

**Postconditions:**
- Item được thêm hoặc quantity được cộng dồn
- Badge trên UI được cập nhật
- Stock không bị thay đổi (chỉ kiểm tra)

### UC-03: Cập nhật số lượng

**Preconditions:**
- Customer đã đăng nhập
- Item tồn tại và thuộc giỏ của user
- Quantity mới trong range 1–100

**Postconditions:**
- Quantity của item được cập nhật
- Badge trên UI được cập nhật

### UC-04: Xóa item

**Preconditions:**
- Customer đã đăng nhập
- Item tồn tại và thuộc giỏ của user

**Postconditions:**
- Item bị xóa khỏi database
- Badge trên UI được cập nhật
- Các items khác không bị ảnh hưởng

### UC-05: Xóa toàn bộ giỏ

**Preconditions:**
- Customer đã đăng nhập
- Giỏ hàng tồn tại

**Postconditions:**
- Tất cả CartItems bị xóa
- Bản ghi Cart vẫn tồn tại
- Badge hiển thị 0

---

## 8. Error Handling Summary

| HTTP Code | Khi nào dùng | Message mẫu |
|---|---|---|
| `200` | Thành công (GET, PUT, DELETE) | — |
| `201` | Tạo thành công (POST) | — |
| `400` | Validation error | `Số lượng phải là số nguyên từ 1 đến 100` |
| `400` | Stock không đủ | `Sản phẩm không đủ hàng (còn 5)` |
| `400` | Variant inactive | `Sản phẩm không tồn tại hoặc đã ngừng bán` |
| `401` | Không xác thực | `Token không hợp lệ hoặc đã hết hạn` |
| `404` | Không tìm thấy (cart, item, variant) | `Không tìm thấy sản phẩm trong giỏ hàng` |
| `500` | Lỗi hệ thống | `Lỗi hệ thống, vui lòng thử lại` |

---

## 9. Special Requirements

### NFR-01: Hiệu năng
- Thêm sản phẩm: < 200ms (p95)
- Cập nhật số lượng: < 150ms (p95)
- Xóa item/giỏ: < 100ms (p95)
- Xem giỏ hàng: < 300ms (p95)
- Lean summary: < 50ms (p95)

### NFR-02: Bảo mật
- Tất cả endpoints yêu cầu JWT token (CUSTOMER+)
- Ownership check cho mọi operation
- Không leak thông qua error messages (404 thay vì 403)

### NFR-03: Khả năng mở rộng
- Tối đa 100 items/giỏ
- Tối đa 100 quantity/item
- Hỗ trợ 100+ concurrent users

---

## 10. Appendix

### 10.1 Terminology

| Term | Định nghĩa |
|---|---|
| **Cart** | Giỏ hàng — bản ghi 1-1 với user, chứa nhiều CartItems |
| **CartItem** | Mỗi sản phẩm trong giỏ — tham chiếu 1 variant + quantity |
| **Upsert** | Tạo mới nếu chưa có, không làm gì nếu đã tồn tại |
| **Lean summary** | Response gọn nhẹ `{ cartId, itemCount }` — dùng để update badge |
| **Full response** | Response đầy đủ items + variant + product + ảnh bìa |
| **Cộng dồn** | Nếu item đã có trong giỏ → cộng quantity vào (không thay thế) |
| **Badge** | Số lượng items hiển thị trên icon giỏ hàng (UI) |
| **Ownership check** | Kiểm tra item thuộc về cart của user hiện tại |

### 10.2 Related Documents

| Document | Link |
|---|---|
| BRD - Business Requirements | [BRD.md](./BRD.md) |
| SRS - Software Requirements | [SRS.md](./SRS.md) |
| API Specification | [APISpec.md](./APISpec.md) |
| Activity Diagram | [ActivityDiagram.md](./ActivityDiagram.md) |
| Sequence Diagram | [SequenceDiagram.md](./SequenceDiagram.md) |
| ERD | [ERD.md](./ERD.md) |
| Test Cases | [TestCase.md](./TestCase.md) |

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-20  
> **Next Review:** After implementation complete  
> **Author:** Workflow Architect (generated from BRD & SRS)
