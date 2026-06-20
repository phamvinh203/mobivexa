# Use Case Document
## Module: Order (Đơn hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [BRD.md](./BRD.md) | [SRS.md](./SRS.md)

---

## 1. Actors

| Actor | Mô tả | Role |
|---|---|---|
| **Customer** | Khách hàng đã đăng nhập | `CUSTOMER` |
| **Staff** | Nhân viên đã đăng nhập | `STAFF` |
| **Admin** | Quản trị viên đã đăng nhập | `ADMIN` |
| **Cart System** | Module giỏ hàng | Hệ thống nội bộ |
| **Product System** | Module sản phẩm | Hệ thống nội bộ |
| **Payment Gateway** | Cổng thanh toán (SePay) | Hệ thống ngoài (future) |

---

## 2. Danh sách Use Case

| ID | Tên Use Case | Actor chính | Độ ưu tiên |
|---|---|---|---|
| UC-01 | Đặt hàng từ giỏ hàng | Customer | Cao |
| UC-02 | Đặt hàng mua ngay (bypass giỏ) | Customer | Trung bình |
| UC-03 | Xem danh sách đơn của tôi | Customer | Cao |
| UC-04 | Xem chi tiết đơn hàng của tôi | Customer | Cao |
| UC-05 | Hủy đơn hàng | Customer | Trung bình |
| UC-06 | Admin xem danh sách tất cả đơn | Staff / Admin | Cao |
| UC-07 | Admin xem chi tiết đơn hàng bất kỳ | Staff / Admin | Cao |
| UC-08 | Admin cập nhật trạng thái đơn hàng | Staff / Admin | Cao |
| UC-09 | Admin cập nhật trạng thái thanh toán | Staff / Admin | Trung bình |

---

## 3. Chi tiết Use Case

---

### UC-01: Đặt hàng từ giỏ hàng

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Tạo đơn hàng từ các sản phẩm trong giỏ |
| **Tiền điều kiện** | Đã đăng nhập, có địa chỉ saved, giỏ không trống |
| **Hậu điều kiện** | Đơn hàng được tạo, stock bị trừ, giỏ bị xóa |
| **Trigger** | Customer click "Đặt hàng" từ trang giỏ |

**Luồng chính (Happy Path):**

1. Customer gọi `POST /api/orders` với `{ addressId }` (không gửi `items`)
2. Hệ thống validate `addressId` bắt buộc
3. Hệ thống lấy CartItems của user
4. Hệ thống validate giỏ không trống
5. Hệ thống resolve tất cả variants từ CartItems
6. Hệ thống validate variants tồn tại + active
7. Hệ thống tính toán: `unitPrice`, `subtotal`, `total`
8. Hệ thống sinh `orderCode`: `ORD-20240619-A3F9C2`
9. Hệ thống begin DB transaction:
   - Tạo Order + OrderItems (snapshot info)
   - Atomic decrement stock: `WHERE stock >= quantity`
   - Xóa CartItems của user
10. Hệ thống commit transaction
11. Hệ thống trả về `201` + order object đầy đủ

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Thiếu addressId | Trả `400` — `Vui lòng chọn địa chỉ giao hàng` |
| 4 | Giỏ hàng trống | Trả `400` — `Giỏ hàng trống, không thể đặt hàng` |
| 6 | Variant không tồn tại | Trả `400` — `Sản phẩm không tồn tại` |
| 6 | Variant inactive | Trả `400` — `Sản phẩm đã ngừng bán` |
| 9 | Stock không đủ (race condition) | Trả `400` — `Sản phẩm không đủ hàng` + rollback |

---

### UC-02: Đặt hàng mua ngay (bypass giỏ)

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Tạo đơn hàng với items trực tiếp (không qua giỏ) |
| **Tiền điều kiện** | Đã đăng nhập, có địa chỉ saved |
| **Hậu điều kiện** | Đơn hàng được tạo, stock bị trừ, giỏ không đổi |
| **Trigger** | Customer click "Mua ngay" từ trang sản phẩm |

**Luồng chính (Happy Path):**

1. Customer gọi `POST /api/orders` với `{ addressId, items: [...] }`
2. Hệ thống validate `addressId` + `items` không rỗng
3. Hệ thống resolve variants từ `items`
4. Hệ thống validate variants tồn tại + active
5. Hệ thống tính toán giá
6. Hệ thống sinh `orderCode`
7. Hệ thống begin DB transaction:
   - Tạo Order + OrderItems
   - Atomic decrement stock
