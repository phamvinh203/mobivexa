# Nghiệp vụ User (Người dùng) — Mobivexa

> **Phạm vi:** `src/services/user.service.ts`, `src/controllers/user.controller.ts`, `src/routes/user.route.ts`, `src/validators/user.validator.ts`, `src/middlewares/upload.middleware.ts`, `src/config/cloudinary.ts`
>
> **Cập nhật:** 2026-06-19

---

## 1. Tổng quan

Module User quản lý **thông tin cá nhân** và **địa chỉ giao hàng** của người dùng đã đăng nhập. Toàn bộ route đều yêu cầu Access Token hợp lệ (`authenticate` middleware).

Module chia làm 2 nhóm chức năng chính:

| Nhóm | Chức năng | Số endpoint |
|---|---|---|
| **Profile** | Xem / cập nhật thông tin cá nhân, đổi mật khẩu, upload avatar | 4 |
| **Địa chỉ** | Quản lý danh sách địa chỉ giao hàng | 5 |

---

## 2. Danh sách endpoint

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/api/users/me` | Xem profile | ✅ |
| `PUT` | `/api/users/me` | Cập nhật profile | ✅ |
| `PUT` | `/api/users/me/password` | Đổi mật khẩu | ✅ |
| `POST` | `/api/users/me/avatar` | Upload ảnh đại diện | ✅ |
| `GET` | `/api/users/me/addresses` | Lấy danh sách địa chỉ | ✅ |
| `POST` | `/api/users/me/addresses` | Thêm địa chỉ mới | ✅ |
| `PUT` | `/api/users/me/addresses/:id` | Cập nhật địa chỉ | ✅ |
| `DELETE` | `/api/users/me/addresses/:id` | Xóa địa chỉ | ✅ |
| `PATCH` | `/api/users/me/addresses/:id/default` | Đặt địa chỉ mặc định | ✅ |

---

## 3. Chính sách & Ràng buộc nghiệp vụ

### 3.1 Thông tin cá nhân (Profile)

| Trường | Quy tắc |
|---|---|
| `fullName` | Tối thiểu 2 ký tự sau khi trim |
| `phone` | Regex: `^(0\|+84)[0-9]{8,10}$` — bắt đầu bằng `0` hoặc `+84` |
| `phone` | Phải duy nhất trong hệ thống (không trùng với user khác) |
| `phone` | Có thể set về `null` (xóa số điện thoại) bằng cách gửi `phone: ""` |
| Cập nhật profile | Phải gửi ít nhất 1 trong 2 trường `fullName` hoặc `phone` |

### 3.2 Đổi mật khẩu

| Quy tắc | Giá trị |
|---|---|
| `newPassword` tối thiểu | 8 ký tự |
| `newPassword` ≠ `currentPassword` | Bắt buộc khác nhau |
| Phải xác minh mật khẩu cũ | bcrypt compare trước khi đổi |
| Không áp dụng cho | Tài khoản không có `passwordHash` (social login) |

### 3.3 Upload Avatar

| Quy tắc | Giá trị |
|---|---|
| Định dạng cho phép | JPG, JPEG, PNG, WebP |
| Kích thước tối đa | 5 MB |
| Rate Limit | 10 lần / 1 giờ / IP |
| Lưu trữ | Cloudinary (folder `users/avatars`) |
| `public_id` | Cố định: `user_{userId}` — ảnh mới **ghi đè** ảnh cũ, không tạo file mới |
| Xử lý ảnh | Crop 400×400px, gravity `face`, convert sang WebP (hoặc PNG nếu input là PNG) |

### 3.4 Địa chỉ giao hàng

| Trường bắt buộc | Mô tả |
|---|---|
| `fullName` | Tên người nhận (≥ 2 ký tự) |
| `phone` | SĐT người nhận (cùng regex profile) |
| `province` | Tỉnh / Thành phố |
| `district` | Quận / Huyện |
| `ward` | Phường / Xã |
| `streetDetail` | Số nhà, tên đường, tòa nhà... |
| `isDefault` | Tùy chọn — đánh dấu địa chỉ mặc định |

**Quy tắc địa chỉ mặc định:**
- Mỗi user chỉ có **1 địa chỉ mặc định** tại một thời điểm
- Địa chỉ **đầu tiên** tạo ra luôn tự động trở thành mặc định (dù `isDefault = false`)
- Khi set địa chỉ khác làm mặc định: toàn bộ địa chỉ cũ được bỏ cờ trong **cùng 1 transaction**
- Khi **xóa địa chỉ mặc định**: hệ thống tự động chọn địa chỉ được tạo gần nhất (`createdAt DESC`) làm mặc định mới
- Danh sách địa chỉ sắp xếp: mặc định lên đầu (`isDefault DESC`), sau đó theo `createdAt DESC`

**Bảo vệ quyền sở hữu:** Mọi thao tác sửa/xóa/set-default đều kiểm tra `address.userId === req.user.userId` — trả `404` nếu địa chỉ không tồn tại hoặc không thuộc về user hiện tại.

---

## 4. Luồng nghiệp vụ chi tiết

### 4.1 Xem Profile

```
GET /api/users/me → [authenticate] → getProfile(userId) → DB → Response
```

**Happy Path:**
1. Lấy `userId` từ `req.user` (đã được inject bởi `authenticate`)
2. Query bảng `User` theo `id`, chỉ lấy các trường public (không có `passwordHash`, `resetPasswordToken`, `resetPasswordExpires`, `avatarPublicId`)
3. Trả về `200` + `{ user }`

---

### 4.2 Cập nhật Profile

```
PUT /api/users/me → [authenticate] → [validate] → updateProfile → DB → Response
```

**Happy Path:**
1. Validate: ít nhất 1 trong `fullName`/`phone`; nếu có thì đúng format
2. Nếu cập nhật `phone`: kiểm tra xem SĐT đó đã được user khác dùng chưa
3. Trim `fullName` trước khi lưu
4. Nếu `phone = ""` → lưu `null` (xóa SĐT)
5. Cập nhật DB, trả về `200` + user đã cập nhật

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Không gửi trường nào | 400 | `Vui lòng cung cấp ít nhất một trường cần cập nhật` |
| `fullName` < 2 ký tự | 400 | `Họ tên phải có ít nhất 2 ký tự` |
| `phone` sai format | 400 | `Số điện thoại không hợp lệ` |
| `phone` đã dùng bởi user khác | 409 | `Số điện thoại đã được sử dụng` |

---

### 4.3 Đổi Mật Khẩu

```
PUT /api/users/me/password → [authenticate] → [validate] → changePassword → DB → Response
```

**Happy Path:**
1. Validate: `currentPassword` không rỗng; `newPassword ≥ 8 ký tự`; hai mật khẩu phải khác nhau
2. Lấy `passwordHash` từ DB
3. Kiểm tra tài khoản có dùng mật khẩu không (`passwordHash` tồn tại)
4. bcrypt compare `currentPassword` với `passwordHash`
5. bcrypt hash `newPassword` (cost=12)
6. Cập nhật `passwordHash` mới vào DB
7. Trả về `200` + `{ message: 'Đổi mật khẩu thành công' }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Thiếu `currentPassword` | 400 | `Vui lòng nhập mật khẩu hiện tại` |
| `newPassword` < 8 ký tự | 400 | `Mật khẩu mới phải có ít nhất 8 ký tự` |
| `newPassword` == `currentPassword` | 400 | `Mật khẩu mới phải khác mật khẩu hiện tại` |
| Tài khoản không có mật khẩu | 400 | `Tài khoản không dùng mật khẩu` |
| `currentPassword` sai | 400 | `Mật khẩu hiện tại không đúng` |

