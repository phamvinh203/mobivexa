# Test Case Document
## Module: Authentication
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [SRS.md](./SRS.md) | [APISpec.md](./APISpec.md)  
> **Test Framework:** Vitest + Supertest  
> **Môi trường:** Test DB (NODE_ENV=test) — rate limit bị skip

---

## Tổng quan Test Suite

| Nhóm | Số TC | Phủ |
|---|---|---|
| POST /auth/register | 8 | Đăng ký |
| POST /auth/login | 7 | Đăng nhập |
| POST /auth/refresh | 6 | Refresh Token |
| POST /auth/forgot-password | 4 | Quên mật khẩu |
| POST /auth/reset-password | 6 | Đặt lại mật khẩu |
| POST /auth/logout | 3 | Đăng xuất |
| Middleware authenticate | 4 | Xác thực request |
| **Tổng cộng** | **38** | |

---

## TC-REG: Đăng ký tài khoản

### TC-REG-01: Đăng ký thành công

| Thuộc tính | Giá trị |
|---|---|
| **ID** | TC-REG-01 |
| **Mức độ** | Cao |
| **Loại** | Happy Path |

**Input:**
```json
{
  "email":    "newuser@example.com",
  "fullName": "Nguyễn Văn Test",
  "password": "password123",
  "phone":    "0901234567"
}
```

**Expected Output:**
- HTTP Status: `201`
- Body chứa `id`, `email`, `fullName`, `role = "CUSTOMER"`, `createdAt`
- Body **không chứa** `password`, `passwordHash`, `resetPasswordToken`

---

### TC-REG-02: Email đã tồn tại

| Thuộc tính | Giá trị |
|---|---|
| **ID** | TC-REG-02 |
| **Mức độ** | Cao |
| **Loại** | Negative |

**Precondition:** User với email `existing@example.com` đã tồn tại trong DB.

**Input:**
```json
{ "email": "existing@example.com", "fullName": "Test", "password": "password123" }
```

**Expected Output:**
- HTTP Status: `409`
- Message: `"Email đã được sử dụng"`

---

### TC-REG-03: Email sai định dạng

| ID | Input | Expected Status | Expected Message |
|---|---|---|---|
| TC-REG-03a | `"email": "notanemail"` | 400 | `Email không hợp lệ` |
| TC-REG-03b | `"email": ""` | 400 | `Email không hợp lệ` |
| TC-REG-03c | `"email": "no@"` | 400 | `Email không hợp lệ` |

---

### TC-REG-04: fullName không hợp lệ

| ID | Input | Expected Status | Expected Message |
|---|---|---|---|
| TC-REG-04a | `"fullName": "A"` | 400 | `Họ tên phải có ít nhất 2 ký tự` |
| TC-REG-04b | `"fullName": ""` | 400 | `Họ tên phải có ít nhất 2 ký tự` |
| TC-REG-04c | Thiếu `fullName` | 400 | `Họ tên phải có ít nhất 2 ký tự` |

---

### TC-REG-05: Password quá ngắn

| ID | Input | Expected Status | Expected Message |
|---|---|---|---|
| TC-REG-05a | `"password": "1234567"` (7 ký tự) | 400 | `Mật khẩu phải có ít nhất 8 ký tự` |
| TC-REG-05b | `"password": ""` | 400 | `Mật khẩu phải có ít nhất 8 ký tự` |

---

### TC-REG-06: Đăng ký không có phone (optional field)

**Input:** `{ "email": "nophone@example.com", "fullName": "No Phone", "password": "password123" }`

**Expected:** `201` — phone có thể null, không ảnh hưởng.

---

### TC-REG-07: Password được hash (không lưu plain text)

**Precondition:** Đăng ký thành công.  
**Verify:** Truy vấn DB: `user.passwordHash` không bằng `"password123"` và `passwordHash.startsWith("$2b$")`.

---

### TC-REG-08: Role mặc định là CUSTOMER

**Verify:** Response chứa `"role": "CUSTOMER"` sau đăng ký.

---

## TC-LOGIN: Đăng nhập