8. Hệ thống commit transaction
9. Hệ thống trả về `201` + order object

**Luồng thay thế:** Giống UC-01, ngoại trừ không xóa CartItems.

---

### UC-03: Xem danh sách đơn của tôi

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Xem danh sách các đơn hàng của chính mình |
| **Tiền điều kiện** | Đã đăng nhập |
| **Hậu điều kiện** | Danh sách hiển thị |
| **Trigger** | Customer truy cập trang "Đơn hàng của tôi" |

**Luồng chính (Happy Path):**

1. Customer gọi `GET /api/orders?page=1&limit=10`
2. Hệ thống lấy `userId` từ JWT token
3. Hệ thống query: `WHERE userId = req.user.userId`
4. Hệ thống apply filter status nếu có
5. Hệ thống sort by `createdAt DESC`
6. Hệ thống paginate
7. Hệ thống trả về `200` + `{ orders, pagination }`

---

### UC-04: Xem chi tiết đơn hàng của tôi

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Xem chi tiết một đơn hàng cụ thể |
| **Tiền điều kiện** | Đã đăng nhập, đơn tồn tại và thuộc về user |
| **Hậu điều kiện** | Chi tiết hiển thị |
| **Trigger** | Customer click vào một đơn từ danh sách |

**Luồng chính (Happy Path):**

1. Customer gọi `GET /api/orders/:id`
2. Hệ thống query: `WHERE id = ? AND userId = req.user.userId`
3. Hệ thống include OrderItems, User, Address snapshot
4. Hệ thống trả về `200` + order object (full detail)

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Không tìm thấy hoặc không thuộc user | Trả `404` — `Đơn hàng không tồn tại` |

---

### UC-05: Hủy đơn hàng

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Hủy đơn hàng (hoàn stock) |
| **Tiền điều kiện** | Đã đăng nhập, đơn ở trạng thái cho phép hủy |
| **Hậu điều kiện** | Đơn bị hủy, stock được hoàn trả |
| **Trigger** | Customer click "Hủy đơn" và confirm |

**Luồng chính (Happy Path):**

1. Customer gọi `PATCH /api/orders/:id/cancel` với `{ cancelReason }` (optional)
2. Hệ thống query: `WHERE id = ? AND userId = req.user.userId`
3. Hệ thống validate trạng thái hiện tại trong `VALID_TRANSITIONS` cho CANCELLED
4. Hệ thống begin DB transaction:
   - Update `status = CANCELLED`, `cancelReason`
   - Hoàn trả stock cho từng item (`increment by quantity`)
5. Hệ thống commit transaction
6. Hệ thống trả về `200` + order object với `status = CANCELLED`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Không tìm thấy hoặc không thuộc user | Trả `404` |
| 3 | Trạng thái không cho phép hủy (DELIVERED, CANCELLED) | Trả `400` — `Không thể hủy đơn hàng ở trạng thái hiện tại` |

---

### UC-06: Admin xem danh sách tất cả đơn

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xem tất cả đơn hàng của hệ thống |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+ |
| **Hậu điều kiện** | Danh sách hiển thị với filter |
| **Trigger** | Admin truy cập trang quản lý đơn hàng |

**Luồng chính (Happy Path):**

