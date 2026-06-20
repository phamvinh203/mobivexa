# SRS — Software Requirement Specification
## Module: User
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Phạm vi

Module User cung cấp API cho người dùng đã đăng nhập tự quản lý:
- Hồ sơ cá nhân (xem, sửa, đổi mật khẩu, ảnh đại diện)
- Danh sách địa chỉ giao hàng (CRUD + set mặc định)

Tất cả endpoint đều yêu cầu Bearer Access Token hợp lệ.

---

## 2. Yêu cầu chức năng

### FR-01: Xem hồ sơ

| | |
|---|---|
| **Endpoint** | `GET /api/users/me` |
| **Auth** | Bearer Token |

**Đầu ra thành công:** `200` + user object

**Select fields:**
```
id, email, phone, fullName, avatarUrl, role, isActive, emailVerified, createdAt, updatedAt
```

> Không bao giờ trả `passwordHash`, `resetPasswordToken`, `avatarPublicId`.

---

### FR-02: Cập nhật hồ sơ

| | |
|---|---|
| **Endpoint** | `PUT /api/users/me` |
| **Auth** | Bearer Token |

**Body (ít nhất 1 trường):**

| Field | Type | Validation |
|---|---|---|
| `fullName` | string | Nếu gửi: ≥ 2 ký tự sau trim |
| `phone` | string | Nếu gửi: regex `/^(0|\+84)[0-9]{8,10}$/`; `""` để xóa |

**Xử lý:**
1. Validate: phải gửi ít nhất 1 trong 2 trường
2. Nếu có `phone` và phone không rỗng: kiểm tra unique (trừ chính user này)
3. Nếu `phone = ""` → lưu `null`
4. Partial update — chỉ cập nhật trường được gửi

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Cả `fullName` và `phone` đều thiếu | 400 | `Vui lòng cung cấp ít nhất một trường cần cập nhật` |
| `fullName` < 2 ký tự | 400 | `Họ tên phải có ít nhất 2 ký tự` |
| `phone` sai định dạng | 400 | `Số điện thoại không hợp lệ` |
| `phone` đã tồn tại ở user khác | 409 | `Số điện thoại đã được sử dụng` |

---

### FR-03: Đổi mật khẩu

| | |
|---|---|
| **Endpoint** | `PUT /api/users/me/password` |
| **Auth** | Bearer Token |

**Body:**

| Field | Type | Required | Validation |
|---|---|---|---|
| `currentPassword` | string | ✅ | Phải nhập |
| `newPassword` | string | ✅ | ≥ 8 ký tự; khác `currentPassword` |

**Xử lý:**
1. Validate đầu vào (validator)
2. Lấy user từ DB; kiểm tra có `passwordHash`
3. `bcrypt.compare(currentPassword, passwordHash)`
4. `bcrypt.hash(newPassword, 12)`
5. Update `passwordHash` trong DB

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Thiếu `currentPassword` | 400 | `Vui lòng nhập mật khẩu hiện tại` |
| `newPassword` < 8 ký tự | 400 | `Mật khẩu mới phải có ít nhất 8 ký tự` |
| `newPassword === currentPassword` | 400 | `Mật khẩu mới phải khác mật khẩu hiện tại` |
| `currentPassword` sai | 400 | `Mật khẩu hiện tại không đúng` |
| Tài khoản không dùng password | 400 | `Tài khoản không dùng mật khẩu` |

---

### FR-04: Upload ảnh đại diện

| | |
|---|---|
| **Endpoint** | `POST /api/users/me/avatar` |
| **Auth** | Bearer Token |
| **Content-Type** | `multipart/form-data` |
| **Rate Limit** | 10 uploads / giờ / IP |

**Body:** file field `avatar`

**Ràng buộc file:**

| | |
|---|---|
| Định dạng | JPEG, JPG, PNG, WebP |
| Kích thước | ≤ 5 MB |
| Field name | `avatar` |

**Xử lý Cloudinary:**
- `folder`: `users/avatars`
- `public_id`: `user_{userId}` (cố định)
- `overwrite`: `true` (luôn ghi đè, không tạo file mới)
- `transformation`: `width=400, height=400, crop=fill, gravity=face`
- `format`: `png` nếu MIME là `image/png`, ngược lại `webp`

**Đầu ra:** `200` + `{ avatarUrl, avatarPublicId }`

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không gửi file | 400 | `Không có file ảnh` |
| Sai định dạng | 400 | `Chỉ chấp nhận file ảnh (jpg, png, webp)` |
| File > 5MB | 400 | `Kích thước file tối đa là 5MB` |
| Vượt rate limit | 429 | `Quá nhiều lần upload ảnh, vui lòng thử lại sau 1 giờ` |

---

### FR-05: Xem danh sách địa chỉ

| | |
|---|---|
| **Endpoint** | `GET /api/users/me/addresses` |
| **Auth** | Bearer Token |

**Đầu ra:** `200` + mảng địa chỉ, sắp theo `isDefault DESC, createdAt DESC` (mặc định luôn đứng đầu)

