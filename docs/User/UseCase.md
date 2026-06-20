# Use Case Document
## Module: User
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Authenticated User** | Người dùng đã đăng nhập (Customer / Staff / Admin) — actor duy nhất của module này |
| **Cloudinary** | Hệ thống lưu trữ ảnh bên ngoài |

---

## 2. Danh sách Use Case

| ID | Tên | Độ ưu tiên |
|---|---|---|
| UC-01 | Xem hồ sơ cá nhân | Cao |
| UC-02 | Cập nhật hồ sơ | Cao |
| UC-03 | Đổi mật khẩu | Cao |
| UC-04 | Upload ảnh đại diện | Trung bình |
| UC-05 | Xem danh sách địa chỉ | Cao |
| UC-06 | Thêm địa chỉ mới | Cao |
| UC-07 | Cập nhật địa chỉ | Trung bình |
| UC-08 | Xóa địa chỉ | Trung bình |
| UC-09 | Đặt địa chỉ mặc định | Cao |

---

## 3. Chi tiết Use Case

---

### UC-01: Xem hồ sơ cá nhân

| | |
|---|---|
| **Actor** | Authenticated User |
| **Mục tiêu** | Xem thông tin tài khoản hiện tại |
| **Tiền điều kiện** | Đã đăng nhập (có Access Token hợp lệ) |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. User gửi `GET /api/users/me` với Bearer Token
2. Middleware xác thực token → lấy `userId`
3. Hệ thống query User theo `userId`
4. Trả về thông tin user (không có password, không có token nhạy cảm)

---

### UC-02: Cập nhật hồ sơ

| | |
|---|---|
| **Actor** | Authenticated User |
| **Mục tiêu** | Đổi tên hiển thị và/hoặc số điện thoại |
| **Tiền điều kiện** | Đã đăng nhập |
| **Hậu điều kiện** | DB cập nhật `fullName` và/hoặc `phone` |

**Luồng chính:**
1. User gửi `PUT /api/users/me` với `{ fullName?, phone? }`
2. Validate: ít nhất 1 trường; fullName ≥ 2 ký tự; phone đúng định dạng VN
3. Nếu có `phone` (không rỗng): kiểm tra unique trừ chính user
4. Cập nhật DB — chỉ các trường được gửi
5. Trả về `200` + user profile mới

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Không gửi trường nào | `400` — `Vui lòng cung cấp ít nhất một trường cần cập nhật` |
| 2 | fullName < 2 ký tự | `400` — `Họ tên phải có ít nhất 2 ký tự` |
| 2 | Phone sai định dạng | `400` — `Số điện thoại không hợp lệ` |
| 3 | Phone trùng với user khác | `409` — `Số điện thoại đã được sử dụng` |

---

### UC-03: Đổi mật khẩu

| | |
|---|---|
| **Actor** | Authenticated User |
| **Mục tiêu** | Đổi mật khẩu đăng nhập |
| **Tiền điều kiện** | Đã đăng nhập; tài khoản dùng password (không phải OAuth) |
| **Hậu điều kiện** | `passwordHash` được cập nhật; phiên hiện tại **không** bị thu hồi |

**Luồng chính:**
1. User gửi `PUT /api/users/me/password` với `{ currentPassword, newPassword }`
2. Validate: `currentPassword` có mặt; `newPassword` ≥ 8 ký tự; hai cái khác nhau
3. Lấy user từ DB, kiểm tra có `passwordHash`
4. `bcrypt.compare(currentPassword, passwordHash)` — phải đúng
5. `bcrypt.hash(newPassword, 12)`
6. Update DB
7. Trả về `200`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Thiếu `currentPassword` | `400` |
| 2 | `newPassword` < 8 ký tự | `400` |
| 2 | `newPassword === currentPassword` | `400` — `Mật khẩu mới phải khác mật khẩu hiện tại` |
| 3 | User không có `passwordHash` | `400` — `Tài khoản không dùng mật khẩu` |
| 4 | `currentPassword` sai | `400` — `Mật khẩu hiện tại không đúng` |

---

### UC-04: Upload ảnh đại diện

| | |
|---|---|
| **Actor** | Authenticated User |
| **Mục tiêu** | Cập nhật ảnh đại diện |
| **Tiền điều kiện** | Đã đăng nhập; có file ảnh hợp lệ |
| **Hậu điều kiện** | `avatarUrl` được cập nhật; ảnh cũ trên Cloudinary bị ghi đè |

**Luồng chính:**
1. User upload file qua `POST /api/users/me/avatar` field `avatar`
2. Multer kiểm tra: định dạng, kích thước ≤ 5MB
3. Cloudinary upload với `public_id = user_{userId}`, `overwrite = true`, crop 400×400 gravity face
4. Update `avatarUrl` + `avatarPublicId` trong DB
5. Trả về `200` + `{ avatarUrl, avatarPublicId }`