### TC-LOGIN-01: Đăng nhập thành công

**Input:** `{ "email": "test@example.com", "password": "password123" }`  
**Expected:**
- HTTP: `200`
- Body chứa `accessToken`, `refreshToken`, `user`
- `user` không chứa `passwordHash`
- `accessToken` là JWT hợp lệ với payload `{ userId, email, role }`

---

### TC-LOGIN-02: Sai password

**Input:** `{ "email": "test@example.com", "password": "wrongpassword" }`  
**Expected:** `401`, message: `"Email hoặc mật khẩu không đúng"`

---

### TC-LOGIN-03: Email không tồn tại

**Input:** `{ "email": "notfound@example.com", "password": "anypassword" }`  
**Expected:** `401`, message: `"Email hoặc mật khẩu không đúng"`  
**Verify:** Message giống TC-LOGIN-02 — không phân biệt sai email hay sai password.

---

### TC-LOGIN-04: Tài khoản bị khóa

**Precondition:** User có `isActive = false`.  
**Expected:** `403`, message: `"Tài khoản đã bị khóa"`

---

### TC-LOGIN-05: Thiếu email

**Input:** `{ "password": "password123" }`  
**Expected:** `400`, message: `"Email không hợp lệ"`

---

### TC-LOGIN-06: Thiếu password

**Input:** `{ "email": "test@example.com" }`  
**Expected:** `400`, message: `"Vui lòng nhập mật khẩu"`

---

### TC-LOGIN-07: Refresh Token được lưu vào DB sau đăng nhập

**Verify:** Sau đăng nhập thành công, truy vấn DB: tìm thấy bản ghi `RefreshToken` với `token = refreshToken` và `isRevoked = false`.

---

## TC-REFRESH: Làm mới phiên đăng nhập

### TC-REFRESH-01: Refresh thành công

**Precondition:** Đã đăng nhập, có `refreshToken` hợp lệ.  
**Input:** `{ "refreshToken": "<valid_token>" }`  
**Expected:**
- HTTP: `200`
- Body chứa `accessToken` mới và `refreshToken` mới
- Token mới **khác** token cũ

---

### TC-REFRESH-02: Token cũ bị revoke sau refresh (Rotation)

**Precondition:** Đã refresh thành công một lần.  
**Action:** Gọi lại refresh với token cũ (đã dùng).  
**Expected:** `401`, message: `"Refresh token không hợp lệ"`

---

### TC-REFRESH-03: Token đã bị revoke thủ công

**Precondition:** DB: `isRevoked = true` cho token.  
**Expected:** `401`

---

### TC-REFRESH-04: Token hết hạn theo DB

**Precondition:** DB: `expiresAt` đã qua.  
**Expected:** `401`

---

### TC-REFRESH-05: Token giả (sai chữ ký JWT)

**Input:** `{ "refreshToken": "fake.token.here" }`  
**Expected:** `401`, message: `"Refresh token không hợp lệ hoặc đã hết hạn"`

---

### TC-REFRESH-06: Thiếu refreshToken trong body

**Input:** `{}`  
**Expected:** `400`, message: `"Thiếu refresh token"`

---

## TC-FORGOT: Quên mật khẩu

### TC-FORGOT-01: Email tồn tại — gửi OTP

**Precondition:** User với email tồn tại trong DB.  
**Input:** `{ "email": "test@example.com" }`  
**Expected:**
- HTTP: `200`
- DB: `resetPasswordToken` không null, `resetPasswordExpires = now + 15 phút`
- Email được gửi (mock mail service)

---

### TC-FORGOT-02: Email không tồn tại — vẫn trả 200

**Input:** `{ "email": "notfound@example.com" }`  
**Expected:**
- HTTP: `200` (giống TC-FORGOT-01)
- DB: Không có gì thay đổi
- Email: Không gửi

---

### TC-FORGOT-03: Email sai định dạng

**Input:** `{ "email": "notanemail" }`  
**Expected:** `400`

---

### TC-FORGOT-04: OTP được hash trước khi lưu DB

