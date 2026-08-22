# Test Case Document
## Module: Auth
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| Đăng ký | 5 |
| Đăng nhập | 6 |
| Refresh Token | 5 |
| Quên mật khẩu | 3 |
| Đặt lại mật khẩu | 5 |
| Đăng xuất | 3 |
| authenticate Middleware | 3 |
| **Tổng** | **30** |

---

## TC-REG: Đăng ký

### TC-REG-01: Đăng ký thành công

**Input:** `{ email: "new@test.com", fullName: "Test User", password: "pass1234" }`  
**Expected:**
- `200`
- Response không chứa `passwordHash`
- `role = CUSTOMER`, `isActive = true`
- User tồn tại trong DB

---

### TC-REG-02: Email đã tồn tại → 409

**Precondition:** Email đã có trong DB  
**Input:** Cùng email  
**Expected:** `409 Email đã được sử dụng`

---

### TC-REG-03: Email sai format → 400

**Input:** `email: "notanemail"`  
**Expected:** `400`

---

### TC-REG-04: fullName quá ngắn → 400

**Input:** `fullName: "A"` (1 ký tự)  
**Expected:** `400`

---

### TC-REG-05: Password quá ngắn → 400

**Input:** `password: "1234567"` (7 ký tự)  
**Expected:** `400`

---

## TC-LOGIN: Đăng nhập

### TC-LOGIN-01: Đăng nhập thành công

**Input:** email + password đúng  
**Expected:**
- `200`
- `accessToken`, `refreshToken` trong response
- `user` không có `passwordHash`, `resetPasswordToken`, `resetPasswordExpires`
- RefreshToken được tạo trong DB

---

### TC-LOGIN-02: Email không tồn tại → 401

**Input:** email chưa đăng ký  
**Expected:** `401` — cùng message với TC-LOGIN-03

---

### TC-LOGIN-03: Password sai → 401

**Precondition:** Email tồn tại  
**Input:** Sai password  
**Expected:** `401` — cùng message với TC-LOGIN-02

---

### TC-LOGIN-04: Tài khoản bị khóa → 403

**Precondition:** `user.isActive = false`  
**Expected:** `403 Tài khoản bị vô hiệu hóa`

---

### TC-LOGIN-05: User OAuth không có password → 401

**Precondition:** User tồn tại nhưng `passwordHash = null`  
**Expected:** `401` (cùng message)

---

### TC-LOGIN-06: Password thiếu → 400

**Input:** `{ email: "test@test.com" }` (thiếu password)  
**Expected:** `400`

---

## TC-REFRESH: Refresh Token

### TC-REFRESH-01: Rotation thành công

**Precondition:** Có refresh token hợp lệ  
**Expected:**
- `200 { accessToken, refreshToken }`
- Token cũ: `isRevoked = true` trong DB
- Token mới tạo trong DB

---

### TC-REFRESH-02: JWT invalid → 401

**Input:** `refreshToken: "invalid.jwt.token"`  
**Expected:** `401`

---

### TC-REFRESH-03: Token đã revoke → 401

**Precondition:** Token đã bị revoke (`isRevoked = true`)  
**Expected:** `401`

---

### TC-REFRESH-04: Token đã hết hạn DB → 401

**Precondition:** `expiresAt < now` trong DB (dù JWT còn hạn)  
**Expected:** `401`

---

### TC-REFRESH-05: refreshToken thiếu → 400

**Input:** `{}` (không có trường refreshToken)  
**Expected:** `400`

---

## TC-FORGOT: Quên mật khẩu

### TC-FORGOT-01: Email tồn tại — gửi OTP

**Precondition:** Email có trong DB  
**Expected:**
- `200`
- `user.resetPasswordToken` được cập nhật trong DB (dạng hash)
- `user.resetPasswordExpires ≈ now + 15 phút`
- Email được gửi (mock sendResetPasswordEmail)

---

### TC-FORGOT-02: Email không tồn tại — vẫn 200

**Input:** Email chưa đăng ký  
**Expected:** `200` (không tiết lộ)

---

### TC-FORGOT-03: Email sai format → 400

**Input:** `email: "notvalid"`  
**Expected:** `400`

---

## TC-RESET: Đặt lại mật khẩu

### TC-RESET-01: Reset thành công

**Precondition:** OTP hợp lệ, còn trong 15 phút  
**Input:** `{ otp: "123456", newPassword: "newPass123" }`  
**Expected:**
- `200`
- `user.passwordHash` thay đổi trong DB
- `user.resetPasswordToken = null`, `resetPasswordExpires = null`
- Tất cả refresh token của user bị revoke

---

### TC-RESET-02: OTP sai → 400

**Input:** OTP không khớp với hash trong DB  
**Expected:** `400 Token không hợp lệ hoặc đã hết hạn`

---

### TC-RESET-03: OTP hết hạn → 400

**Precondition:** `resetPasswordExpires < now`  
**Expected:** `400`

---

### TC-RESET-04: OTP không đúng 6 số → 400 (validator)

**Input:** `otp: "12345"` (5 số)  
**Expected:** `400`

---

### TC-RESET-05: newPassword < 8 ký tự → 400

**Input:** `newPassword: "short"`  
**Expected:** `400`

---

## TC-LOGOUT: Đăng xuất

### TC-LOGOUT-01: Logout thành công

**Precondition:** Có refresh token hợp lệ  
**Expected:**
- `200`
- `refreshToken.isRevoked = true` trong DB

---

### TC-LOGOUT-02: Idempotent — revoke lần 2 vẫn 200

**Precondition:** Token đã bị revoke  
**Expected:** `200` (updateMany count=0, không lỗi)

---

### TC-LOGOUT-03: refreshToken thiếu → 400

**Input:** `{}` (không có trường)  
**Expected:** `400`

---

## TC-MW: authenticate Middleware

### TC-MW-01: Token hợp lệ → req.user gắn

**Input:** Header `Authorization: Bearer <validToken>`  
**Expected:**
- Handler nhận được `req.user.userId`, `req.user.email`, `req.user.role`

---

### TC-MW-02: Không có header → 401

**Input:** Request không có `Authorization`  
**Expected:** `401 Không có token xác thực`

---

### TC-MW-03: Token expired → 401

**Input:** JWT đã hết hạn  
**Expected:** `401 Token không hợp lệ hoặc đã hết hạn`

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Không tiết lộ field sai khi login | TC-LOGIN-02, TC-LOGIN-03 |
| Không tiết lộ email khi forgotPassword | TC-FORGOT-02 |
| OTP lưu dạng hash (không plain text) | TC-FORGOT-01, TC-RESET-01 |
| Refresh token rotation atomic | TC-REFRESH-01 |
| Reset password revoke toàn bộ session | TC-RESET-01 |
| Logout idempotent | TC-LOGOUT-02 |
| isActive check trước verify password | TC-LOGIN-04 |
| passwordHash null (OAuth user) | TC-LOGIN-05 |