> **Lưu ý:** Đổi mật khẩu tại đây **không** revoke refresh token — khác với `reset-password` (quên mật khẩu). Đây là hành động chủ động của user đang đăng nhập.

---

### 4.4 Upload Avatar

```
POST /api/users/me/avatar → [authenticate] → [avatarLimiter] → [uploadImage.single] → uploadAvatar → Cloudinary → DB → Response
```

**Happy Path:**
1. Rate limit: tối đa 10 lần/giờ/IP
2. Multer kiểm tra: mimetype phải là JPG/PNG/WebP, kích thước ≤ 5MB, extension hợp lệ
3. File được giữ trong memory (không lưu disk)
4. Upload lên Cloudinary:
   - `folder: users/avatars`
   - `public_id: user_{userId}` (cố định → ghi đè ảnh cũ)
   - `overwrite: true`
   - Tự động crop 400×400, nhận diện khuôn mặt (`gravity: face`)
   - Convert: PNG input → lưu PNG; các loại khác → WebP
5. Lưu `avatarUrl` và `avatarPublicId` vào DB
6. Trả về `200` + `{ avatarUrl, avatarPublicId }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Không gửi file | 400 | `Vui lòng chọn ảnh` |
| Sai định dạng / extension | 400 | `Chỉ chấp nhận ảnh JPG, PNG, WebP` |
| File > 5MB | 400 | *(multer error)* |
| Vượt rate limit | 429 | `Quá nhiều lần upload ảnh, vui lòng thử lại sau 1 giờ` |

---

### 4.5 Lấy Danh Sách Địa Chỉ

```
GET /api/users/me/addresses → [authenticate] → getAddresses → DB → Response
```

**Happy Path:**
1. Query tất cả địa chỉ thuộc `userId`
2. Sắp xếp: `isDefault DESC`, `createdAt DESC` (mặc định luôn đứng đầu)
3. Trả về `200` + `{ addresses: [...] }`

---

### 4.6 Thêm Địa Chỉ Mới

```
POST /api/users/me/addresses → [authenticate] → [validate] → createAddress → DB → Response
```

**Happy Path:**
1. Validate đầy đủ 6 trường bắt buộc + format phone
2. Kiểm tra user đã có địa chỉ nào chưa (`findFirst`)
3. **Nếu chưa có địa chỉ nào** → `shouldBeDefault = true` (bất kể `isDefault` gửi lên)
4. **Nếu `isDefault = true`** → dùng transaction: bỏ cờ tất cả địa chỉ cũ → tạo địa chỉ mới với `isDefault = true`
5. **Nếu `isDefault = false` và đã có địa chỉ** → tạo thẳng với `isDefault = false`
6. Trả về `201` + `{ address }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Thiếu bất kỳ trường nào trong 6 trường | 400 | `Vui lòng điền đầy đủ thông tin địa chỉ` |
| `fullName` < 2 ký tự | 400 | `Họ tên người nhận phải có ít nhất 2 ký tự` |
| `phone` sai format | 400 | `Số điện thoại không hợp lệ` |

