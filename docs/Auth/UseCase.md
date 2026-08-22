# Use Case Document
## Module: Auth
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## Actors

| Actor | Mô tả |
|---|---|
| **Guest** | Người dùng chưa đăng nhập |
| **Authenticated User** | Người dùng có access token hợp lệ (Customer / Staff / Admin) |
| **System** | Cron job dọn token |

---

## UC-01: Đăng ký tài khoản

**Actor:** Guest  
**Precondition:** Email chưa tồn tại trong hệ thống

**Main Flow:**
1. Guest gửi `POST /auth/register` với `email`, `fullName`, `password`
2. Hệ thống validate: email format, fullName >= 2 ký tự, password >= 8 ký tự
3. Hệ thống kiểm tra email chưa tồn tại
4. Hệ thống hash password bằng bcrypt
5. Hệ thống tạo user với `role = CUSTOMER`, `isActive = true`
6. Hệ thống trả thông tin user (không có passwordHash)

**Alternative Flow:**
- 2a. Validation lỗi → 400
- 3a. Email đã tồn tại → 409 "Email đã được sử dụng"

---

## UC-02: Đăng nhập

**Actor:** Guest  
**Precondition:** Tài khoản đã đăng ký

**Main Flow:**
1. Guest gửi `POST /auth/login` với `email`, `password`
2. Hệ thống validate email + password truthy
3. Hệ thống tìm user theo email
4. Hệ thống xác minh password
5. Hệ thống tạo `accessToken` + `refreshToken`
6. Hệ thống lưu `refreshToken` vào DB với `expiresAt = now + 7 ngày`
7. Hệ thống trả `{ accessToken, refreshToken, user }`

**Alternative Flow:**
- 3a. Email không tồn tại → 401 (cùng message với sai password)
- 3b. `user.passwordHash` là null (tài khoản OAuth) → 401
- 4a. Password sai → 401 "Email hoặc mật khẩu không đúng"
- 4b. `user.isActive = false` → 403 "Tài khoản bị vô hiệu hóa"

---

## UC-03: Refresh Access Token

**Actor:** Authenticated User (hoặc Guest với refresh token cũ)  
**Precondition:** Có refresh token (chưa hết hạn, chưa revoke)

**Main Flow:**
1. Client gửi `POST /auth/refresh` với `refreshToken`
2. Hệ thống verify JWT của refresh token
3. Hệ thống tìm token trong DB, kiểm tra `isRevoked = false` và `expiresAt > now`
4. Hệ thống tạo access token + refresh token mới
5. Trong **transaction**: revoke token cũ + tạo token mới trong DB
6. Hệ thống trả `{ accessToken, refreshToken }`

**Alternative Flow:**
- 2a. JWT invalid/expired → 401
- 3a. Token không tồn tại / đã revoke / đã hết hạn → 401

---

## UC-04: Quên mật khẩu

**Actor:** Guest  
**Precondition:** —

**Main Flow:**
1. Guest gửi `POST /auth/forgot-password` với `email`
2. Hệ thống tìm user theo email
3. Hệ thống tạo OTP 6 số ngẫu nhiên
4. Hệ thống lưu `SHA-256(otp)` vào `resetPasswordToken`, `expiresAt = now + 15 phút`
5. Hệ thống gửi OTP gốc qua email
6. Hệ thống trả 200

**Alternative Flow:**
- 2a. Email không tồn tại → **return 200** (không tiết lộ)

---

## UC-05: Đặt lại mật khẩu

**Actor:** Guest (có OTP từ email)  
**Precondition:** OTP còn hiệu lực (< 15 phút)

**Main Flow:**
1. Guest gửi `POST /auth/reset-password` với `otp` (6 số) + `newPassword`
2. Hệ thống hash OTP: `SHA-256(otp)`
3. Hệ thống tìm user: `WHERE resetPasswordToken = hash AND resetPasswordExpires > now`
4. Hệ thống hash mật khẩu mới
5. **Transaction:**
   - Cập nhật `passwordHash` mới; xóa `resetPasswordToken`, `resetPasswordExpires`
   - Revoke toàn bộ refresh token của user
6. Hệ thống trả 200

**Alternative Flow:**
- 1a. OTP không đúng định dạng 6 số hoặc password < 8 ký tự → 400 (validator)
- 3a. Hash không khớp hoặc OTP hết hạn → 400 "Token không hợp lệ hoặc đã hết hạn"

---

## UC-06: Đăng xuất

**Actor:** Authenticated User  
**Precondition:** Có refresh token

**Main Flow:**
1. Client gửi `POST /auth/logout` với `refreshToken`
2. Hệ thống revoke token: `updateMany WHERE token AND isRevoked=false SET isRevoked=true`
3. Hệ thống trả 200

**Ghi chú:** Idempotent — token đã revoke không gây lỗi (count=0 là bình thường)

---

## UC-07: Dọn dẹp token hết hạn (System)

**Actor:** System (cron job)  
**Precondition:** —

**Main Flow:**
1. System gọi `cleanupExpiredTokens()`
2. Xóa RefreshToken: `expiresAt < now`
3. Xóa RefreshToken: `isRevoked = true AND createdAt < now - 7 ngày`

---

## UC-08: Bảo vệ route (authenticate middleware)

**Actor:** Authenticated User  
**Precondition:** Gọi route yêu cầu xác thực

**Main Flow:**
1. Hệ thống đọc header `Authorization: Bearer <token>`
2. Hệ thống `verifyAccessToken(token)` → giải mã payload `{ userId, email, role }`
3. Hệ thống gắn `req.user = payload`
4. Request tiếp tục đến handler

**Alternative Flow:**
- 1a. Không có header → 401 "Không có token xác thực"
- 2a. Token invalid/expired → 401 "Token không hợp lệ hoặc đã hết hạn"
