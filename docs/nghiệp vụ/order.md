# Nghiệp vụ Order (Đơn hàng) — Mobivexa

> **Phạm vi:** `src/services/order.service.ts`, `src/controllers/order.controller.ts`, `src/routes/order.route.ts`, `src/validators/order.validator.ts`
>
> **Cập nhật:** 2026-06-19

---

## 1. Tổng quan

Module Order quản lý toàn bộ vòng đời của đơn hàng — từ khi khách đặt đến khi giao thành công hoặc hủy. Có 2 nhóm actor:

- **Customer** (`/api/orders`): Đặt hàng, xem đơn, hủy đơn của mình
- **Admin** (`/api/admin/orders`): Xem tất cả đơn, cập nhật trạng thái, đối soát thanh toán

---

## 2. Danh sách endpoint

### Customer (`/api/orders`)

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `POST` | `/api/orders` | Đặt hàng | ✅ |
| `GET` | `/api/orders` | Danh sách đơn của tôi | ✅ |
| `GET` | `/api/orders/:id` | Chi tiết đơn hàng của tôi | ✅ |
| `PATCH` | `/api/orders/:id/cancel` | Hủy đơn hàng | ✅ |

### Admin (`/api/admin/orders`)

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/api/admin/orders` | Danh sách tất cả đơn hàng | ✅ STAFF+ |
| `GET` | `/api/admin/orders/:id` | Chi tiết đơn hàng bất kỳ | ✅ STAFF+ |
| `PATCH` | `/api/admin/orders/:id/status` | Cập nhật trạng thái đơn | ✅ STAFF+ |
| `PATCH` | `/api/admin/orders/:id/payment` | Cập nhật trạng thái thanh toán | ✅ STAFF+ |

---

## 3. Enum & Trạng thái

### 3.1 Trạng thái đơn hàng (`OrderStatus`)

| Giá trị | Ý nghĩa |
|---|---|
| `PENDING` | Chờ xác nhận |
| `CONFIRMED` | Đã xác nhận |
| `SHIPPING` | Đang giao hàng |
| `DELIVERED` | Đã giao thành công |
| `CANCELLED` | Đã hủy |

### 3.2 Trạng thái thanh toán (`PaymentStatus`)

| Giá trị | Ý nghĩa |
|---|---|
| `UNPAID` | Chưa thanh toán |
| `PAID` | Đã thanh toán |
| `REFUNDED` | Đã hoàn tiền |

### 3.3 Phương thức thanh toán (`PaymentMethod`)

| Giá trị | Ý nghĩa |
|---|---|
| `COD` | Thanh toán khi nhận hàng |
| `BANK_TRANSFER` | Chuyển khoản ngân hàng (VietQR + SePay webhook) |

---

## 4. Luồng chuyển trạng thái đơn hàng

Đây là **nguồn sự thật duy nhất** về các chuyển trạng thái được phép:

```
PENDING ──────► CONFIRMED ──────► SHIPPING ──────► DELIVERED
   │                │                  │
   └──────────────────────────────────► CANCELLED
