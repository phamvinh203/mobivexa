# SRS — Software Requirement Specification
## Module: Authentication
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Phạm vi hệ thống

Module Authentication cung cấp các chức năng:
- Đăng ký / Đăng nhập bằng email + mật khẩu
- Quản lý phiên đăng nhập bằng JWT dual-token
- Khôi phục mật khẩu qua OTP email
- Đăng xuất và thu hồi token
- Phân quyền theo role (CUSTOMER / STAFF / ADMIN)

**Ngoài phạm vi:** OAuth, 2FA, SSO, email verification khi đăng ký.

---

## 2. Yêu cầu chức năng (Functional Requirements)

### FR-01: Đăng ký tài khoản

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-01 |
| **Tên** | Đăng ký tài khoản mới |
| **Ưu tiên** | Cao |
| **Endpoint** | `POST /api/auth/register` |

**Đầu vào:**
- `email` (string, required): định dạng email hợp lệ
- `fullName` (string, required): ≥ 2 ký tự sau trim
- `password` (string, required): ≥ 8 ký tự
- `phone` (string, optional): số điện thoại

**Xử lý:**
1. Validate định dạng đầu vào
2. Kiểm tra email trùng
3. Hash password với bcrypt cost=12
4. Tạo bản ghi User với role=CUSTOMER, isActive=true

**Đầu ra thành công:** `201` + `{ id, email, fullName, role, createdAt }`

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Email sai định dạng | 400 | `Email không hợp lệ` |
| fullName < 2 ký tự | 400 | `Họ tên phải có ít nhất 2 ký tự` |
| password < 8 ký tự | 400 | `Mật khẩu phải có ít nhất 8 ký tự` |
| Email đã tồn tại | 409 | `Email đã được sử dụng` |
| Vượt rate limit | 429 | `Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút` |

---

### FR-02: Đăng nhập

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-02 |
| **Tên** | Đăng nhập bằng email + mật khẩu |
| **Ưu tiên** | Cao |
| **Endpoint** | `POST /api/auth/login` |

**Đầu vào:**
- `email` (string, required)
- `password` (string, required)

**Xử lý:**
1. Validate định dạng
2. Tìm user theo email
3. Kiểm tra isActive
4. So khớp password với bcrypt
5. Sinh Access Token (15 phút) + Refresh Token (7 ngày)
6. Lưu Refresh Token vào DB

**Đầu ra thành công:** `200` + `{ accessToken, refreshToken, user }`

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Thiếu email/password | 400 | `Email không hợp lệ` / `Vui lòng nhập mật khẩu` |
| Email hoặc password sai | 401 | `Email hoặc mật khẩu không đúng` |
| Tài khoản bị khóa | 403 | `Tài khoản đã bị khóa` |
| Vượt rate limit | 429 | `Quá nhiều yêu cầu...` |

---

### FR-03: Làm mới Access Token

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-03 |
| **Tên** | Refresh Token — lấy Access Token mới |
| **Ưu tiên** | Cao |
| **Endpoint** | `POST /api/auth/refresh` |

**Đầu vào:**
- `refreshToken` (string, required)

**Xử lý:**
1. Verify chữ ký JWT của Refresh Token
2. Tra DB — token phải tồn tại, chưa bị revoke, chưa hết hạn
3. Atomic transaction: revoke token cũ + tạo token mới
4. Trả về Access Token mới + Refresh Token mới

**Đầu ra thành công:** `200` + `{ accessToken, refreshToken }`

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Thiếu refreshToken | 400 | `Thiếu refresh token` |
| Sai chữ ký / hết hạn JWT | 401 | `Refresh token không hợp lệ hoặc đã hết hạn` |
| Token đã revoke / không tìm thấy DB | 401 | `Refresh token không hợp lệ` |

---

### FR-04: Quên mật khẩu

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-04 |
| **Tên** | Gửi OTP khôi phục mật khẩu |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `POST /api/auth/forgot-password` |

**Đầu vào:**
- `email` (string, required)

**Xử lý:**
1. Validate email
2. Tìm user theo email — **nếu không tồn tại: vẫn trả 200** (không leak)
3. Sinh OTP 6 chữ số ngẫu nhiên
4. Hash OTP bằng SHA-256, lưu vào DB cùng expiry (15 phút)
5. Gửi OTP qua email

**Đầu ra:** `200` (luôn — dù email có tồn tại hay không)

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Email sai định dạng | 400 | `Email không hợp lệ` |
| Vượt rate limit | 429 | `Quá nhiều yêu cầu...` |

---

### FR-05: Đặt lại mật khẩu

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-05 |
| **Tên** | Đặt lại mật khẩu bằng OTP |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `POST /api/auth/reset-password` |

**Đầu vào:**
- `otp` (string, required): đúng 6 chữ số
- `newPassword` (string, required): ≥ 8 ký tự

**Xử lý:**
1. Validate otp (6 chữ số) và newPassword
2. Hash OTP bằng SHA-256
3. Tìm user có `resetPasswordToken = hash` và `resetPasswordExpires > now`
4. Atomic transaction:
   - Cập nhật passwordHash
   - Xóa resetPasswordToken + resetPasswordExpires
   - Revoke toàn bộ RefreshToken hiện có

