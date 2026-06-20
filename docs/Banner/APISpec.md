# API Specification — Request / Response
## Module: Banner
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> **Base URL:** `http://localhost:3000/api`

---

## Tổng quan Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/banners` | Danh sách banner active | ❌ Public |
| GET | `/banners/positions` | Danh sách vị trí hợp lệ | ❌ Public |
| GET | `/admin/banners` | Danh sách tất cả banner | ✅ STAFF+ |
| GET | `/admin/banners/positions` | Danh sách vị trí hợp lệ | ✅ STAFF+ |
| POST | `/admin/banners` | Tạo banner | ✅ STAFF+ |
| PUT | `/admin/banners/:id` | Cập nhật banner | ✅ STAFF+ |
| DELETE | `/admin/banners/:id` | Xóa banner | ✅ STAFF+ |
| PATCH | `/admin/banners/:id/status` | Toggle trạng thái | ✅ STAFF+ |

---

## GET `/banners`

### Query Params

| Param | Giá trị | Ghi chú |
|---|---|---|
| `position` | `HERO \| LEFT \| RIGHT \| HORIZONTAL` | Optional — không gửi → trả tất cả vị trí |

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "banners": [
      {
        "id":            "banner-hero-1",
        "imageUrl":      "https://res.cloudinary.com/.../banners/hero1.webp",
        "imagePublicId": "banners/hero1_abc123",
        "alt":           "Sale 50% điện thoại tháng 6",
        "href":          "/products?sale=true",
        "description":   "Banner khuyến mãi tháng 6",
        "position":      "HERO",
        "isActive":      true,
        "sortOrder":     0,
        "createdAt":     "2026-06-01T00:00:00.000Z",
        "updatedAt":     "2026-06-15T00:00:00.000Z"
      }
    ]
  }
}
```

---

## GET `/banners/positions`

**200 OK:**
```json
{
  "success": true,
  "data": {
    "positions": [
      { "value": "HERO",       "label": "Banner chính (full-width đầu trang)" },
      { "value": "LEFT",       "label": "Banner bên trái" },
      { "value": "RIGHT",      "label": "Banner bên phải" },
      { "value": "HORIZONTAL", "label": "Banner ngang dài" }
    ]
  }
}
```

> Response tĩnh — không query DB.

---

## POST `/admin/banners`

### Request
```http
POST /api/admin/banners
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form fields:**

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| `image` | file | ✅ | JPEG/PNG/WebP ≤ 5MB |
| `alt` | string | ✅ | ≥ 2 ký tự |
| `position` | string | ✅ | `HERO \| LEFT \| RIGHT \| HORIZONTAL` |
| `href` | string | ❌ | Default `/products` nếu không gửi/rỗng |
| `description` | string | ❌ | |
| `isActive` | string/boolean | ❌ | Default `true` |
| `sortOrder` | number | ❌ | Default `0` |

### Response

**201 Created:**
```json
{
  "success": true,
  "data": {
    "message": "Tạo banner thành công",
    "banner": {
      "id":            "banner-hero-1",
      "imageUrl":      "https://res.cloudinary.com/.../banners/hero1.webp",
      "imagePublicId": "banners/hero1_abc123",
      "alt":           "Sale 50% điện thoại tháng 6",
      "href":          "/products?sale=true",
      "description":   null,
      "position":      "HERO",
      "isActive":      true,
      "sortOrder":     0,
      "createdAt":     "2026-06-19T10:00:00.000Z",
      "updatedAt":     "2026-06-19T10:00:00.000Z"
    }
  }
}
```

**400 — thiếu file:**
```json
{ "success": false, "message": "Ảnh banner là bắt buộc" }
```

**400 — position sai:**
```json
{ "success": false, "message": "Vị trí banner không hợp lệ. Các giá trị hợp lệ: HERO, LEFT, RIGHT, HORIZONTAL" }
```

---

## PUT `/admin/banners/:id`

Tất cả field đều optional. Chỉ gửi field cần thay đổi.

**200 OK:**
```json
{
  "success": true,
  "data": {
    "message": "Cập nhật banner thành công",
    "banner": { "..." }
  }
}
```

**404:** `{ "success": false, "message": "Banner không tồn tại" }`

---

## DELETE `/admin/banners/:id`

**200 OK:**
```json
{ "success": true, "data": { "message": "Xóa banner thành công" } }
```

**404:** `{ "success": false, "message": "Banner không tồn tại" }`

---

## PATCH `/admin/banners/:id/status`

**200 OK:**
```json
{
  "success": true,
  "data": {
    "message": "Cập nhật trạng thái thành công",
    "banner": { "id": "...", "isActive": false, "..." }
  }
}
```

---

## Mã lỗi tổng hợp

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 400 | Thiếu file / alt / position sai enum |
| 401 | Chưa xác thực |
| 403 | Không đủ quyền |
| 404 | Banner không tồn tại |
| 500 | Lỗi server / rollback Cloudinary |

---

## `href` Default Behavior

| Gửi `href` | Lưu vào DB |
|---|---|
| Không gửi | `/products` |
| Gửi `""` (rỗng) | `/products` |
| Gửi `"/sale"` | `/sale` |
| Gửi `"/products?brand=apple"` | `/products?brand=apple` |