---

### FR-06: Thêm địa chỉ

| | |
|---|---|
| **Endpoint** | `POST /api/users/me/addresses` |
| **Auth** | Bearer Token |

**Body:**

| Field | Type | Required | Validation |
|---|---|---|---|
| `fullName` | string | ✅ | ≥ 2 ký tự sau trim |
| `phone` | string | ✅ | Regex VN phone |
| `province` | string | ✅ | Không rỗng |
| `district` | string | ✅ | Không rỗng |
| `ward` | string | ✅ | Không rỗng |
| `streetDetail` | string | ✅ | Không rỗng |
| `isDefault` | boolean | ❌ | Default `false` |

**Logic đặc biệt:**
- Nếu user **chưa có địa chỉ nào** → tự động `isDefault = true` (bỏ qua giá trị gửi lên)
- Nếu gửi `isDefault = true` → revoke tất cả địa chỉ mặc định cũ (trong transaction)

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Thiếu bất kỳ trường bắt buộc | 400 | `Vui lòng điền đầy đủ thông tin địa chỉ` |
| `fullName` < 2 ký tự | 400 | `Họ tên người nhận phải có ít nhất 2 ký tự` |
| `phone` sai định dạng | 400 | `Số điện thoại không hợp lệ` |

---

### FR-07: Cập nhật địa chỉ

| | |
|---|---|
| **Endpoint** | `PUT /api/users/me/addresses/:id` |
| **Auth** | Bearer Token |

**Body:** Giống FR-06, tất cả đều bắt buộc (không hỗ trợ partial update).

**Logic đặc biệt:**
- Nếu gửi `isDefault = true` và địa chỉ hiện tại chưa là mặc định → revoke cũ + set mới (trong transaction)
- Nếu `isDefault = true` và đã là mặc định → chỉ update các trường khác

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không thuộc user | 404 | `Địa chỉ không tồn tại` |
| Validate trường | 400 | (giống FR-06) |

---

### FR-08: Xóa địa chỉ

| | |
|---|---|
| **Endpoint** | `DELETE /api/users/me/addresses/:id` |
| **Auth** | Bearer Token |

**Logic đặc biệt:**
- Nếu xóa địa chỉ **mặc định**: sau khi xóa → tự động set địa chỉ `createdAt DESC` còn lại làm mặc định
- Nếu không còn địa chỉ nào → không làm gì thêm

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không thuộc user | 404 | `Địa chỉ không tồn tại` |

---

### FR-09: Đặt địa chỉ mặc định

| | |
|---|---|
| **Endpoint** | `PATCH /api/users/me/addresses/:id/default` |
| **Auth** | Bearer Token |

**Xử lý:**
1. Kiểm tra địa chỉ thuộc user
2. Nếu đã là mặc định → return ngay (idempotent)
3. Transaction: unset all defaults → set địa chỉ này

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không thuộc user | 404 | `Địa chỉ không tồn tại` |

---

## 3. Yêu cầu phi chức năng

### NFR-01: Bảo mật

| Yêu cầu | Mô tả |
|---|---|
| Ownership check | Mọi thao tác địa chỉ đều check `address.userId === req.user.userId` |
| No data leak | `passwordHash`, `resetPasswordToken`, `avatarPublicId` không bao giờ xuất hiện trong response |
| Avatar rate limit | 10 uploads / giờ để ngăn abuse Cloudinary quota |

### NFR-02: Tính nhất quán dữ liệu

| Yêu cầu | Mô tả |
|---|---|
| Single default address | Dùng Prisma transaction để đảm bảo tại mọi thời điểm chỉ có ≤ 1 `isDefault = true` |
| Avatar idempotent | Cloudinary `overwrite = true` đảm bảo không tạo duplicate |

### NFR-03: Hiệu năng

| Chỉ tiêu | Giá trị |
|---|---|
| `GET /me` | < 100ms (p95) — single SELECT |
| Avatar upload | < 3s (p95) — phụ thuộc Cloudinary |
| Address operations | < 200ms (p95) |

---

## 4. Schema dữ liệu liên quan

### User (trường liên quan đến module)

| Trường | Kiểu | Mô tả |
|---|---|---|
| `fullName` | string | Cập nhật qua FR-02 |
| `phone` | string? | Cập nhật qua FR-02; unique |
| `avatarUrl` | string? | Cập nhật qua FR-04 |
| `avatarPublicId` | string? | Dùng nội bộ — không expose |
| `passwordHash` | string | Cập nhật qua FR-03 |

### Address

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK → User |
| `fullName` | string | Tên người nhận |
| `phone` | string | SĐT người nhận |
| `province` | string | Tỉnh/Thành phố |
| `district` | string | Quận/Huyện |
| `ward` | string | Phường/Xã |
| `streetDetail` | string | Số nhà, tên đường |
| `isDefault` | boolean | Chỉ 1 địa chỉ per user |
| `createdAt` | DateTime | Dùng để chọn default kế thừa |