1. Admin gọi `GET /api/admin/orders` với JWT token + query params
2. Hệ thống authenticate + authorize STAFF+
3. Hệ thống build where clause theo filters (status, userId, payment, date range)
4. Hệ thống query: include User (`id`, `fullName`, `email`), `_count.items`
5. Hệ thống sort by `createdAt DESC`
6. Hệ thống paginate
7. Hệ thống trả về `200` + `{ orders, pagination }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Token invalid hoặc role không đủ | `401` / `403` |

---

### UC-07: Admin xem chi tiết đơn hàng bất kỳ

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xem chi tiết bất kỳ đơn hàng nào |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, đơn tồn tại |
| **Hậu điều kiện** | Chi tiết hiển thị |
| **Trigger** | Admin click vào một đơn từ danh sách |

**Luồng chính (Happy Path):**

1. Admin gọi `GET /api/admin/orders/:id` với JWT token
2. Hệ thống authenticate + authorize STAFF+
3. Hệ thống find order by ID
4. Hệ thống include đầy đủ: OrderItems, User, Address
5. Hệ thống trả về `200` + order object (full detail)

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 3 | Không tìm thấy | Trả `404` |
| 2 | Token invalid hoặc role không đủ | `401` / `403` |

---

### UC-08: Admin cập nhật trạng thái đơn hàng

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Cập nhật trạng thái đơn hàng theo tiến độ |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, đơn tồn tại |
| **Hậu điều kiện** | Trạng thái được cập nhật, stock hoàn (nếu hủy) |
| **Trigger** | Admin click "Xác nhận" / "Đang giao" / "Hoàn thành" / "Hủy" |

**Luồng chính (Happy Path):**

1. Admin gọi `PATCH /api/admin/orders/:id/status` với `{ status: "CONFIRMED" }`
2. Hệ thống authenticate + authorize STAFF+
3. Hệ thống validate `status` hợp lệ
4. Hệ thống find order by ID
5. Hệ thống validate transition theo `VALID_TRANSITIONS`
6. Nếu `status ≠ CANCELLED`:
   - Hệ thống update status thẳng
7. Nếu `status = CANCELLED`:
   - Hệ thống validate `cancelReason` bắt buộc
   - Hệ thống begin DB transaction:
     - Update `status = CANCELLED`, `cancelReason`
     - Hoàn trả stock cho từng item
8. Hệ thống trả về `200` + order object

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 3 | status không hợp lệ | Trả `400` — `Trạng thái đơn hàng không hợp lệ` |
| 5 | Chuyển trạng thái không được phép | Trả `400` — `Không thể chuyển từ "{from}" sang "{to}"` |
| 7 | Hủy mà thiếu cancelReason | Trả `400` — `Vui lòng nhập lý do hủy đơn` |

---

### UC-09: Admin cập nhật trạng thái thanh toán

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Cập nhật trạng thái thanh toán cho đối soát |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, đơn tồn tại |
| **Hậu điều kiện** | Thanh toán status được cập nhật |
| **Trigger** | Admin click "Đã thanh toán" / "Hoàn tiền" |

**Luồng chính (Happy Path):**

1. Admin gọi `PATCH /api/admin/orders/:id/payment` với `{ paymentStatus: "PAID" }`
2. Hệ thống authenticate + authorize STAFF+
3. Hệ thống validate `paymentStatus` hợp lệ
4. Hệ thống find order (lean check)
5. Hệ thống update `paymentStatus`
6. Nếu `paymentStatus = PAID` → set `paidAt = NOW()`
7. Hệ thống trả về `200` + order object

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 3 | paymentStatus không hợp lệ | Trả `400` — `Trạng thái thanh toán không hợp lệ` |
| 4 | Không tìm thấy | Trả `404` |

---

## 4. Mối quan hệ giữa Use Cases

```
UC-01 (Đặt từ giỏ) ──────────────────────► Tạo đơn + Trừ stock + Xóa giỏ
                                          │
                                          ▼
UC-02 (Mua ngay) ────────────────────────► Tạo đơn + Trừ stock (giỏ không đổi)
                                          │
                                          ▼
UC-03 (Danh sách đơn) ──────────────────► Filter by status
                                          │
                                          ▼
UC-04 (Chi tiết đơn) ────────────────────► Hiển thị snapshot info
                                          │
                                          ├─────────────────────────────► UC-05 (Hủy đơn)
                                          │                               │
                                          │                               └── Hoàn stock
                                          │
                                          ▼
UC-06 (Admin list) ─────────────────────► Filter đa chiều
                                          │
                                          ▼
UC-07 (Admin detail) ───────────────────► Xem chi tiết bất kỳ đơn
                                          │
                                          ├─────────────────────────────► UC-08 (Update status)
                                          │                               │
                                          │                               └── Hoàn stock (nếu hủy)
                                          │
                                          └─────────────────────────────► UC-09 (Update payment)
```

---

## 5. Use Case Matrix

| Use Case | Customer | Staff | Admin | Frequency | Complexity |
|---|---|---|---|---|---|
| UC-01: Đặt từ giỏ | ✅ | — | — | Cao | Cao |
| UC-02: Mua ngay | ✅ | — | — | Trung bình | Cao |
| UC-03: Danh sách đơn | ✅ | — | — | Cao | Thấp |
| UC-04: Chi tiết đơn | ✅ | — | — | Cao | Thấp |
| UC-05: Hủy đơn | ✅ | — | — | Thấp | Trung bình |
| UC-06: Admin list | — | ✅ | ✅ | Cao | Thấp |
| UC-07: Admin detail | — | ✅ | ✅ | Cao | Thấp |
| UC-08: Update status | — | ✅ | ✅ | Cao | Trung bình |
| UC-09: Update payment | — | ✅ | ✅ | Trung bình | Thấp |

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Next Review:** After implementation complete
