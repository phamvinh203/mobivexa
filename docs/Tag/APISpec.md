# API Specification — Request / Response
## Module: Tag
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> **Base URL:** `http://localhost:3000/api`

---

## Tổng quan Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/tags` | Danh sách tất cả tag | ❌ Public |
| GET | `/admin/tags` | Danh sách tất cả tag | ✅ STAFF+ |
| POST | `/admin/tags` | Tạo tag mới | ✅ STAFF+ |
| DELETE | `/admin/tags/:id` | Xóa tag | ✅ STAFF+ |

> Public và Admin list tag dùng cùng một handler — response giống nhau.

---

## GET `/tags` và GET `/admin/tags`

### Response

**200 OK:**
```json
{
  "success": true,
  "data": {
    "tags": [
      {
        "id":   "tag-5g",
        "name": "5G",
        "slug": "5g",
        "_count": {
          "productTags": 12
        }
      },
      {
        "id":   "tag-gaming",
        "name": "Gaming",
        "slug": "gaming",
        "_count": {
          "productTags": 5
        }
      },
      {
        "id":   "tag-hot",
        "name": "Hot",
        "slug": "hot",
        "_count": {
          "productTags": 0
        }
      }
    ]
  }
}
```

> Sắp xếp A→Z theo `name`. `_count.productTags` = số sản phẩm đang dùng tag này.

---

## POST `/admin/tags`

### Request
```http
POST /api/admin/tags
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| `name` | string | ✅ | ≥ **1** ký tự sau trim |
| `slug` | string | ❌ | Tự sinh từ `name` nếu không gửi |

**Ví dụ:**
```json
{ "name": "Pin khủng" }
```

```json
{ "name": "5G", "slug": "5g-network" }
```

### Response

**201 Created:**
```json
{
  "success": true,
  "data": {
    "message": "Tạo tag thành công",
    "tag": {
      "id":   "tag-pin-khung",
      "name": "Pin khủng",
      "slug": "pin-khung"
    }
  }
}
```

> Tag mới **không có** `_count` trong response tạo — chỉ xuất hiện trong GET list.

**400 — name rỗng:**
```json
{ "success": false, "message": "Tên tag phải có ít nhất 1 ký tự" }
```

**409 — Tên đã tồn tại:**
```json
{ "success": false, "message": "Tag đã tồn tại" }
```

---

## DELETE `/admin/tags/:id`

### Request
```http
DELETE /api/admin/tags/tag-5g
Authorization: Bearer <token>
```

### Response

**200 OK:**
```json
{ "success": true, "data": { "message": "Xóa tag thành công" } }
```

**404:**
```json
{ "success": false, "message": "Tag không tồn tại" }
```

> Sau khi xóa, tất cả sản phẩm từng có tag này sẽ không còn thấy tag trong danh sách tags của mình.

---

## Slug Generation — Ví dụ

| `name` nhập vào | Slug sinh ra | Ghi chú |
|---|---|---|
| `"5G"` | `5g` | |
| `"Pin khủng"` | `pin-khung` | Bỏ dấu tiếng Việt |
| `"Hot deal 2026"` | `hot-deal-2026` | Giữ số |
| `"Hot"` (đã có) | `hot-1` | Thêm hậu tố |
| `"  Gaming  "` | `gaming` | Trim whitespace |

---

## Mã lỗi tổng hợp

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 400 | name rỗng hoặc quá ngắn |
| 401 | Chưa xác thực |
| 403 | Không đủ quyền |
| 404 | Tag không tồn tại |
| 409 | Tên tag đã tồn tại |

---

## Lưu ý tích hợp

Khi product module dùng tag:
- Gán tag vào sản phẩm: tạo record `ProductTag(productId, tagId)`
- Gỡ tag: xóa record `ProductTag`
- Xóa Tag (module này): cascade tự xóa tất cả `ProductTag` liên quan
