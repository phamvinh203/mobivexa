# Use Case Document
## Module: Admin (Quản lý người dùng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Admin** | Role ADMIN — actor duy nhất của toàn bộ module |
| **PostgreSQL** | Cascade xóa dữ liệu liên quan khi User bị xóa |

> STAFF và CUSTOMER không có quyền truy cập.

---

## 2. Danh sách Use Case

| ID | Tên | Ưu tiên |
|---|---|---|
| UC-01 | Xem danh sách người dùng | Cao |
| UC-02 | Xem chi tiết người dùng | Trung bình |
| UC-03 | Thay đổi role người dùng | Cao |
| UC-04 | Khóa / Mở tài khoản | Cao |
| UC-05 | Xóa người dùng | Trung bình |

---

## 3. Chi tiết Use Case

---

### UC-01: Xem danh sách người dùng

| | |
|---|---|
| **Actor** | Admin |
| **Mục tiêu** | Tìm kiếm và xem tổng quan người dùng |
| **Tiền điều kiện** | Đã đăng nhập với role ADMIN |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/admin/users?search=...&role=...&isActive=...`
2. Trim search — rỗng/khoảng trắng = không filter
3. Build `WHERE` từ các params
4. `findMany` ORDER BY `createdAt DESC` với `USER_PUBLIC_SELECT`
5. Trả `{ users, pagination }`

**Bộ lọc kết hợp:**
- `search` → tìm email ILIKE OR fullName ILIKE
- `role` → lọc theo CUSTOMER/STAFF/ADMIN; giá trị không hợp lệ bỏ qua
- `isActive` → lọc true/false; undefined bỏ qua

---

### UC-02: Xem chi tiết người dùng

| | |
|---|---|
| **Actor** | Admin |
| **Mục tiêu** | Xem thông tin đầy đủ của một user |
| **Tiền điều kiện** | Đã đăng nhập ADMIN |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/admin/users/:id`
2. `findUserOrThrow(id)` với `ADMIN_USER_DETAIL_SELECT`
3. Trả user + `_count: { addresses, refreshTokens }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | ID không tồn tại | `404` `Người dùng không tồn tại` |

---

### UC-03: Thay đổi role người dùng

| | |
|---|---|
| **Actor** | Admin |
| **Mục tiêu** | Phân quyền hoặc thu hồi quyền Staff/Admin |
| **Tiền điều kiện** | Đã đăng nhập ADMIN |
| **Hậu điều kiện** | Role người dùng được cập nhật trong DB |

**Luồng chính:**
1. `PATCH /api/admin/users/:id/role { role: "STAFF" }`
2. Validate `role` ∈ {CUSTOMER, STAFF, ADMIN}
3. `assertNotSelf` — admin không tự đổi role mình
4. `assertUserExists` — kiểm tra tồn tại
5. `user.update({ role })` → trả user đã cập nhật

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `role` không hợp lệ | `400` |
| 3 | Admin tự đổi role của mình | `400` `Không thể đổi role của chính mình` |
| 4 | ID không tồn tại | `404` |

---

### UC-04: Khóa / Mở tài khoản

| | |
|---|---|
| **Actor** | Admin |
| **Mục tiêu** | Vô hiệu hóa tài khoản vi phạm hoặc khôi phục |
| **Tiền điều kiện** | Đã đăng nhập ADMIN |
| **Hậu điều kiện** | `isActive` bị toggle |

**Luồng chính:**
1. `PATCH /api/admin/users/:id/status` (không cần body)
2. `assertNotSelf` — admin không tự khóa mình
3. `user.findUnique` — kiểm tra tồn tại
4. `user.update({ isActive: !current.isActive })` → toggle

**Tác động khi khóa:** User không thể đăng nhập (auth middleware kiểm tra `isActive`).

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Admin tự khóa mình | `400` `Không thể khóa tài khoản của chính mình` |
| 3 | ID không tồn tại | `404` |

---

### UC-05: Xóa người dùng

| | |
|---|---|
| **Actor** | Admin |
| **Mục tiêu** | Xóa hoàn toàn tài khoản vi phạm |
| **Tiền điều kiện** | Đã đăng nhập ADMIN |
| **Hậu điều kiện** | User và toàn bộ dữ liệu liên quan bị xóa |

**Luồng chính:**
1. `DELETE /api/admin/users/:id`
2. `assertNotSelf` — admin không tự xóa mình
3. `assertUserExists` — kiểm tra tồn tại
4. `user.delete` → DB cascade xóa: addresses, refreshTokens, favorites, reviews, orders, v.v.

**Không có guard:** xóa không bị chặn bởi số đơn hàng hay số sản phẩm đã mua.

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Admin tự xóa mình | `400` `Không thể xóa tài khoản của chính mình` |
| 3 | ID không tồn tại | `404` |

---

## 4. Guard assertNotSelf — Quan hệ giữa UC

```
UC-03 Đổi role  ──┐
UC-04 Khóa      ──┤── assertNotSelf(actorId, targetId) ──► 400 nếu actorId === targetId
UC-05 Xóa       ──┘

Mục đích:
- Tránh admin vô tình hoặc cố ý lock out chính mình
- Tránh leo thang quyền bằng cách tự set role ADMIN khi đang là STAFF
```

---

## 5. So sánh phân quyền các module

| Module | CUSTOMER | STAFF | ADMIN |
|---|---|---|---|
| Admin (user mgmt) | ❌ | ❌ | ✅ |
| Brand, Category, Tag | ❌ | ✅ | ✅ |
| Banner, Product | ❌ | ✅ | ✅ |
| Order (admin view) | ❌ | ✅ | ✅ |
| Coupon | ❌ | ✅ | ✅ |

Admin module là module DUY NHẤT chỉ dành cho ADMIN, không phải STAFF_ROLES.
