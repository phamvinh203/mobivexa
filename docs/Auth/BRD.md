# Business Requirements Document
## Module: Auth
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Mục tiêu nghiệp vụ

Cung cấp cơ chế xác thực và phân quyền cho toàn bộ hệ thống: đăng ký, đăng nhập, refresh token, đặt lại mật khẩu qua OTP email, và đăng xuất.

---

## 2. Actors

| Actor | Mô tả |
|---|---|
| **Guest** | Đăng ký, đăng nhập, quên mật khẩu |
| **Customer / Staff / Admin** | Refresh token, đăng xuất |

---

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-01 | Email unique; đăng ký trùng email → 409 |
| BR-02 | Password hash bằng bcrypt; không lưu plain text |
| BR-03 | Đăng nhập không tiết lộ trường nào sai (email hay mật khẩu) — luôn trả cùng 1 thông điệp |
| BR-04 | Tài khoản `isActive = false` → 403 khi đăng nhập |
| BR-05 | Dual-token: **Access token** (JWT ngắn hạn) + **Refresh token** (JWT dài hạn, lưu DB) |
| BR-06 | Refresh token rotation: mỗi lần refresh → revoke token cũ + tạo token mới (transaction) |
| BR-07 | Refresh token hợp lệ phải: JWT verify thành công + tồn tại trong DB + `isRevoked=false` + `expiresAt > now` |
| BR-08 | Reset password dùng OTP 6 số; lưu DB dạng SHA-256 hash; gốc chỉ gửi qua email |
| BR-09 | OTP hết hạn sau **15 phút** |
| BR-10 | Reset password thành công → revoke toàn bộ refresh token của user (transaction) |
| BR-11 | `forgotPassword` không tiết lộ email có tồn tại hay không — luôn trả 200 |
| BR-12 | `logout` revoke refresh token qua `updateMany WHERE token AND isRevoked=false` (idempotent) |
| BR-13 | Cleanup job xóa token đã `expiresAt < now` hoặc `isRevoked=true` và `createdAt < now - 7 ngày` |
| BR-14 | Tất cả auth endpoints (trừ logout) có `authLimiter` rate limit |
| BR-15 | `authenticate` middleware: đọc `Authorization: Bearer <token>` → `verifyAccessToken` → gắn `req.user` |

---

## 4. Token strategy

| Token | Ký bằng | TTL | Lưu ở |
|---|---|---|---|
| Access token | `JWT_SECRET` | Ngắn hạn (định nghĩa trong `token_manager`) | Client memory / header |
| Refresh token | `JWT_REFRESH_SECRET` | 7 ngày (`REFRESH_TOKEN_EXPIRES_MS`) | DB `refresh_tokens` + client |

---

## 5. Phạm vi module

**Trong phạm vi:**
- Đăng ký / đăng nhập bằng email + password
- Refresh token (rotation)
- Quên mật khẩu / đặt lại mật khẩu qua OTP email
- Đăng xuất
- Middleware `authenticate` và `authorize`

**Ngoài phạm vi:**
- OAuth (Google, Facebook) — model `OAuthAccount` tồn tại trong schema nhưng chưa có routes
- Xác thực email sau đăng ký (`emailVerified` field tồn tại nhưng chưa dùng)
- 2FA
