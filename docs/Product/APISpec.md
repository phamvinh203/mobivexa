# API Specification
## Module: Product
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## Public Routes

### GET /api/products

**Query params:**

| Param | Kiểu | Mô tả |
|---|---|---|
| `category` | string | slug danh mục |
| `brand` | string | slug thương hiệu |
| `tag` | string | slug tag |
| `search` | string | Full-text search trên `name` |
| `minPrice` | number | Giá tối thiểu (salePrice) |
| `maxPrice` | number | Giá tối đa (salePrice) |
| `sort` | string | `newest`(default)/`oldest`/`name_asc`/`name_desc` |
| `page` | number | default 1 |
| `limit` | number | default `LIMITS.PRODUCT` |

**Response 200:**
```json
{
  "products": [
    {
      "id": "uuid",
      "name": "iPhone 15 Pro",
      "slug": "iphone-15-pro",
      "isActive": true,
      "isFeatured": false,
      "category": { "id": "uuid", "name": "Điện thoại", "slug": "dien-thoai" },
      "brand": { "id": "uuid", "name": "Apple", "slug": "apple" },
      "variants": [
        { "id": "uuid", "sku": "IPH15-BLK-256", "color": "Đen", "storage": "256GB", "ram": null,
          "originalPrice": 30990000, "salePrice": 27990000, "stock": 15, "isActive": true }
      ],
      "images": [{ "id": "uuid", "url": "https://...", "isCover": true, "sortOrder": 0 }]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

> `description` không có trong listing. Public: chỉ variant `isActive=true`.

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | `minPrice`/`maxPrice` không phải số / số âm / `minPrice > maxPrice` |

---

### GET /api/products/featured

**Query:** `limit` (default 8)

**Response 200:** Array sản phẩm (cùng cấu trúc listing, không có `description`)

---

### GET /api/products/:slug

**Response 200:**
```json
{
  "id": "uuid",
  "name": "iPhone 15 Pro",
  "slug": "iphone-15-pro",
  "description": "<p>Mô tả HTML...</p>",
  "isActive": true,
  "isFeatured": false,
  "category": { "id": "...", "name": "...", "slug": "..." },
  "brand": { "id": "...", "name": "...", "slug": "..." },
  "variants": [ { "id": "...", "sku": "...", "color": "Đen", "storage": "256GB", "originalPrice": 30990000, "salePrice": 27990000, "stock": 15, "isActive": true } ],
  "productTags": [ { "tag": { "id": "...", "name": "Flagship", "slug": "flagship" } } ],
  "images": [ { "id": "...", "url": "...", "isCover": true, "sortOrder": 0 } ],
  "specs": [ { "id": "...", "label": "CPU", "value": "A17 Pro", "sortOrder": 0 } ]
}
```

**Lỗi:** `404` — slug không tồn tại hoặc `isActive = false`

---

## Admin Routes (STAFF+)

### GET /api/admin/products

**Query:** Giống public + thêm `isActive=true/false`, `isFeatured=true/false`

> Trả cả sản phẩm `isActive=false`. Không có `description`. Variant không filter isActive.

---

### GET /api/admin/products/:id

**Response 200:** `PRODUCT_DETAIL_INCLUDE` đầy đủ (kể cả sản phẩm ẩn)

**Lỗi:** `404`

---

### POST /api/admin/products

**Content-Type:** `multipart/form-data`

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `name` | string | Có | |
| `slug` | string | Không | Tự sinh nếu rỗng |
| `description` | string | Không | HTML |
| `categoryId` | string | Có | |
| `brandId` | string | Có | |
| `isActive` | boolean | Không | default true |
| `isFeatured` | boolean | Không | default false |
| `variants` | JSON string | Có | Array, >= 1 item |
| `tagIds` | JSON string | Không | Array string |
| `specs` | JSON string | Không | Array {label, value} |
| `images` | File[] | Không | max 10 files |

**Variant object:**
```json
{ "sku": "IPH15-BLK-256", "color": "Đen", "storage": "256GB", "ram": null, "originalPrice": 30990000, "salePrice": 27990000, "stock": 10, "isActive": true }
```

**Response 201:** Product đầy đủ (PRODUCT_DETAIL_INCLUDE)

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Validation lỗi / Category/Brand không tồn tại / Tag không tồn tại |
| 409 | SKU trùng trong payload hoặc DB |

---

### PUT /api/admin/products/:id

**Content-Type:** `multipart/form-data` — partial update (gửi field nào, update field đó)

> Slug rỗng → sinh lại từ `name`. Files mới → thêm ảnh (không xóa ảnh cũ).

**Response 200:** Product đầy đủ

---

### DELETE /api/admin/products/:id

**Response 200:** `{ message: "..." }`

---

### PATCH /api/admin/products/:id/status

**Response 200:** `{ slug: "..." }` (slug của sản phẩm đã toggle)

---

### PATCH /api/admin/products/:id/featured

**Response 200:** `{ slug: "..." }`

---

### POST /api/admin/products/:id/images

**Content-Type:** `multipart/form-data`, field `images` (max 10 files)

**Response 200:** `{ count: N }` (số ảnh đã tạo)

---

### DELETE /api/admin/products/:id/images/:imageId

**Response 200:** `{ message: "..." }`

**Lỗi:** `404` — ảnh không tồn tại hoặc không thuộc product này

---

### PATCH /api/admin/products/:id/images/:imageId/cover

**Response 200:** Array `ProductImage[]` sắp xếp theo `sortOrder`

---

### PUT /api/admin/products/:id/specs

**Body:**
```json
{
  "specs": [
    { "label": "CPU", "value": "A17 Pro" },
    { "label": "RAM", "value": "8GB" }
  ]
}
```

> Mảng rỗng `specs: []` → xóa sạch toàn bộ thông số

**Response 200:** Array `ProductSpec[]`

**Lỗi:** `400` — specs không phải array / label/value rỗng / vượt 60 dòng

---

### POST /api/admin/products/:id/variants

**Body:**
```json
{ "sku": "APPLE-IPH15-BLK-512", "color": "Đen", "storage": "512GB", "originalPrice": 35990000, "salePrice": 32990000, "stock": 5 }
```

**Response 201:** `ProductVariant`

**Lỗi:** `409` — SKU trùng

---

### PUT /api/admin/products/:id/variants/:variantId

**Body:** Partial (gửi field nào, update field đó)

**Response 200:** `ProductVariant`

**Lỗi:** `400` — salePrice > originalPrice (sau merge với giá hiện tại)

---

### PATCH /api/admin/products/:id/variants/:variantId/stock

**Body:**
```json
{ "stock": 20, "expectedStock": 15 }
```

> `expectedStock` tùy chọn: nếu có và khác DB → 409

**Response 200:** `ProductVariant`

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | stock không phải integer >= 0 |
| 404 | Variant không tồn tại hoặc sai productId |
| 409 | `variant.stock !== expectedStock` (tồn kho đã thay đổi) |

---

### DELETE /api/admin/products/:id/variants/:variantId

**Response 200:** `{ message: "..." }`

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 404 | Variant không tồn tại |
| 409 | Đây là variant cuối cùng |
