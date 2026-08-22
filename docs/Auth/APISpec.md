# API Specification
## Module: Auth
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22  
> **Base URL:** `/api/auth`  
> **Rate Limit:** `authLimiter` áp dụng cho tất cả route trừ `/logout`

---

### POST /api/auth/register

**Rate limit:** authLimiter

**Body:**
```json
{
  "email": "user@example.com",
  "fullName": "Nguyễn Văn A",
  "password": "secret123"
}
```

**Validate:** email format; fullName trim >= 2; password length >= 8

**Response 200:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "fullName": "Nguyễn Văn A",
  "role": "CUSTOMER",
  "createdAt": "2026-08-22T08:00:00.000Z"
}
```

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Validation lỗi |
| 409 | Email đã được sử dụng |

---

### POST /api/auth/login

**Rate limit:** authLimiter

**Body:**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "role": "CUSTOMER",
    "isActive": true,
    "avatarUrl": null
  }
}
```

> `user` không bao gồm: `passwordHash`, `resetPasswordToken`, `resetPasswordExpires`

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Validation lỗi |
| 401 | Email/password không đúng (cùng message dù sai field nào) |
| 403 | Tài khoản bị vô hiệu hóa |

---

### POST /api/auth/refresh

**Rate limit:** authLimiter

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5..."
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5..."
}
```

> Token cũ bị revoke; token mới tạo ra (rotation)

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | `refreshToken` thiếu |
| 401 | JWT invalid / token đã revoke / đã hết hạn |

---

### POST /api/auth/forgot-password

**Rate limit:** authLimiter

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response 200:** `{ message: "..." }` (luôn 200 dù email không tồn tại)

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | email không đúng format |

---

### POST /api/auth/reset-password

**Rate limit:** authLimiter

**Body:**
```json
{
  "otp": "123456",
  "newPassword": "newSecret123"
}
```

**Validate:** `otp` khớp `/^\d{6}$/`; `newPassword` length >= 8

**Response 200:** `{ message: "..." }`

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Validation lỗi |
| 400 | OTP sai / hết hạn (> 15 phút) |

---

### POST /api/auth/logout

**Rate limit:** — (không có)

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5..."
}
```

**Response 200:** `{ message: "..." }`

> Idempotent: gọi lại với token đã revoke vẫn trả 200

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | `refreshToken` thiếu |

---

## Headers xác thực (protected routes)

```
Authorization: Bearer <accessToken>
```

`authenticate` middleware verify access token và gắn `req.user = { userId, email, role }` vào request.
