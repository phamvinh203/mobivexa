# API Specification — Request / Response
## Module: User
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> **Base URL:** `http://localhost:3000/api`  
> **Auth:** Tất cả endpoint yêu cầu `Authorization: Bearer <accessToken>`

---

## Tổng quan Endpoints

| Method | Path | Mô tả | Rate Limit |
|---|---|---|---|
| GET | `/users/me` | Xem hồ sơ | — |
| PUT | `/users/me` | Cập nhật hồ sơ | — |
| PUT | `/users/me/password` | Đổi mật khẩu | — |
| POST | `/users/me/avatar` | Upload ảnh đại diện | 10/giờ |
| GET | `/users/me/addresses` | Danh sách địa chỉ | — |
| POST | `/users/me/addresses` | Thêm địa chỉ | — |
| PUT | `/users/me/addresses/:id` | Sửa địa chỉ | — |
| DELETE | `/users/me/addresses/:id` | Xóa địa chỉ | — |
| PATCH | `/users/me/addresses/:id/default` | Đặt mặc định | — |

---

## GET `/users/me`

### Request
```http
GET /api/users/me
Authorization: Bearer eyJhbGci...
```

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "id":            "clx1abc123",
    "email":         "nguyenvan@example.com",
    "fullName":      "Nguyễn Văn A",
    "phone":         "0901234567",
    "avatarUrl":     "https://res.cloudinary.com/.../user_clx1abc123.webp",
    "role":          "CUSTOMER",
    "isActive":      true,
    "emailVerified": false,
    "createdAt":     "2026-06-01T08:00:00.000Z",
    "updatedAt":     "2026-06-19T10:00:00.000Z"
  }
}
```

**401 — Token không hợp lệ:**
```json
{ "success": false, "message": "Token không hợp lệ hoặc đã hết hạn" }
```

---

## PUT `/users/me`

### Request
```http
PUT /api/users/me
Authorization: Bearer eyJhbGci...
Content-Type: application/json
```

**Body (ít nhất 1 trường):**
```json
{
  "fullName": "Nguyễn Văn B",
  "phone":    "0912345678"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `fullName` | string | ❌ | ≥ 2 ký tự sau trim |
| `phone` | string | ❌ | Regex VN; `""` để xóa |

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "id":       "clx1abc123",
    "email":    "nguyenvan@example.com",
    "fullName": "Nguyễn Văn B",
    "phone":    "0912345678",
    "avatarUrl": null,
    "role":     "CUSTOMER",
    "isActive": true,
    "emailVerified": false,
    "createdAt": "2026-06-01T08:00:00.000Z",
    "updatedAt": "2026-06-19T10:05:00.000Z"
  }
}
```

**400:**
```json
{ "success": false, "message": "Vui lòng cung cấp ít nhất một trường cần cập nhật" }
{ "success": false, "message": "Họ tên phải có ít nhất 2 ký tự" }
{ "success": false, "message": "Số điện thoại không hợp lệ" }
```

**409:**
```json
{ "success": false, "message": "Số điện thoại đã được sử dụng" }
```

---

## PUT `/users/me/password`

### Request
```json
{
  "currentPassword": "oldpassword123",
  "newPassword":     "newpassword456"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `currentPassword` | string | ✅ | Phải nhập |
| `newPassword` | string | ✅ | ≥ 8 ký tự; khác `currentPassword` |

### Response

**200 OK:**
```json
{ "success": true, "data": { "message": "Đổi mật khẩu thành công" } }
```

**400:**
```json
{ "success": false, "message": "Vui lòng nhập mật khẩu hiện tại" }
{ "success": false, "message": "Mật khẩu mới phải có ít nhất 8 ký tự" }
{ "success": false, "message": "Mật khẩu mới phải khác mật khẩu hiện tại" }
{ "success": false, "message": "Mật khẩu hiện tại không đúng" }
{ "success": false, "message": "Tài khoản không dùng mật khẩu" }
```

---

## POST `/users/me/avatar`

### Request
```http
POST /api/users/me/avatar
Authorization: Bearer eyJhbGci...
Content-Type: multipart/form-data

avatar: <file>
```

| Field | Yêu cầu |
|---|---|
| Field name | `avatar` |
| Định dạng | JPEG, JPG, PNG, WebP |
| Kích thước | ≤ 5 MB |

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "avatarUrl":      "https://res.cloudinary.com/demo/image/upload/users/avatars/user_clx1abc123.webp",
    "avatarPublicId": "users/avatars/user_clx1abc123"
  }
}
```

**400:**
```json
{ "success": false, "message": "Không có file ảnh" }
{ "success": false, "message": "Chỉ chấp nhận file ảnh (jpg, png, webp)" }
{ "success": false, "message": "Kích thước file tối đa là 5MB" }
```

**429:**
```json
{ "message": "Quá nhiều lần upload ảnh, vui lòng thử lại sau 1 giờ" }
```

---

## GET `/users/me/addresses`

### Response

**200 OK:**
```json
{
  "success": true,
  "data": [
    {
      "id":           "addr_001",
      "userId":       "clx1abc123",
      "fullName":     "Nguyễn Văn A",
      "phone":        "0901234567",
      "province":     "Hà Nội",
      "district":     "Cầu Giấy",
      "ward":         "Dịch Vọng",
      "streetDetail": "Số 1 Đường ABC",
      "isDefault":    true,
      "createdAt":    "2026-06-01T08:00:00.000Z",
      "updatedAt":    "2026-06-01T08:00:00.000Z"
    },
    {
      "id":           "addr_002",
      "isDefault":    false,
      "..."
    }
  ]
}
```

> Địa chỉ có `isDefault: true` luôn đứng đầu danh sách.

---

## POST `/users/me/addresses`

### Request
```json
{
  "fullName":     "Nguyễn Văn A",
  "phone":        "0901234567",
  "province":     "Hà Nội",
  "district":     "Cầu Giấy",
  "ward":         "Dịch Vọng",
  "streetDetail": "Số 1 Đường ABC",
  "isDefault":    true
}
```

| Field | Required | Validation |
|---|---|---|
| `fullName` | ✅ | ≥ 2 ký tự |
| `phone` | ✅ | Regex VN |
| `province` | ✅ | Không rỗng |
| `district` | ✅ | Không rỗng |
| `ward` | ✅ | Không rỗng |
| `streetDetail` | ✅ | Không rỗng |
| `isDefault` | ❌ | boolean, default false |

### Response

**201 Created:**
```json
{
  "success": true,
  "data": {
    "id":        "addr_003",
    "userId":    "clx1abc123",
    "fullName":  "Nguyễn Văn A",
    "phone":     "0901234567",
    "province":  "Hà Nội",
    "district":  "Cầu Giấy",
    "ward":      "Dịch Vọng",
    "streetDetail": "Số 1 Đường ABC",
    "isDefault": true,
    "createdAt": "2026-06-19T10:00:00.000Z",
    "updatedAt": "2026-06-19T10:00:00.000Z"
  }
}
```

---

## PUT `/users/me/addresses/:id`

Giống POST nhưng method PUT, không có `201`, trả `200` + địa chỉ đã cập nhật.

**404:**
```json
{ "success": false, "message": "Địa chỉ không tồn tại" }
```

---

## DELETE `/users/me/addresses/:id`

### Response

**200 OK:**
```json
{ "success": true, "data": { "message": "Xóa địa chỉ thành công" } }
```

**404:**
```json
{ "success": false, "message": "Địa chỉ không tồn tại" }
```

---

## PATCH `/users/me/addresses/:id/default`

### Response

**200 OK:**
```json
{ "success": true, "data": { "message": "Đặt địa chỉ mặc định thành công" } }
```

**404:**
```json
{ "success": false, "message": "Địa chỉ không tồn tại" }
```

---

## Mã lỗi tổng hợp

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 400 | Validate thất bại |
| 401 | Chưa xác thực / token không hợp lệ |
| 404 | Không tìm thấy tài nguyên / không thuộc user |
| 409 | Conflict (số điện thoại trùng) |
| 429 | Vượt rate limit |
| 500 | Lỗi server |
