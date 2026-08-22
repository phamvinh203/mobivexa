# Software Requirements Specification
## Module: Auth
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Routes

| Method | Path | Auth | Rate Limit | Validator |
|---|---|---|---|---|
| POST | `/api/auth/register` | Public | `authLimiter` | `validateRegister` |
| POST | `/api/auth/login` | Public | `authLimiter` | `validateLogin` |
| POST | `/api/auth/refresh` | Public | `authLimiter` | `validateRefreshToken` |
| POST | `/api/auth/forgot-password` | Public | `authLimiter` | `validateForgotPassword` |
| POST | `/api/auth/reset-password` | Public | `authLimiter` | `validateResetPassword` |
| POST | `/api/auth/logout` | Public | — | `validateRefreshToken` |

---

## 2. Functional Requirements

### FR-01: POST /auth/register

1. Validate: email format, `fullName >= 2 ký tự`, `password >= 8 ký tự`
2. `user.findUnique WHERE email` → 409 nếu đã tồn tại
3. `hashPassword(password)` (bcrypt)
4. `user.create { email, fullName, passwordHash }`
5. Trả: `{ id, email, fullName, role, createdAt }` (không trả passwordHash)

### FR-02: POST /auth/login

1. Validate: email format, password truthy
2. `user.findUnique WHERE email`
3. `!user || !user.passwordHash` → 401 (không tiết lộ field nào sai)
4. `!user.isActive` → 403
5. `verifyPassword(password, passwordHash)` → 401 nếu sai
6. `signAccessToken(payload)` + `signRefreshToken(payload)` với `payload = { userId, email, role }`
7. `refreshToken.create { token, userId, expiresAt: now + 7d }`
8. Trả: `{ accessToken, refreshToken, user }` (user không có passwordHash, resetPasswordToken, resetPasswordExpires)

### FR-03: POST /auth/refresh

1. Validate: `refreshToken` truthy
2. `verifyRefreshToken(token)` → 401 nếu JWT invalid/expired
3. `refreshToken.findUnique WHERE token` → 401 nếu `!stored || isRevoked || expiresAt < now`
4. Tạo access + refresh token mới
5. **Transaction (atomic rotation):**
   - `refreshToken.update WHERE id=stored.id SET isRevoked=true`
   - `refreshToken.create { token: newToken, userId, expiresAt: now+7d }`
6. Trả: `{ accessToken, refreshToken }`

### FR-04: POST /auth/forgot-password

1. Validate: email format
2. `user.findUnique WHERE email` — nếu không có → **return** (không throw, không tiết lộ)
3. Tạo OTP 6 số: `String(Math.floor(100000 + Math.random() * 900000))`
4. `hashResetToken(otp)` = `SHA-256(otp)` dạng hex
5. `user.update { resetPasswordToken: hashedOtp, resetPasswordExpires: now + 15min }`
6. `sendResetPasswordEmail(email, otp)` — gửi OTP gốc qua email
7. Trả 200 (dù email không tồn tại)

### FR-05: POST /auth/reset-password

1. Validate: `otp` là 6 chữ số, `newPassword >= 8 ký tự`
2. `hashResetToken(otp)` → `user.findFirst WHERE resetPasswordToken=hash AND resetPasswordExpires > now`
3. `!user` → 400 "Token không hợp lệ hoặc đã hết hạn"
4. `hashPassword(newPassword)`
5. **Transaction:**
   - `user.update { passwordHash, resetPasswordToken: null, resetPasswordExpires: null }`
   - `refreshToken.updateMany WHERE userId AND isRevoked=false SET isRevoked=true`
6. Trả 200

### FR-06: POST /auth/logout

1. Validate: `refreshToken` truthy
2. `refreshToken.updateMany WHERE token AND isRevoked=false SET isRevoked=true`
3. Idempotent: token đã revoke → count=0, không lỗi
4. Trả 200

---

## 3. Middleware

### authenticate
```typescript
// Đọc header Authorization: Bearer <token>
// verifyAccessToken(token) → req.user = { userId, email, role }
// Không có header → 401 "Không có token xác thực"
// Token invalid/expired → 401 "Token không hợp lệ hoặc đã hết hạn"
```

### authorize(...roles)
```typescript
// Kiểm tra req.user.role ∈ roles
// Sai role → 403
```

### STAFF_ROLES
```typescript
export const STAFF_ROLES = [UserRole.ADMIN, UserRole.STAFF]
```

---

## 4. Validation

| Validator | Rules |
|---|---|
| `validateRegister` | email: `EMAIL_RE`; fullName: trim >= 2; password: length >= 8 |
| `validateLogin` | email: `EMAIL_RE`; password: truthy |
| `validateForgotPassword` | email: `EMAIL_RE` |
| `validateResetPassword` | otp: `/^\d{6}$/`; newPassword: length >= 8 |
| `validateRefreshToken` | `req.body.refreshToken` truthy |

---

## 5. Constants & Utilities

| Hằng / Hàm | Giá trị / Mô tả |
|---|---|
| `RESET_TOKEN_EXPIRES_MS` | `15 * 60 * 1000` (15 phút) |
| `REFRESH_TOKEN_EXPIRES_MS` | `7 * 24 * 60 * 60 * 1000` (7 ngày) |
| `EMAIL_RE` | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| `hashResetToken(token)` | `SHA-256(token).hex` |
| `hashPassword(password)` | bcrypt hash |
| `verifyPassword(plain, hash)` | bcrypt compare |
| `signAccessToken(payload)` | JWT sign với `JWT_SECRET` |
| `signRefreshToken(payload)` | JWT sign với `JWT_REFRESH_SECRET` |
| `verifyAccessToken(token)` | JWT verify với `JWT_SECRET` |
| `verifyRefreshToken(token)` | JWT verify với `JWT_REFRESH_SECRET` |

---

## 6. cleanupExpiredTokens

Xóa các RefreshToken:
- `expiresAt < now` (đã hết hạn)
- `isRevoked = true AND createdAt < now - 7 ngày`

Được gọi định kỳ (cron job hoặc startup). Không expose qua HTTP route.