**Đặc điểm:** Vì `public_id` cố định + overwrite, ảnh cũ luôn bị thay thế tại chỗ mà không cần gọi `destroyImage` thủ công.

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Không có file | `400` |
| 2 | Sai định dạng | `400` |
| 2 | File > 5MB | `400` |
| Rate limit | Vượt 10 uploads/giờ | `429` |

---

### UC-05: Xem danh sách địa chỉ

| | |
|---|---|
| **Actor** | Authenticated User |
| **Mục tiêu** | Xem tất cả địa chỉ giao hàng đã lưu |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/users/me/addresses`
2. Query DB theo `userId`, sort `isDefault DESC, createdAt DESC`
3. Trả về mảng địa chỉ (địa chỉ mặc định đứng đầu)

---

### UC-06: Thêm địa chỉ mới

| | |
|---|---|
| **Actor** | Authenticated User |
| **Mục tiêu** | Lưu địa chỉ giao hàng mới |
| **Tiền điều kiện** | Đã đăng nhập |
| **Hậu điều kiện** | Địa chỉ mới được tạo; nếu có `isDefault=true` thì địa chỉ cũ bị unset |

**Luồng chính:**
1. `POST /api/users/me/addresses` với đầy đủ thông tin địa chỉ
2. Validate tất cả trường bắt buộc
3. Kiểm tra user đã có địa chỉ nào chưa
4. **Nếu chưa có địa chỉ nào** → `isDefault = true` tự động
5. **Nếu đã có + gửi `isDefault = true`** → Transaction: unset all defaults → create mới với `isDefault = true`
6. **Nếu đã có + không gửi `isDefault`** → create với `isDefault = false`
7. Trả về `201` + địa chỉ mới

---

### UC-07: Cập nhật địa chỉ

| | |
|---|---|
| **Actor** | Authenticated User |
| **Mục tiêu** | Sửa thông tin địa chỉ đã có |
| **Tiền điều kiện** | Địa chỉ thuộc về user |
| **Hậu điều kiện** | Địa chỉ được cập nhật |

**Luồng chính:**
1. `PUT /api/users/me/addresses/:id`
2. Kiểm tra ownership — `address.userId === userId`
3. Validate
4. Nếu `isDefault = true` và địa chỉ chưa là mặc định → Transaction: unset old + update
5. Nếu `isDefault = true` và đã là mặc định → chỉ update các trường khác (không cần transaction)
6. Trả về `200` + địa chỉ đã cập nhật

---

### UC-08: Xóa địa chỉ

| | |
|---|---|
| **Actor** | Authenticated User |
| **Mục tiêu** | Xóa địa chỉ không còn dùng |
| **Tiền điều kiện** | Địa chỉ thuộc về user |
| **Hậu điều kiện** | Địa chỉ bị xóa; nếu là mặc định thì địa chỉ kế tiếp tự thành mặc định |

**Luồng chính:**
1. `DELETE /api/users/me/addresses/:id`
2. Kiểm tra ownership
3. Xóa địa chỉ
4. **Nếu địa chỉ vừa xóa là mặc định:**
   - Tìm địa chỉ mới nhất còn lại (`createdAt DESC`)
   - Nếu tìm thấy → set `isDefault = true`
5. Trả về `204 No Content`

---

### UC-09: Đặt địa chỉ mặc định

| | |
|---|---|
| **Actor** | Authenticated User |
| **Mục tiêu** | Chọn địa chỉ để tự động điền khi thanh toán |
| **Tiền điều kiện** | Địa chỉ thuộc về user |
| **Hậu điều kiện** | Đúng 1 địa chỉ có `isDefault = true` |

**Luồng chính:**
1. `PATCH /api/users/me/addresses/:id/default`
2. Kiểm tra ownership
3. Nếu đã là mặc định → return ngay (idempotent, không transaction)
4. Transaction: unset all defaults → set địa chỉ này
5. Trả về `200`

---

## 4. Quan hệ giữa Use Cases

```
[UC-01] Xem hồ sơ ─── không phụ thuộc

[UC-02] Sửa hồ sơ ─── không ảnh hưởng UC khác
[UC-03] Đổi password ─ không revoke session (khác với Auth/reset-password)
[UC-04] Upload avatar ─ không ảnh hưởng UC khác

[UC-05] Xem địa chỉ ─ đọc kết quả của UC-06/07/08/09

[UC-06] Thêm địa chỉ ──┐
[UC-07] Sửa địa chỉ ──┤─ đều có thể trigger unset default cũ
[UC-09] Set default ───┘

[UC-08] Xóa địa chỉ ───── nếu xóa default → trigger tự động kế thừa
```
