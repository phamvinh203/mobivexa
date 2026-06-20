# API Specification — Request / Response
## Module: Brand
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> **Base URL:** `http://localhost:3000/api`

---

## Tổng quan Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/brands` | Danh sách brand active | ❌ Public |
| GET | `/brands/:slug` | Chi tiết brand | ❌ Public |
| GET | `/admin/brands` | Danh sách tất cả brand | ✅ STAFF+ |
| POST | `/admin/brands` | Tạo brand mới | ✅ STAFF+ |
| PUT | `/admin/brands/:id` | Cập nhật brand | ✅ STAFF+ |
| DELETE | `/admin/brands/:id` | Xóa brand | ✅ STAFF+ |
| PATCH | `/admin/brands/:id/status` | Toggle trạng thái | ✅ STAFF+ |

---

## GET `/brands`

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "brands": [
      {
        "id":           "brand_apple",
        "name":         "Apple",
        "slug":         "apple",
        "description":  "Thương hiệu công nghệ hàng đầu của Mỹ",
        "logoUrl":      "https://res.cloudinary.com/.../brands/apple.webp",
        "logoPublicId": "brands/apple_abc123",
        "isActive":     true,
        "createdAt":    "2026-01-01T00:00:00.000Z",
        "updatedAt":    "2026-06-01T00:00:00.000Z"
      },
      {
        "id":    "brand_samsung",
        "name":  "Samsung",
        "slug":  "samsung",
        "..."
      }
    ]
  }
}
```

> Sắp xếp A→Z theo `name`. Chỉ brand `isActive = true`.

---

## GET `/brands/:slug`

### Request
```http
GET /api/brands/apple
```

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "brand": {
      "id":          "brand_apple",
      "name":        "Apple",
      "slug":        "apple",
      "description": "Thương hiệu công nghệ hàng đầu của Mỹ",
      "logoUrl":     "https://res.cloudinary.com/.../brands/apple.webp",
      "isActive":    true,
      "createdAt":   "2026-01-01T00:00:00.000Z",
      "updatedAt":   "2026-06-01T00:00:00.000Z"
    }
  }
}
```

**404:**
```json
{ "success": false, "message": "Thương hiệu không tồn tại" }
```

---

## GET `/admin/brands`

### Request
```http
GET /api/admin/brands
Authorization: Bearer <token>
```

### Response

**200 OK:** Giống `/brands` nhưng bao gồm brand `isActive = false`.

---

## POST `/admin/brands`

### Request
```http
POST /api/admin/brands
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form fields:**

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| `name` | string | ✅ | ≥ 2 ký tự sau trim |
| `slug` | string | ❌ | Tự sinh từ name nếu không gửi |
| `description` | string | ❌ | |
| `isActive` | string/boolean | ❌ | Default `true` |
| `logo` | file | ❌ | JPEG/PNG/WebP ≤ 5MB |

**Ví dụ request (multipart):**
```
name=Xiaomi
description=Thương hiệu điện thoại Trung Quốc
isActive=true
logo=[file binary]
```

### Response

**201 Created:**
```json
{
  "success": true,
  "data": {
    "message": "Tạo thương hiệu thành công",
    "brand": {
      "id":           "brand_xiaomi",
      "name":         "Xiaomi",
      "slug":         "xiaomi",
      "description":  "Thương hiệu điện thoại Trung Quốc",
      "logoUrl":      "https://res.cloudinary.com/.../brands/xiaomi_xyz.webp",
      "logoPublicId": "brands/xiaomi_xyz",
      "isActive":     true,
      "createdAt":    "2026-06-19T10:00:00.000Z",
      "updatedAt":    "2026-06-19T10:00:00.000Z"
    }
  }
}
```

**400:**
```json
{ "success": false, "message": "Tên thương hiệu phải có ít nhất 2 ký tự" }
```

**409:**
```json
{ "success": false, "message": "Tên thương hiệu đã tồn tại" }
```

---

## PUT `/admin/brands/:id`

### Request
```http
PUT /api/admin/brands/brand_apple
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form fields:** Giống POST nhưng tất cả optional. Không gửi trường nào → chỉ cập nhật timestamp.

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "message": "Cập nhật thương hiệu thành công",
    "brand": { "..." }
  }
}
```

**404:**
```json
{ "success": false, "message": "Thương hiệu không tồn tại" }
```

**409:**
```json
{ "success": false, "message": "Tên thương hiệu đã tồn tại" }
```

---

## DELETE `/admin/brands/:id`

### Response

**200 OK:**
```json
{ "success": true, "data": { "message": "Xóa thương hiệu thành công" } }
```

**404:**
```json
{ "success": false, "message": "Thương hiệu không tồn tại" }
```

**409 — Brand còn sản phẩm:**
```json
{ "success": false, "message": "Không thể xóa: thương hiệu còn chứa sản phẩm" }
```

---

## PATCH `/admin/brands/:id/status`

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "message": "Cập nhật trạng thái thành công",
    "brand": {
      "id":       "brand_apple",
      "name":     "Apple",
      "isActive": false,
      "..."
    }
  }
}
```

**404:**
```json
{ "success": false, "message": "Thương hiệu không tồn tại" }
```

---

## Slug Generation — Ví dụ

| `name` nhập vào | Slug sinh ra | Ghi chú |
|---|---|---|
| `"Apple"` | `apple` | |
| `"Apple Inc"` | `apple-inc` | |
| `"Nguyễn & Phát"` | `nguyen-phat` | Bỏ dấu VN + ký tự đặc biệt |
| `"Apple"` (đã có) | `apple-1` | Thêm hậu tố |
| `"Apple"` (đã có `-1`) | `apple-2` | Tăng counter |

---

## Mã lỗi tổng hợp

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 400 | Validate thất bại |
| 401 | Chưa xác thực |
| 403 | Không đủ quyền |
| 404 | Brand không tồn tại |
| 409 | Trùng tên / Brand còn sản phẩm |
| 500 | Lỗi server (upload Cloudinary...) |
