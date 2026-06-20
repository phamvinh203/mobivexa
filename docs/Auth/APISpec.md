# API Specification — Request / Response
## Module: Authentication
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Base URL:** `http://localhost:3000/api` (development)  
> **Content-Type:** `application/json`  
> **Rate Limit:** 10 requests / 15 phút / IP (áp dụng cho register, login, refresh, forgot-password, reset-password)

---

## Tổng quan Endpoints

| Method | Path | Mô tả | Rate Limit | Auth |
|---|---|---|---|---|
| POST | `/auth/register` | Đăng ký tài khoản | ✅ | ❌ |
| POST | `/auth/login` | Đăng nhập | ✅ | ❌ |
| POST | `/auth/refresh` | Làm mới token | ✅ | ❌ |
| POST | `/auth/forgot-password` | Yêu cầu OTP | ✅ | ❌ |
| POST | `/auth/reset-password` | Đặt lại mật khẩu | ✅ | ❌ |
| POST | `/auth/logout` | Đăng xuất | ❌ | ❌ (dùng refreshToken) |

---

## POST `/auth/register`

### Request

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email":    "nguyenvan@example.com",
  "fullName": "Nguyễn Văn A",
  "password": "matkhau123",
  "phone":    "0901234567"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `email` | string | ✅ | Format email hợp lệ |
| `fullName` | string | ✅ | ≥ 2 ký tự sau trim |
| `password` | string | ✅ | ≥ 8 ký tự |
| `phone` | string | ❌ | Bất kỳ |

### Response

**201 Created — Thành công:**
```json
{
  "success": true,
  "data": {
    "id":        "clx1abc123",
    "email":     "nguyenvan@example.com",
    "fullName":  "Nguyễn Văn A",
    "role":      "CUSTOMER",
    "createdAt": "2026-06-19T08:00:00.000Z"
  }
}
```

**400 Bad Request:**
```json
{ "success": false, "message": "Email không hợp lệ" }
{ "success": false, "message": "Họ tên phải có ít nhất 2 ký tự" }
{ "success": false, "message": "Mật khẩu phải có ít nhất 8 ký tự" }
```

**409 Conflict:**
```json
{ "success": false, "message": "Email đã được sử dụng" }
```

**429 Too Many Requests:**
```json
{ "message": "Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút" }
```

---

## POST `/auth/login`

### Request

**Body:**
```json
{
  "email":    "nguyenvan@example.com",
  "password": "matkhau123"
}
```

| Field | Type | Required |
|---|---|---|
| `email` | string | ✅ |
| `password` | string | ✅ |

### Response

**200 OK — Thành công:**
```json
{
  "success": true,
  "data": {
    "accessToken":  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id":        "clx1abc123",
      "email":     "nguyenvan@example.com",
      "fullName":  "Nguyễn Văn A",
      "role":      "CUSTOMER",
      "isActive":  true,
      "avatarUrl": null,
      "phone":     "0901234567",
      "createdAt": "2026-06-19T08:00:00.000Z",
      "updatedAt": "2026-06-19T08:00:00.000Z"
    }
  }
}
```

**400 Bad Request:**
```json
{ "success": false, "message": "Email không hợp lệ" }
{ "success": false, "message": "Vui lòng nhập mật khẩu" }
```

**401 Unauthorized:**
```json
{ "success": false, "message": "Email hoặc mật khẩu không đúng" }
```

**403 Forbidden:**
```json
{ "success": false, "message": "Tài khoản đã bị khóa" }
```

**Token Structure (JWT Payload):**
```json
{
  "userId": "clx1abc123",
  "email":  "nguyenvan@example.com",
  "role":   "CUSTOMER",
  "iat":    1750320000,
  "exp":    1750320900
}
```

---

## POST `/auth/refresh`

### Request

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Type | Required |
|---|---|---|
| `refreshToken` | string | ✅ |

### Response

**200 OK — Thành công:**
```json
{
  "success": true,
  "data": {
    "accessToken":  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

> Cả `accessToken` và `refreshToken` đều là token **mới**. Token cũ đã bị revoke.

**400 Bad Request:**
```json
{ "success": false, "message": "Thiếu refresh token" }
```

**401 Unauthorized:**
```json
{ "success": false, "message": "Refresh token không hợp lệ hoặc đã hết hạn" }
{ "success": false, "message": "Refresh token không hợp lệ" }
```

---

## POST `/auth/forgot-password`

### Request

**Body:**
```json
{
  "email": "nguyenvan@example.com"
}
```

| Field | Type | Required |
|---|---|---|
| `email` | string | ✅ |

### Response

**200 OK — Luôn trả về (dù email có tồn tại hay không):**
```json
{
  "success": true,
  "data": null
}
```

> **Bảo mật:** Response 200 không thay đổi dù email có trong hệ thống hay không. Mục đích: ngăn attacker liệt kê email.

**400 Bad Request:**
```json
{ "success": false, "message": "Email không hợp lệ" }
```

**Email gửi đến người dùng:**
```
Subject: Đặt lại mật khẩu Mobivexa
Body: Mã OTP của bạn là: 382941
      Mã này có hiệu lực trong 15 phút.
```

---

## POST `/auth/reset-password`

### Request

**Body:**
```json
{
  "otp":         "382941",
  "newPassword": "matkhaumoI123"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `otp` | string | ✅ | Đúng 6 chữ số (`/^\d{6}$/`) |
| `newPassword` | string | ✅ | ≥ 8 ký tự |

### Response

**200 OK — Thành công:**
```json
{
  "success": true,
  "data": { "message": "Đặt lại mật khẩu thành công" }
}
```

**400 Bad Request:**
```json
{ "success": false, "message": "OTP phải là 6 chữ số" }
{ "success": false, "message": "Mật khẩu mới phải có ít nhất 8 ký tự" }
{ "success": false, "message": "Token không hợp lệ hoặc đã hết hạn" }
```

---

## POST `/auth/logout`

### Request

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Type | Required |
|---|---|---|
| `refreshToken` | string | ✅ |

### Response

**200 OK:**
```json
{
  "success": true,
  "data": { "message": "Đăng xuất thành công" }
}
```

**400 Bad Request:**
```json
{ "success": false, "message": "Thiếu refresh token" }
```

---

## Cách dùng Access Token trong các API khác

Sau khi đăng nhập hoặc refresh, đính kèm `accessToken` vào header của mọi request đến protected route:

```http
GET /api/users/me HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Mã lỗi tổng hợp

| HTTP Code | Ý nghĩa |
|---|---|
| `200` | Thành công |
| `201` | Tạo mới thành công |
| `400` | Dữ liệu đầu vào không hợp lệ |
| `401` | Chưa xác thực / Token không hợp lệ |
| `403` | Tài khoản bị khóa / Không có quyền |
| `409` | Conflict — email đã tồn tại |
| `429` | Vượt rate limit |
| `500` | Lỗi server nội bộ |

---

## Lưu ý tích hợp (Integration Notes)

| Tình huống | Xử lý khuyến nghị |
|---|---|
| Nhận `401` khi gọi protected API | Tự động gọi `POST /refresh` → retry request gốc |
| Nhận `401` khi refresh | Đưa user về màn hình đăng nhập |
| Lưu token | `accessToken` trong memory; `refreshToken` trong HttpOnly cookie hoặc secure storage |
| Multiple tabs | Refresh Token Rotation đảm bảo chỉ 1 token mới valid — các tab khác cần refresh lại |