---

### 4.7 Cập Nhật Địa Chỉ

```
PUT /api/users/me/addresses/:id → [authenticate] → [validate] → updateAddress → DB → Response
```

**Happy Path:**
1. Validate đầy đủ 6 trường + format phone
2. Kiểm tra địa chỉ tồn tại và thuộc về user (`findOwnedAddress`) — `404` nếu không
3. **Nếu `isDefault = true` và địa chỉ hiện chưa phải mặc định** → transaction: bỏ cờ cũ → update với `isDefault = true`
4. **Nếu không đổi mặc định** → update thẳng các trường khác
5. Trả về `200` + địa chỉ đã cập nhật

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Địa chỉ không tồn tại hoặc không thuộc user | 404 | `Địa chỉ không tồn tại` |
| Sai format field | 400 | *(tương tự tạo mới)* |

---

### 4.8 Xóa Địa Chỉ

```
DELETE /api/users/me/addresses/:id → [authenticate] → deleteAddress → DB → Response
```

**Happy Path:**
1. Kiểm tra địa chỉ tồn tại và thuộc về user — `404` nếu không
2. Xóa địa chỉ khỏi DB
3. **Nếu địa chỉ bị xóa là mặc định:**
   - Tìm địa chỉ còn lại được tạo gần nhất (`createdAt DESC`)
   - Nếu còn địa chỉ khác → tự động set làm mặc định mới
   - Nếu không còn địa chỉ nào → không làm gì