```

| Từ trạng thái | Được phép chuyển sang |
|---|---|
| `PENDING` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `SHIPPING`, `CANCELLED` |
| `SHIPPING` | `DELIVERED`, `CANCELLED` |
| `DELIVERED` | *(không được chuyển)* |
| `CANCELLED` | *(không được chuyển)* |

**Lưu ý:** `DELIVERED` và `CANCELLED` là trạng thái cuối — không thể chuyển tiếp.

---

## 5. Chính sách & Ràng buộc nghiệp vụ

### 5.1 Đặt hàng

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| `addressId` | ✅ | Phải tồn tại và thuộc về user |
| `paymentMethod` | ❌ | Mặc định `COD`; phải là `COD` hoặc `BANK_TRANSFER` |
| `note` | ❌ | Ghi chú tùy chọn |
| `items` | ❌ | Nếu không gửi → **tự động lấy từ giỏ hàng** |

**Nguồn items:**
- Truyền `items` trực tiếp → dùng items đó (mua ngay, không qua giỏ)
- Không truyền `items` → lấy từ `Cart` của user (đặt từ giỏ hàng)
- Giỏ hàng trống → lỗi `400`

**Thông tin lưu snapshot vào đơn hàng:**
- Tên sản phẩm, SKU, màu, bộ nhớ, RAM → snapshot tại thời điểm đặt (không bị ảnh hưởng nếu sản phẩm thay đổi sau)
- Giá lưu là `salePrice` tại thời điểm đặt (`unitPrice`)
- `subtotal` = tổng `unitPrice × quantity` của từng item
- `shippingFee` = 0 (miễn phí vận chuyển — hiện tại)
- `discount` = 0 (chưa có coupon)
- `total` = `subtotal + shippingFee - discount`

**Atomic stock check-and-decrement:**
- Dùng `updateMany` với điều kiện `WHERE stock >= quantity` trong transaction
- Nếu `count === 0` → stock vừa bị lấy bởi request song song → **rollback toàn bộ transaction**
- Không check stock trước transaction để tránh race condition (TOCTOU)

**Sau đặt hàng thành công từ giỏ:** `CartItem` bị xóa toàn bộ trong cùng transaction.

### 5.2 Mã đơn hàng (`orderCode`)

Format: `ORD-{YYYYMMDD}-{6 ký tự hex ngẫu nhiên viết hoa}`

Ví dụ: `ORD-20240619-A3F9C2`

Dùng làm nội dung chuyển khoản khi thanh toán `BANK_TRANSFER`.

### 5.3 Hủy đơn (Customer)

- Chỉ được hủy nếu trạng thái hiện tại thuộc `VALID_TRANSITIONS` cho phép chuyển sang `CANCELLED`
  - ✅ `PENDING` → có thể hủy
  - ✅ `CONFIRMED` → có thể hủy
  - ✅ `SHIPPING` → có thể hủy
  - ❌ `DELIVERED` → không thể hủy
  - ❌ `CANCELLED` → không thể hủy (đã hủy)
- `cancelReason` mặc định là `"Khách hàng hủy đơn"` nếu không gửi lý do
- Khi hủy → **hoàn trả stock** cho tất cả items trong transaction

### 5.4 Cập nhật trạng thái (Admin)

- Phải theo đúng `VALID_TRANSITIONS` — không được nhảy cách (ví dụ: `PENDING → DELIVERED` bị từ chối)
- Khi admin hủy đơn (`CANCELLED`): phải gửi `cancelReason` (bắt buộc)
- Khi hủy → **hoàn trả stock** trong transaction (giống customer cancel)
- Các chuyển trạng thái khác (không phải CANCELLED) → cập nhật thẳng, không cần transaction phức tạp

### 5.5 Cập nhật thanh toán (Admin)

- Admin có thể thay đổi `paymentStatus` bất kỳ (`UNPAID` / `PAID` / `REFUNDED`) — không có ràng buộc state machine cho thanh toán
- Dùng để đối soát thủ công hoặc ghi nhận hoàn tiền

---

## 6. Luồng nghiệp vụ chi tiết

### 6.1 Đặt hàng

```
POST /api/orders → [authenticate] → [validate] → createOrder → DB Transaction → Response 201
```

**Happy Path:**
1. Validate: `addressId` bắt buộc; `paymentMethod` hợp lệ nếu gửi; `items[]` hợp lệ nếu gửi
2. **Song song:** resolve items (từ body hoặc giỏ hàng) + kiểm tra địa chỉ thuộc user
3. Lấy thông tin tất cả variants (name, sku, màu, giá...)
4. Kiểm tra từng variant: tồn tại + `isActive = true`
5. Tính toán giá: `unitPrice`, `subtotal` từng item, `total` toàn đơn
6. Sinh `orderCode` ngẫu nhiên
7. **DB Transaction:**
   - Tạo Order + OrderItems (snapshot toàn bộ thông tin)
   - Atomic decrement stock: `WHERE stock >= quantity` → rollback nếu `count === 0`
   - Xóa CartItems (nếu đặt từ giỏ hàng)
8. Trả về `201` + đơn hàng đầy đủ

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Thiếu `addressId` | 400 | `Vui lòng chọn địa chỉ giao hàng` |
| `paymentMethod` không hợp lệ | 400 | `Phương thức thanh toán không hợp lệ` |
| `items` là mảng rỗng | 400 | `Danh sách sản phẩm không hợp lệ` |
| `variantId` không hợp lệ | 400 | `variantId không hợp lệ` |
| Địa chỉ không tồn tại / không thuộc user | 404 | `Địa chỉ không tồn tại` |
| Giỏ hàng trống (đặt từ giỏ) | 400 | `Giỏ hàng trống, không thể đặt hàng` |
| Variant không tồn tại | 400 | `Sản phẩm không tồn tại: {variantId}` |
| Variant `isActive = false` | 400 | `Sản phẩm đã ngừng bán: {sku}` |
| Hết hàng (race condition trong tx) | 400 | `Sản phẩm "{sku}" không đủ hàng` |

---

### 6.2 Danh sách đơn của tôi (Customer)

```
GET /api/orders?[params] → [authenticate] → listMyOrders(userId, query)
```

| Param | Mô tả |
|---|---|
| `page` | Trang (default: 1) |
| `limit` | Số đơn/trang (default: 10) |
| `status` | Lọc theo `OrderStatus` |

- Chỉ trả về đơn của user đang đăng nhập
- Sắp xếp: `createdAt DESC` (mới nhất trước)

---

### 6.3 Chi tiết đơn hàng của tôi (Customer)

```
GET /api/orders/:id → [authenticate] → getMyOrder(userId, orderId)
```

- Kiểm tra `order.userId === req.user.userId` ở tầng DB (`findFirst WHERE id AND userId`)
- Trả `404` nếu đơn không tồn tại **hoặc** không thuộc về user — cùng 1 thông báo (tránh enumeration)

---

### 6.4 Hủy đơn (Customer)

```
PATCH /api/orders/:id/cancel → [authenticate] → cancelMyOrder → DB Transaction → Response
```

1. Tìm đơn thuộc user — `404` nếu không có
2. Kiểm tra trạng thái có được phép hủy không
3. **DB Transaction:**
   - Cập nhật `status = CANCELLED`, `cancelReason`
   - Hoàn trả `stock` cho từng item (`increment`)
4. Trả về `200` + đơn hàng đã hủy

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Đơn không tồn tại / không thuộc user | 404 | `Đơn hàng không tồn tại` |
| Trạng thái không cho phép hủy | 400 | `Không thể hủy đơn hàng ở trạng thái hiện tại` |

---

### 6.5 Danh sách đơn hàng (Admin)

```
GET /api/admin/orders?[params] → [authenticate] → [authorize STAFF+] → listOrders(query)
```

**Filter Admin:**

| Param | Mô tả |
|---|---|
| `page`, `limit` | Phân trang |
| `status` | Lọc theo `OrderStatus` |
| `userId` | Lọc theo user cụ thể |
| `paymentMethod` | `COD` / `BANK_TRANSFER` |
| `paymentStatus` | `UNPAID` / `PAID` / `REFUNDED` |
| `from` | Từ ngày (ISO date) |
| `to` | Đến ngày (ISO date) |

**Tối ưu response:** Admin list chỉ trả `_count.items` (số lượng item) thay vì toàn bộ `items[]` chi tiết → giảm data transfer. Kèm thông tin user (`id`, `fullName`, `email`).

---

### 6.6 Cập nhật trạng thái đơn (Admin)

```
PATCH /api/admin/orders/:id/status → [authenticate] → [authorize STAFF+] → [validate] → updateOrderStatus
```

1. Validate: `status` phải là giá trị hợp lệ của `OrderStatus`; nếu `status = CANCELLED` → `cancelReason` bắt buộc
2. Tìm đơn hàng — `404` nếu không có
3. Kiểm tra chuyển trạng thái hợp lệ theo `VALID_TRANSITIONS`
4. Nếu `status ≠ CANCELLED` → update thẳng
5. Nếu `status = CANCELLED` → **DB Transaction:** update status + hoàn stock

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `status` không hợp lệ | 400 | `Trạng thái đơn hàng không hợp lệ` |
| Hủy mà thiếu `cancelReason` | 400 | `Vui lòng nhập lý do hủy đơn` |
| Chuyển trạng thái không được phép | 400 | `Không thể chuyển từ "{from}" sang "{to}"` |
| Đơn không tồn tại | 404 | `Đơn hàng không tồn tại` |

---

### 6.7 Cập nhật thanh toán (Admin)

```
PATCH /api/admin/orders/:id/payment → [authenticate] → [authorize STAFF+] → [validate] → updatePaymentStatus
```

1. Validate: `paymentStatus` là `UNPAID` / `PAID` / `REFUNDED`
2. Tìm đơn (lean check, không load items)
3. Cập nhật `paymentStatus`
4. Trả về `200` + đơn hàng cập nhật

---

## 7. Bảng dữ liệu

### Bảng `Order`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `orderCode` | string | Unique; format `ORD-YYYYMMDD-XXXXXX` |
| `userId` | string | FK → User |
| `status` | OrderStatus | Trạng thái đơn; mặc định `PENDING` |
| `paymentMethod` | PaymentMethod | `COD` / `BANK_TRANSFER` |
| `paymentStatus` | PaymentStatus | Mặc định `UNPAID` |
| `paidAt` | DateTime? | Thời điểm thanh toán (set bởi SePay webhook) |
| `subtotal` | Decimal | Tổng tiền hàng |
| `shippingFee` | Decimal | Phí vận chuyển (hiện tại = 0) |
| `discount` | Decimal | Giảm giá (hiện tại = 0) |
| `total` | Decimal | `subtotal + shippingFee - discount` |
| `shippingName` | string | Snapshot tên người nhận |
| `shippingPhone` | string | Snapshot SĐT |
| `shippingProvince` | string | Snapshot tỉnh/thành |
| `shippingDistrict` | string | Snapshot quận/huyện |
| `shippingWard` | string | Snapshot phường/xã |
| `shippingDetail` | string | Snapshot địa chỉ chi tiết |
| `note` | string? | Ghi chú của khách |
| `cancelReason` | string? | Lý do hủy |

### Bảng `OrderItem`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `orderId` | string | FK → Order |
| `variantId` | string? | FK → ProductVariant (nullable — đề phòng variant bị xóa) |
| `productName` | string | **Snapshot** tên sản phẩm |
| `sku` | string | **Snapshot** SKU |
| `color` | string? | **Snapshot** màu sắc |
| `storage` | string? | **Snapshot** bộ nhớ |
| `ram` | string? | **Snapshot** RAM |
| `unitPrice` | Decimal | **Snapshot** giá bán tại thời điểm đặt |
| `quantity` | int | Số lượng |
| `subtotal` | Decimal | `unitPrice × quantity` |

---

## 8. Điểm thiết kế quan trọng

| # | Thiết kế | Lý do |
|---|---|---|
| 1 | **Snapshot thông tin** vào OrderItem | Sản phẩm/giá thay đổi sau đó không ảnh hưởng đơn cũ |
| 2 | **Atomic check-and-decrement** stock | Chống race condition khi nhiều user mua cùng lúc |
| 3 | **VALID_TRANSITIONS** là nguồn sự thật | Tập trung logic chuyển trạng thái, dễ sửa, không phân tán |
| 4 | Hoàn stock trong **transaction** khi hủy | Đảm bảo stock được hoàn nguyên hoàn toàn hoặc không hoàn |
| 5 | Clear cart trong **cùng transaction** tạo đơn | Đặt hàng fail → cart không bị xóa |
| 6 | **Ownership check ở DB** (not in-memory) | Tránh fetch đơn hàng rồi mới check `userId` — tiết kiệm 1 round trip |
| 7 | Admin list dùng `_count` thay `items[]` | Không hydrate toàn bộ OrderItem cho listing, giảm data trả về |
| 8 | `paymentStatus` không có state machine | Admin được phép set tự do để xử lý đối soát, hoàn tiền thủ công |