**Verify:** `user.resetPasswordToken !== otp_gốc` và là SHA-256 hash (64 ký tự hex).

---

## TC-RESET: Đặt lại mật khẩu

### TC-RESET-01: Đặt lại thành công

**Precondition:** Đã gọi forgot-password, lấy được OTP từ email (hoặc DB test).  
**Input:** `{ "otp": "382941", "newPassword": "newpassword123" }`  
**Expected:**
- HTTP: `200`
- DB: `passwordHash` mới (bcrypt)
- DB: `resetPasswordToken = null`, `resetPasswordExpires = null`
- DB: Toàn bộ `RefreshToken` của user: `isRevoked = true`

---

### TC-RESET-02: OTP sai

**Input:** `{ "otp": "000000", "newPassword": "newpassword123" }`  
**Expected:** `400`, message: `"Token không hợp lệ hoặc đã hết hạn"`

---

### TC-RESET-03: OTP hết hạn

**Precondition:** DB: `resetPasswordExpires` đã qua.  
**Expected:** `400`, message: `"Token không hợp lệ hoặc đã hết hạn"`

---

### TC-RESET-04: OTP không đúng 6 chữ số

| ID | Input otp | Expected |
|---|---|---|
| TC-RESET-04a | `"12345"` (5 chữ số) | `400` OTP phải là 6 chữ số |
| TC-RESET-04b | `"1234567"` (7 chữ số) | `400` |
| TC-RESET-04c | `"abc123"` (có chữ) | `400` |

---

### TC-RESET-05: Password mới quá ngắn

**Input:** `{ "otp": "382941", "newPassword": "short" }`  
**Expected:** `400`, message: `"Mật khẩu mới phải có ít nhất 8 ký tự"`

---

### TC-RESET-06: Toàn bộ session bị revoke sau reset

**Precondition:** User đang có 2 RefreshToken active.  
**Action:** Reset password thành công.  
**Verify:** Cả 2 RefreshToken có `isRevoked = true`.

---

## TC-LOGOUT: Đăng xuất

### TC-LOGOUT-01: Đăng xuất thành công

**Input:** `{ "refreshToken": "<valid_token>" }`  
**Expected:**
- HTTP: `200`
- DB: `isRevoked = true` cho token này

---

### TC-LOGOUT-02: Đăng xuất với token đã revoke (idempotent)

**Precondition:** Token đã `isRevoked = true`.  
**Expected:** `200` (không lỗi — updateMany chỉ update 0 rows)

---

### TC-LOGOUT-03: Thiếu refreshToken

**Input:** `{}`  
**Expected:** `400`, message: `"Thiếu refresh token"`

---

## TC-AUTH: Middleware Authenticate

### TC-AUTH-01: Không có header Authorization

**Request:** `GET /api/users/me` — không có header  
**Expected:** `401`, message: `"Không có token xác thực"`

---

### TC-AUTH-02: Access Token hết hạn

**Request:** `GET /api/users/me` với token đã hết hạn  
**Expected:** `401`, message: `"Token không hợp lệ hoặc đã hết hạn"`

---

### TC-AUTH-03: Access Token hợp lệ

**Request:** `GET /api/users/me` với access token vừa đăng nhập  
**Expected:** `200` + profile data

---

### TC-AUTH-04: Role không đủ quyền

**Request:** `GET /api/admin/users` với Access Token của CUSTOMER  
**Expected:** `403`, message: `"Bạn không có quyền thực hiện thao tác này"`

---

## Checklist Coverage

| Tiêu chí | Trạng thái |
|---|---|
| Happy path tất cả 6 endpoints | ✅ |
| Validate đầu vào thiếu/sai | ✅ |
| Email không tiết lộ tồn tại (forgot) | ✅ |
| Password không xuất hiện trong response | ✅ |
| Refresh Token Rotation (token cũ bị revoke) | ✅ |
| Session revoke sau reset password | ✅ |
| Rate limiting | ⚠️ Skip trong test (NODE_ENV=test) |
| Middleware authenticate | ✅ |
| Middleware authorize (role check) | ✅ |
| DB state verification sau mỗi action | ✅ |
