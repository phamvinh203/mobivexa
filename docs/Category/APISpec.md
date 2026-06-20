# API Specification — Request / Response
## Module: Category
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> **Base URL:** `http://localhost:3000/api`

---

## Tổng quan Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/categories` | Danh sách category active | ❌ Public |
| GET | `/categories/:slug` | Chi tiết + children | ❌ Public |
| GET | `/admin/categories` | Danh sách tất cả | ✅ STAFF+ |
| POST | `/admin/categories` | Tạo category | ✅ STAFF+ |
| PUT | `/admin/categories/:id` | Cập nhật category | ✅ STAFF+ |
| DELETE | `/admin/categories/:id` | Xóa category | ✅ STAFF+ |
| PATCH | `/admin/categories/:id/status` | Toggle trạng thái | ✅ STAFF+ |

---

## GET `/categories`

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id":           "cat-dien-thoai",
        "name":         "Điện thoại",
        "slug":         "dien-thoai",
        "description":  "Các loại điện thoại thông minh",
        "imageUrl":     "https://res.cloudinary.com/.../categories/dien-thoai.webp",
        "imagePublicId":"categories/dien-thoai_abc",
        "parentId":     null,
        "sortOrder":    1,
        "isActive":     true,
        "createdAt":    "2026-01-01T00:00:00.000Z",
        "updatedAt":    "2026-06-01T00:00:00.000Z"
      },
      {
        "id":       "cat-iphone",
        "name":     "iPhone",
        "slug":     "iphone",
        "parentId": "cat-dien-thoai",
        "sortOrder": 1,
        "isActive":  true,
        "..."
      }
    ]
  }
}
```

> Flat list. Sắp `sortOrder ASC → name ASC`. Chỉ `isActive = true`.

---

## GET `/categories/:slug`

### Request
```http
GET /api/categories/dien-thoai
```

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "category": {
      "id":          "cat-dien-thoai",
      "name":        "Điện thoại",
      "slug":        "dien-thoai",
      "description": "Các loại điện thoại thông minh",
      "imageUrl":    "https://res.cloudinary.com/.../categories/dien-thoai.webp",
      "parentId":    null,
      "sortOrder":   1,
      "isActive":    true,
      "children": [
        {
          "id":        "cat-iphone",
          "name":      "iPhone",
          "slug":      "iphone",
          "sortOrder": 1,
          "isActive":  true,
          "..."
        },
        {
          "id":        "cat-samsung",
          "name":      "Samsung Galaxy",
          "slug":      "samsung-galaxy",
          "sortOrder": 2,
          "isActive":  true
        }
      ],
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-06-01T00:00:00.000Z"
    }
  }
}
```

> `children` chỉ gồm sub-categories `isActive = true`, sắp theo `sortOrder`.

**404:**
```json
{ "success": false, "message": "Danh mục không tồn tại" }
```

---

## GET `/admin/categories`

### Request
```http
GET /api/admin/categories
Authorization: Bearer <token>
```

**200 OK:** Giống `/categories` nhưng bao gồm cả `isActive = false`.

---

## POST `/admin/categories`

### Request
```http
POST /api/admin/categories
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form fields:**

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| `name` | string | ✅ | ≥ 2 ký tự sau trim |
| `slug` | string | ❌ | Tự sinh từ name nếu không gửi |
| `description` | string | ❌ | |
| `parentId` | string | ❌ | ID category cha hợp lệ |
| `sortOrder` | number | ❌ | Default `0` |
| `isActive` | string/boolean | ❌ | Default `true` |
| `image` | file | ❌ | JPEG/PNG/WebP ≤ 5MB |

**Ví dụ: Tạo danh mục cha**
```
name=Điện thoại
description=Các loại điện thoại thông minh
sortOrder=1
isActive=true
image=[file binary]
```

**Ví dụ: Tạo danh mục con**
```
name=iPhone
parentId=cat-dien-thoai
sortOrder=1
```

### Response

**201 Created:**
```json
{
  "success": true,
  "data": {
    "message": "Tạo danh mục thành công",
    "category": {
      "id":          "cat-iphone",
      "name":        "iPhone",
      "slug":        "iphone",
      "description": null,
      "imageUrl":    null,
      "parentId":    "cat-dien-thoai",
      "sortOrder":   1,
      "isActive":    true,
      "createdAt":   "2026-06-19T10:00:00.000Z",
      "updatedAt":   "2026-06-19T10:00:00.000Z"
    }
  }
}
```

**400 — name quá ngắn:**
```json
{ "success": false, "message": "Tên danh mục phải có ít nhất 2 ký tự" }
```

**400 — parentId không tồn tại:**
```json
{ "success": false, "message": "Danh mục cha không tồn tại" }
```

---

## PUT `/admin/categories/:id`

### Request
```http
PUT /api/admin/categories/cat-iphone
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Tất cả field đều optional. Chỉ gửi field cần thay đổi.

**Ví dụ: Đổi sortOrder**
```
sortOrder=3
```

**Ví dụ: Di chuyển sang parent khác**
```
parentId=cat-phu-kien
```

**Ví dụ: Tách thành root category (bỏ parent)**
```
parentId=
```
> Gửi `parentId` rỗng để set `null` (tùy implementation xử lý form-data)

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "message": "Cập nhật danh mục thành công",
    "category": { "..." }
  }
}
```

**400 — Self-parent:**
```json
{ "success": false, "message": "Danh mục không thể là cha của chính nó" }
```

**404:**
```json
{ "success": false, "message": "Danh mục không tồn tại" }
```

---

## DELETE `/admin/categories/:id`

### Response

**200 OK:**
```json
{ "success": true, "data": { "message": "Xóa danh mục thành công" } }
```

**404:**
```json
{ "success": false, "message": "Danh mục không tồn tại" }
```

**409 — Còn danh mục con:**
```json
{ "success": false, "message": "Không thể xóa: danh mục còn chứa danh mục con" }
```

**409 — Còn sản phẩm:**
```json
{ "success": false, "message": "Không thể xóa: danh mục còn chứa sản phẩm" }
```

---

## PATCH `/admin/categories/:id/status`

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "message": "Cập nhật trạng thái thành công",
    "category": {
      "id":       "cat-dien-thoai",
      "name":     "Điện thoại",
      "isActive": false,
      "..."
    }
  }
}
```

---

## Mã lỗi tổng hợp

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 400 | Validate thất bại / parentId không hợp lệ / self-parent |
| 401 | Chưa xác thực |
| 403 | Không đủ quyền |
| 404 | Category không tồn tại |
| 409 | Còn category con / còn sản phẩm |
| 500 | Lỗi server |

---

## Ví dụ Slug Generation

| `name` nhập vào | Slug sinh ra | Ghi chú |
|---|---|---|
| `"Điện thoại"` | `dien-thoai` | Bỏ dấu tiếng Việt |
| `"Phụ kiện & Sạc"` | `phu-kien-sac` | Bỏ ký tự đặc biệt |
| `"iPhone"` | `iphone` | |
| `"iPhone"` (đã có) | `iphone-1` | Thêm hậu tố |
| `"  Samsung  "` | `samsung` | Trim whitespace |