**Đầu ra thành công:** `200` + `{ message: 'Đặt lại mật khẩu thành công' }`

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| OTP không đúng 6 chữ số | 400 | `OTP phải là 6 chữ số` |
| newPassword < 8 ký tự | 400 | `Mật khẩu mới phải có ít nhất 8 ký tự` |
| OTP sai hoặc hết hạn | 400 | `Token không hợp lệ hoặc đã hết hạn` |
| Vượt rate limit | 429 | `Quá nhiều yêu cầu...` |

---

### FR-06: Đăng xuất

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-06 |
| **Tên** | Đăng xuất và thu hồi Refresh Token |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `POST /api/auth/logout` |

**Đầu vào:**
- `refreshToken` (string, required)

**Xử lý:**
1. Validate có refreshToken trong body
2. Cập nhật `isRevoked = true` cho token trong DB (nếu tồn tại)
3. Không cần xác thực JWT — dùng token string làm key

**Đầu ra:** `200` + `{ message: 'Đăng xuất thành công' }`

**Ghi chú:** Access Token không bị thu hồi — hết hạn tự nhiên sau tối đa 15 phút.

---

### FR-07: Xác thực request (Middleware)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-07 |
| **Tên** | Middleware xác thực Bearer Token |
| **Áp dụng** | Tất cả protected routes |

**Xử lý:**
1. Đọc header `Authorization: Bearer <token>`
2. Verify chữ ký JWT với `JWT_ACCESS_SECRET`
3. Gán `req.user = { userId, email, role }` nếu hợp lệ

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có header Authorization | 401 | `Không có token xác thực` |
| Token sai chữ ký / hết hạn | 401 | `Token không hợp lệ hoặc đã hết hạn` |

---

### FR-08: Phân quyền theo role (Middleware)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-08 |
| **Tên** | Middleware phân quyền theo role |
| **Áp dụng** | Admin/Staff protected routes |

**Xử lý:**
- Kiểm tra `req.user.role` có nằm trong danh sách roles cho phép

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Role không có quyền | 403 | `Bạn không có quyền thực hiện thao tác này` |

---

## 3. Yêu cầu phi chức năng (Non-Functional Requirements)

### NFR-01: Hiệu năng

| Chỉ tiêu | Giá trị |
|---|---|
| Thời gian phản hồi login | < 500ms (p95) |
| Thời gian phản hồi refresh | < 200ms (p95) |
| Throughput | ≥ 100 req/s cho tất cả auth endpoints |

### NFR-02: Bảo mật

| Yêu cầu | Mô tả |
|---|---|
| Password hashing | bcrypt với cost factor = 12 |
| JWT Secret | Tối thiểu 32 ký tự; fail-fast khi khởi động nếu thiếu |
| OTP storage | Lưu dạng SHA-256 hash — không bao giờ plain text |
| Rate limiting | 10 req / 15 phút / IP cho các endpoint nhạy cảm |
| Token rotation | Refresh Token bị revoke ngay sau khi dùng |
| Error messages | Không tiết lộ thông tin nội bộ (email exists, etc.) |

### NFR-03: Độ tin cậy

| Yêu cầu | Giá trị |
|---|---|
| Uptime | ≥ 99.9% |
| Token cleanup | Định kỳ xóa token hết hạn/revoked > 7 ngày |
| Atomic operations | Refresh và Reset Password dùng Prisma transaction |

### NFR-04: Khả năng bảo trì

| Yêu cầu | Mô tả |
|---|---|
| JWT TTL | Cấu hình qua environment variables (`JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`) |
| Secret rotation | Thay đổi secret chỉ cần cập nhật env — không sửa code |
| Cleanup job | `cleanupExpiredTokens()` chạy định kỳ theo cron |

---

## 4. Yêu cầu dữ liệu

### 4.1 Bảng User (liên quan đến Auth)

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `id` | string | PK, auto-generated |
| `email` | string | unique, not null |
| `passwordHash` | string | not null (bcrypt) |
| `role` | UserRole | default CUSTOMER |
| `isActive` | boolean | default true |
| `resetPasswordToken` | string? | SHA-256 hash của OTP |
| `resetPasswordExpires` | DateTime? | OTP expiry |

### 4.2 Bảng RefreshToken

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `id` | string | PK |
| `token` | string | unique — JWT string |
| `userId` | string | FK → User |
| `expiresAt` | DateTime | now + 7 ngày |
| `isRevoked` | boolean | default false |
| `createdAt` | DateTime | auto |

---

## 5. Môi trường & Cấu hình

| Biến môi trường | Mô tả | Ràng buộc |
|---|---|---|
| `JWT_ACCESS_SECRET` | Secret ký Access Token | ≥ 32 ký tự, bắt buộc |
| `JWT_REFRESH_SECRET` | Secret ký Refresh Token | ≥ 32 ký tự, bắt buộc |
| `JWT_ACCESS_EXPIRES` | TTL Access Token | Default `15m` |
| `JWT_REFRESH_EXPIRES` | TTL Refresh Token | Default `7d` |
| `SMTP_*` | Cấu hình email gửi OTP | Bắt buộc cho forgot-password |

---

## 6. Phụ thuộc

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| `jsonwebtoken` | latest | Ký/xác thực JWT |
| `bcrypt` | latest | Hash password |
| `express-rate-limit` | latest | Rate limiting |
| `crypto` (Node built-in) | — | SHA-256 hash OTP |
| `nodemailer` (mailer.ts) | latest | Gửi email OTP |
| `@prisma/client` | latest | ORM tương tác DB |
