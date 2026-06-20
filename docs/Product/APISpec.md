# API Specification — Request / Response
## Module: Product (Sản phẩm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Base URL:** `http://localhost:3000/api` (development)  
> **Content-Type:** `application/json` (hoặc `multipart/form-data` cho upload)  
> **Rate Limit:** Chỉ áp dụng cho admin endpoints (nếu có)

---

## Tổng quan Endpoints

### Public Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/products` | Danh sách sản phẩm (có phân trang, filter, search) | ❌ |
| `GET` | `/products/featured` | Sản phẩm nổi bật | ❌ |
| `GET` | `/products/:slug` | Chi tiết sản phẩm | ❌ |

### Admin Endpoints (STAFF+)

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/admin/products` | Danh sách tất cả sản phẩm (gồm cả ẩn) | ✅ |
| `GET` | `/admin/products/:id` | Chi tiết sản phẩm (theo ID) | ✅ |
| `POST` | `/admin/products` | Tạo sản phẩm mới | ✅ |
| `PUT` | `/admin/products/:id` | Cập nhật sản phẩm | ✅ |
| `DELETE` | `/admin/products/:id` | Xóa sản phẩm | ✅ |
| `PATCH` | `/admin/products/:id/status` | Bật/tắt hiển thị | ✅ |
| `PATCH` | `/admin/products/:id/featured` | Bật/tắt nổi bật | ✅ |
| `POST` | `/admin/products/:id/images` | Thêm ảnh | ✅ |
| `DELETE` | `/admin/products/:id/images/:imageId` | Xóa ảnh | ✅ |
| `PATCH` | `/admin/products/:id/images/:imageId/cover` | Đặt ảnh bìa | ✅ |
| `POST` | `/admin/products/:id/variants` | Thêm variant | ✅ |
| `PUT` | `/admin/products/:id/variants/:variantId` | Cập nhật variant | ✅ |
| `DELETE` | `/admin/products/:id/variants/:variantId` | Xóa variant | ✅ |
| `PATCH` | `/admin/products/:id/variants/:variantId/stock` | Cập nhật tồn kho | ✅ |
| `GET` | `/admin/inventory` | Báo cáo tồn kho | ✅ |

---

## Public Endpoints

### GET `/products`

Danh sách sản phẩm công khai với phân trang, filter, search.

**Query Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | number | ❌ | 1 | Trang hiện tại |
| `limit` | number | ❌ | 12 | Số item/trang (max: 50) |
| `category` | string | ❌ | — | Slug danh mục |
| `brand` | string | ❌ | — | Slug thương hiệu |
| `tag` | string | ❌ | — | Slug tag |
| `search` | string | ❌ | — | Tìm theo tên (Full-text search) |
| `minPrice` | number | ❌ | — | Giá tối thiểu |
| `maxPrice` | number | ❌ | — | Giá tối đa |
| `sort` | string | ❌ | `newest` | `newest` / `oldest` / `name_asc` / `name_desc` |

**Response `200`:**

```json
{
  "products": [
    {
      "id": "clxxx123",
      "name": "iPhone 15 Pro Max",
      "slug": "iphone-15-pro-max",
      "description": "iPhone 15 Pro Max với chip A17 Pro",
      "category": {
        "id": "cat_smartphones",
        "name": "Điện thoại",
        "slug": "dien-thoai"
      },
      "brand": {
        "id": "brand_apple",
        "name": "Apple",
        "slug": "apple"
      },
      "isActive": true,
      "isFeatured": true,
      "coverImage": {
        "id": "imgxxx123",
        "url": "https://res.cloudinary.com/xxx/image.jpg",
        "isCover": true,
        "sortOrder": 0
      },
      "variants": [
        {
          "id": "varxxx123",
          "sku": "IP15PM-256-TITAN",
          "color": "Titan Natural",
          "storage": "256GB",
          "originalPrice": 34990000,
          "salePrice": 32990000,
          "stock": 15,
          "isActive": true
        }
      ],
      "createdAt": "2026-06-19T00:00:00Z",
      "updatedAt": "2026-06-19T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 150,
    "totalPages": 13
  }
}
```

---

### GET `/products/featured`

Danh sách sản phẩm nổi bật cho trang chủ.

**Query Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `limit` | number | ❌ | 8 | Số lượng (max: 20) |

**Response `200`:**

```json
{
  "products": [
    {
      "id": "clxxx123",
      "name": "iPhone 15 Pro Max",
      "slug": "iphone-15-pro-max",
      "isActive": true,
      "isFeatured": true,
      "coverImage": {
        "id": "imgxxx123",
        "url": "https://res.cloudinary.com/xxx/image.jpg",
        "isCover": true
      },
      "variants": [
        {
          "id": "varxxx123",
          "sku": "IP15PM-256-TITAN",
          "salePrice": 32990000,
          "stock": 15
        }
      ]
    }
  ]
}
```

---

### GET `/products/:slug`

Chi tiết sản phẩm theo slug.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `slug` | string | ✅ | URL-friendly identifier |

**Response `200`:**

```json
{
  "id": "clxxx123",
  "name": "iPhone 15 Pro Max",
  "slug": "iphone-15-pro-max",
  "description": "iPhone 15 Pro Max với chip A17 Pro...",
  "category": {
    "id": "cat_smartphones",
    "name": "Điện thoại",
    "slug": "dien-thoai"
  },
  "brand": {
    "id": "brand_apple",
    "name": "Apple",
    "slug": "apple"
  },
  "isActive": true,
  "isFeatured": true,
  "variants": [
    {
      "id": "varxxx123",
      "sku": "IP15PM-256-TITAN",
      "color": "Titan Natural",
      "storage": "256GB",
      "originalPrice": 34990000,
      "salePrice": 32990000,
      "stock": 15,
      "isActive": true
    }
  ],
  "images": [
    {
      "id": "imgxxx123",
      "url": "https://res.cloudinary.com/xxx/image.jpg",
      "isCover": true,
      "sortOrder": 0
    }
  ],
  "tags": [
    {
      "id": "tag_new",
      "name": "Hàng mới",
      "slug": "hang-moi"
    }
  ],
  "createdAt": "2026-06-19T00:00:00Z",
  "updatedAt": "2026-06-19T00:00:00Z"
}
```

**Response `404`:**

```json
{
  "message": "Sản phẩm không tồn tại"
}
```

---

## Admin Endpoints

### GET `/admin/products`

Danh sách tất cả sản phẩm (kể cả ẩn) cho admin.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:** Tất cả params của `/products` +

| Param | Type | Required | Description |
|---|---|---|---|
| `isActive` | string | ❌ | `'true'` / `'false'` |
| `isFeatured` | string | ❌ | `'true'` / `'false'` |

**Response `200`:** Giống `/products` nhưng trả về tất cả (kể cả inactive) và tất cả variants.

---

### GET `/admin/products/:id`

Chi tiết sản phẩm theo ID.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string (UUID/CUID) | ✅ | Product ID |

**Response `200`:** Giống `/products/:slug` nhưng trả về kể cả inactive.

**Response `404`:**

```json
{
  "message": "Sản phẩm không tồn tại"
}
```

---

### POST `/admin/products`

Tạo sản phẩm mới với ảnh và variants.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Form Data:**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Tên sản phẩm (≥ 2 ký tự) |
| `categoryId` | string | ✅ | ID danh mục |
| `brandId` | string | ✅ | ID thương hiệu |
| `description` | string | ❌ | Mô tả |
| `tagIds` | string (JSON) | ❌ | Array of tag IDs: `["tag1", "tag2"]` |
| `isActive` | boolean | ❌ | Hiển thị (default: true) |
| `isFeatured` | boolean | ❌ | Nổi bật (default: false) |
| `variants` | string (JSON) | ✅ | Array of variant objects (xem dưới) |
| `images` | file[] | ❌ | Tối đa 10 ảnh (JPG/JPEG/PNG/WebP, max 5MB/ảnh) |

**variants format (JSON string):**

```json
[
  {
    "sku": "IP15PM-256-TITAN",
    "color": "Titan Natural",
    "storage": "256GB",
    "ram": null,
    "originalPrice": 34990000,
    "salePrice": 32990000,
    "stock": 15,
    "imageUrl": null
  },
  {
    "sku": "IP15PM-512-TITAN",
    "color": "Titan Natural",
    "storage": "512GB",
    "originalPrice": 38990000,
    "salePrice": 36990000,
    "stock": 8
  }
]
```

**Response `201`:**

```json
{
  "id": "clxxx123",
  "name": "iPhone 15 Pro Max",
  "slug": "iphone-15-pro-max",
  "isActive": true,
  "isFeatured": false,
  "category": { "id": "cat_smartphones", "name": "Điện thoại", "slug": "dien-thoai" },
  "brand": { "id": "brand_apple", "name": "Apple", "slug": "apple" },
  "variants": [
    {
      "id": "varxxx123",
      "sku": "IP15PM-256-TITAN",
      "color": "Titan Natural",
      "storage": "256GB",
      "originalPrice": 34990000,
      "salePrice": 32990000,
      "stock": 15,
      "isActive": true
    }
  ],
  "images": [
    {
      "id": "imgxxx123",
      "url": "https://res.cloudinary.com/xxx/image.jpg",
      "isCover": true,
      "sortOrder": 0
    }
  ],
  "tags": [
    { "id": "tag_new", "name": "Hàng mới", "slug": "hang-moi" }
  ],
  "createdAt": "2026-06-19T00:00:00Z",
  "updatedAt": "2026-06-19T00:00:00Z"
}
```

**Error Responses:**

| HTTP | Message |
|---|---|
| `400` | `Tên sản phẩm phải có ít nhất 2 ký tự` |
| `400` | `Vui lòng chọn danh mục` |
| `400` | `Vui lòng chọn thương hiệu` |
| `400` | `Sản phẩm phải có ít nhất một phiên bản` |
| `400` | `SKU không được để trống` |
| `400` | `Giá gốc không hợp lệ` |
| `400` | `Giá bán không được lớn hơn giá gốc` |
| `400` | `Danh mục không tồn tại` |
| `400` | `Thương hiệu không tồn tại` |
| `400` | `Có tag không tồn tại` |
| `409` | `SKU bị trùng trong danh sách phiên bản` |
| `409` | `SKU đã tồn tại: IP15PM-256-TITAN` |

---

### PUT `/admin/products/:id`

Cập nhật sản phẩm (partial update).

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Form Data:** Giống `POST` nhưng tất cả fields optional (partial update).

**Response `200`:** Giống `POST` response.

**Error Responses:** Giống `POST` + `404` nếu product không tồn tại.

---

### DELETE `/admin/products/:id`

Xóa sản phẩm (cascade delete variants, images, tags).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response `200`:**

```json
{
  "message": "Xóa sản phẩm thành công"
}
```

**Error Responses:**

| HTTP | Message |
|---|---|
| `401` | `Token không hợp lệ hoặc đã hết hạn` |
| `403` | `Bạn không có quyền thực hiện thao tác này` |
| `404` | `Sản phẩm không tồn tại` |

---

### PATCH `/admin/products/:id/status`

Bật/tắt hiển thị sản phẩm.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**

```json
{
  "isActive": false
}
```

**Response `200`:**

```json
{
  "id": "clxxx123",
  "name": "iPhone 15 Pro Max",
  "slug": "iphone-15-pro-max",
  "isActive": false,
  "isFeatured": true,
  "...": "..."
}
```

---

### PATCH `/admin/products/:id/featured`

Bật/tắt nổi bật sản phẩm.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**

```json
{
  "isFeatured": true
}
```

**Response `200`:** Giống `/status`.

---

### POST `/admin/products/:id/images`

Upload thêm ảnh vào sản phẩm.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Form Data:**

| Field | Type | Required | Description |
|---|---|---|---|
| `images` | file[] | ✅ | Tối đa 10 ảnh |

**Response `201`:**

```json
{
  "images": [
    {
      "id": "imgxxx124",
      "url": "https://res.cloudinary.com/xxx/image2.jpg",
      "isCover": false,
      "sortOrder": 1
    }
  ]
}
```

---

### DELETE `/admin/products/:id/images/:imageId`

Xóa ảnh khỏi sản phẩm.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response `200`:**

```json
{
  "message": "Xóa ảnh thành công"
}
```

---

### PATCH `/admin/products/:id/images/:imageId/cover`

Đặt ảnh làm ảnh bìa.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response `200`:**

```json
{
  "images": [
    {
      "id": "imgxxx124",
      "url": "https://res.cloudinary.com/xxx/image2.jpg",
      "isCover": true,
      "sortOrder": 1
    }
  ]
}
```

---

### POST `/admin/products/:id/variants`

Thêm variant mới vào sản phẩm.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**

```json
{
  "sku": "IP15PM-1TB-TITAN",
  "color": "Titan Natural",
  "storage": "1TB",
  "ram": null,
  "originalPrice": 44990000,
  "salePrice": 42990000,
  "stock": 5,
  "imageUrl": null
}
```

**Response `201`:**

```json
{
  "id": "varxxx124",
  "sku": "IP15PM-1TB-TITAN",
  "color": "Titan Natural",
  "storage": "1TB",
  "originalPrice": 44990000,
  "salePrice": 42990000,
  "stock": 5,
  "isActive": true,
  "createdAt": "2026-06-19T01:00:00Z",
  "updatedAt": "2026-06-19T01:00:00Z"
}
```

**Error Responses:**

| HTTP | Message |
|---|---|
| `400` | `SKU không được để trống` |
| `400` | `Giá bán không được lớn hơn giá gốc` |
| `409` | `SKU đã tồn tại` |

---

### PUT `/admin/products/:id/variants/:variantId`

Cập nhật variant (partial update).

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:** Giống `POST /variants` nhưng tất cả fields optional.

**Response `200`:** Giống `POST` response.

---

### DELETE `/admin/products/:id/variants/:variantId`

Xóa variant khỏi sản phẩm.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response `200`:**

```json
{
  "message": "Xóa phiên bản thành công"
}
```

**Error Responses:**

| HTTP | Message |
|---|---|
| `409` | `Không thể xóa phiên bản cuối cùng của sản phẩm` |

---

### PATCH `/admin/products/:id/variants/:variantId/stock`

Cập nhật tồn kho nhanh.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**

```json
{
  "stock": 20
}
```

**Response `200`:**

```json
{
  "id": "varxxx123",
  "sku": "IP15PM-256-TITAN",
  "stock": 20,
  "isActive": true,
  "updatedAt": "2026-06-19T02:00:00Z"
}
```

**Error Responses:**

| HTTP | Message |
|---|---|
| `400` | `Tồn kho phải là số nguyên không âm` |

---

### GET `/admin/inventory`

Báo cáo tồn kho tổng quan và chi tiết.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | number | ❌ | 1 | Trang hiện tại |
| `limit` | number | ❌ | 20 | Số item/trang (max: 100) |
| `search` | string | ❌ | — | Tìm theo tên sản phẩm (FTS) |
| `stockStatus` | string | ❌ | `all` | `all` / `in_stock` / `low_stock` / `out_of_stock` |
| `lowThreshold` | number | ❌ | 5 | Ngưỡng "sắp hết" |
| `brandSlug` | string | ❌ | — | Lọc theo thương hiệu |

**Response `200`:**

```json
{
  "summary": {
    "totalVariants": 1500,
    "totalStock": 12500,
    "outOfStock": 120,
    "lowStock": 80,
    "inStock": 1300
  },
  "variants": [
    {
      "id": "varxxx123",
      "sku": "IP15PM-256-TITAN",
      "stock": 0,
      "isActive": true,
      "product": {
        "id": "clxxx123",
        "name": "iPhone 15 Pro Max",
        "slug": "iphone-15-pro-max"
      },
      "category": {
        "id": "cat_smartphones",
        "name": "Điện thoại",
        "slug": "dien-thoai"
      },
      "brand": {
        "id": "brand_apple",
        "name": "Apple",
        "slug": "apple"
      },
      "coverImage": {
        "id": "imgxxx123",
        "url": "https://res.cloudinary.com/xxx/image.jpg",
        "isCover": true
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

**Trạng thái tồn kho:**

| `stockStatus` | Điều kiện |
|---|---|
| `out_of_stock` | `stock = 0` |
| `low_stock` | `0 < stock ≤ lowThreshold` |
| `in_stock` | `stock > lowThreshold` |

---

## Error Response Format

Tất cả error responses tuân theo format:

```json
{
  "message": "Mô tả lỗi",
  "errors": [
    { "field": "name", "message": "Tên sản phẩm phải có ít nhất 2 ký tự" }
  ]
}
```

---

## Authentication & Authorization

### JWT Token Format

**Access Token Header:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Payload:**
```json
{
  "userId": "user_123",
  "email": "admin@mobivexa.com",
  "role": "ADMIN",
  "iat": 1234567890,
  "exp": 1234568790
}
```

### Role-based Access Control

| Role | Access |
|---|---|
| `CUSTOMER` | Public endpoints only |
| `STAFF` | Public + Admin endpoints |
| `ADMIN` | Public + Admin endpoints |

---

## Rate Limiting (Optional)

Nếu có rate limiting:

| Endpoint | Limit | Window |
|---|---|---|
| Admin endpoints | 100 req | 15 phút / IP |
| Public endpoints | No limit | — |

**Response `429`:**

```json
{
  "message": "Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút"
}
```

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Next Review:** After API implementation