4. Trả về `200` + `{ message: 'Xóa địa chỉ thành công' }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Địa chỉ không tồn tại hoặc không thuộc user | 404 | `Địa chỉ không tồn tại` |

---

### 4.9 Đặt Địa Chỉ Mặc Định

```
PATCH /api/users/me/addresses/:id/default → [authenticate] → setDefaultAddress → DB → Response
```

**Happy Path:**
1. Kiểm tra địa chỉ tồn tại và thuộc về user — `404` nếu không
2. **Nếu đã là mặc định** → return ngay, không làm gì (idempotent)
3. **Nếu chưa phải mặc định** → transaction:
   - Bỏ cờ `isDefault` khỏi tất cả địa chỉ hiện tại
   - Set `isDefault = true` cho địa chỉ được chọn
4. Trả về `200` + `{ message: 'Đã đặt làm địa chỉ mặc định' }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Địa chỉ không tồn tại hoặc không thuộc user | 404 | `Địa chỉ không tồn tại` |

---

## 5. Sơ đồ luồng Địa chỉ Mặc định

```
Thêm địa chỉ mới
       │
       ├─ Đã có địa chỉ? ──No──► isDefault = true (tự động)
       │                               │
       │                          Transaction:
       │                          1. Bỏ cờ tất cả cũ
       │                          2. Tạo mới isDefault=true
       │
       └─ Đã có địa chỉ ─Yes─► isDefault flag trong body?
                                      │
                               ┌──Yes─┘
                               │  Transaction:
                               │  1. Bỏ cờ tất cả cũ
                               │  2. Tạo mới isDefault=true
                               │
                               └──No──► Tạo mới isDefault=false


Xóa địa chỉ
       │
       ├─ Là địa chỉ mặc định? ──No──► Xóa, kết thúc
       │
       └─ Là địa chỉ mặc định ──Yes──► Xóa
                                             │
                                      Còn địa chỉ khác?
                                             │
                                    ┌──Yes───┘
                                    │  Set địa chỉ mới nhất
                                    │  (createdAt DESC) làm mặc định
                                    │
                                    └──No──► Kết thúc (không có mặc định)
```

---

## 6. Bảng dữ liệu liên quan

### Bảng `User` (trường liên quan User module)

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `email` | string | Chỉ đọc — không cho sửa qua profile |
| `fullName` | string | Tên hiển thị |
| `phone` | string? | Số điện thoại (unique, nullable) |
| `avatarUrl` | string? | URL ảnh đại diện trên Cloudinary |
| `avatarPublicId` | string? | Public ID trên Cloudinary (`user_{userId}`) |
| `role` | enum | `CUSTOMER` / `STAFF` / `ADMIN` — chỉ đọc |
| `isActive` | boolean | Trạng thái tài khoản — chỉ đọc |
| `emailVerified` | boolean | Xác thực email — chỉ đọc |

> **Trường không được trả về:** `passwordHash`, `resetPasswordToken`, `resetPasswordExpires`, `avatarPublicId` (ẩn khỏi response `getProfile`)

### Bảng `Address`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `userId` | string | FK → User |
| `fullName` | string | Tên người nhận |
| `phone` | string | SĐT người nhận |
| `province` | string | Tỉnh / Thành phố |
| `district` | string | Quận / Huyện |
| `ward` | string | Phường / Xã |
| `streetDetail` | string | Chi tiết địa chỉ (số nhà, đường...) |
| `isDefault` | boolean | Địa chỉ mặc định — chỉ 1 per user |
| `createdAt` | DateTime | Dùng để auto-promote khi xóa mặc định |

---

## 7. Phân biệt "Đổi mật khẩu" vs "Quên mật khẩu"

| Tiêu chí | Đổi mật khẩu (`PUT /me/password`) | Quên mật khẩu (`POST /auth/reset-password`) |
|---|---|---|
| Yêu cầu đăng nhập | ✅ Có (Access Token) | ❌ Không |
| Xác minh bằng | Mật khẩu cũ (bcrypt) | OTP 6 số qua email |
| Revoke refresh token | ❌ Không | ✅ Toàn bộ RT bị revoke |
| Dùng khi | User đang đăng nhập, chủ động đổi | User quên mật khẩu, không đăng nhập được |

---

## 8. Tích hợp bên ngoài

| Dịch vụ | Mục đích | Cấu hình |
|---|---|---|
| **Cloudinary** | Lưu trữ và xử lý avatar | `CLOUDINARY_URL` env (format: `cloudinary://key:secret@cloud`) |
| **Multer** | Parse multipart/form-data, filter file | Memory storage — file không lưu disk |
