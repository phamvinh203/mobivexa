# API Specification
## Module: Favorite
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22  
> **Base URL:** `/api/favorites`  
> **Auth:** Tất cả endpoint yêu cầu Bearer token (Customer)

---

### GET /favorites
Danh sách sản phẩm yêu thích (phân trang).

**Auth:** Bearer token (Customer)

**Query params:**
| Param | Type | Default | Mô tả |
|---|---|---|---|
| `page` | number | 1 | Trang |
| `limit` | number | LIMITS.PRODUCT | Số item/trang |

**Response 200:**
```json
{
  "favorites": [
    {
      "createdAt": "2026-08-20T10:00:00.000Z",
      "product": {
        "id": "uuid",
        "name": "iPhone 15 Pro",
        "slug": "iphone-15-pro",
        "brand": {
          "id": "brand-uuid",
          "name": "Apple",
          "slug": "apple"
        },
        "variants": [
          {
            "id": "variant-uuid",
            "name": "256GB Black",
            "salePrice": 27990000,
            "isActive": true
          }
        ],
        "images": [
          { "url": "https://...", "isCover": true }
        ]
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 401 | Chưa đăng nhập |

> Sản phẩm admin ẩn (`isActive=false`) không xuất hiện trong response, nhưng khi admin bật lại sẽ tự động hiện.

---

### GET /favorites/ids
Toàn bộ ID sản phẩm đã thích (không phân trang).

**Auth:** Bearer token (Customer)

**Response 200:**
```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

> FE dùng mảng này để tô tim đúng trên mọi card sản phẩm trên trang listing.

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 401 | Chưa đăng nhập |

---

### POST /favorites
Thêm sản phẩm vào danh sách yêu thích.

**Auth:** Bearer token (Customer)  
**Content-Type:** `application/json`

**Request body:**
```json
{
  "productId": "product-uuid"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `productId` | string | ✅ | Non-empty string (checkId) |

**Response 200 — thích mới:**
```json
{ "created": true }
```

**Response 200 — đã thích rồi (idempotent):**
```json
{ "created": false }
```

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | `productId` rỗng hoặc thiếu |
| 401 | Chưa đăng nhập |
| 404 | Sản phẩm không tồn tại hoặc đã ngừng bán |

> **Không có 409:** double-tap luôn trả 200 với `created: false`.

---

### DELETE /favorites/:productId
Bỏ sản phẩm khỏi danh sách yêu thích.

**Auth:** Bearer token (Customer)

**Path params:**
| Param | Mô tả |
|---|---|
| `productId` | ID sản phẩm cần bỏ |

**Response 200:**
```json
{ "message": "Đã bỏ yêu thích" }
```

> **Idempotent:** Bỏ sản phẩm chưa từng thích cũng trả 200 (không 404).

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 401 | Chưa đăng nhập |
