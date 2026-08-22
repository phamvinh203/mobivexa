# API Specification
## Module: Review
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## Public Endpoints

### GET /api/products/:slug/reviews/summary

**Auth:** Không cần

**Response 200:**
```json
{
  "averageRating": 4.3,
  "totalCount": 128,
  "breakdown": { "1": 2, "2": 3, "3": 10, "4": 40, "5": 73 },
  "withPhotoCount": 35
}
```

**Lỗi:** `404` nếu slug không tồn tại

---

### GET /api/products/:slug/reviews

**Auth:** Không cần

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `rating` | 1–5 | Lọc theo số sao |
| `hasPhoto` | 'true' | Chỉ lấy review có ảnh |
| `sort` | 'helpful' \| default | Default: `createdAt DESC` |
| `page` | number | Default 1 |
| `limit` | number | Default theo `LIMITS` |

**Response 200:**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "rating": 5,
      "content": "Sản phẩm rất tốt",
      "replyContent": "Cảm ơn bạn đã đánh giá!",
      "repliedAt": "2026-08-10T10:00:00.000Z",
      "createdAt": "2026-08-01T08:00:00.000Z",
      "orderItem": { "color": "Đen", "storage": "256GB", "ram": null, "sku": "IPH15-BLK-256" },
      "user": { "id": "uuid", "fullName": "Nguyễn Văn A", "avatarUrl": "https://..." },
      "photos": [{ "id": "uuid", "url": "https://res.cloudinary.com/..." }],
      "_count": { "helpful": 12 }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 128, "totalPages": 13 }
}
```

---

## User Endpoints (Cần đăng nhập)

### GET /api/users/me/reviews/pending

**Auth:** Customer+

**Response 200:** Mảng OrderItem chưa được review
```json
[
  {
    "id": "order-item-uuid",
    "productName": "iPhone 15 Pro",
    "sku": "IPH15-BLK-256",
    "color": "Đen", "storage": "256GB", "ram": null,
    "unitPrice": 27990000, "quantity": 1,
    "order": { "id": "uuid", "orderCode": "MB20260801001", "updatedAt": "..." },
    "variant": {
      "product": {
        "slug": "iphone-15-pro",
        "images": [{ "url": "https://..." }]
      }
    }
  }
]
```

---

### GET /api/users/me/reviews

**Auth:** Customer+

**Query params:** `page`, `limit`

**Response 200:**
```json
{
  "reviews": [
    {
      "id": "uuid", "rating": 4, "content": "...",
      "status": "APPROVED", "createdAt": "...", "updatedAt": "...",
      "photos": [{ "id": "uuid", "url": "https://..." }],
      "product": { "name": "...", "slug": "...", "images": [{ "url": "..." }] },
      "orderItem": { "color": "Đen", "storage": "256GB", "ram": null }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 5, "totalPages": 1 }
}
```

---

### POST /api/order-items/:orderItemId/review

**Auth:** Customer+  
**Content-Type:** `multipart/form-data`

**Body:**

| Field | Type | Bắt buộc | Ghi chú |
|---|---|---|---|
| `rating` | string (1–5) | Có | Form-data nên là string |
| `content` | string | Có | 10–2000 ký tự |
| `photos` | file[] | Không | Tối đa 5 ảnh |

**Response 201:**
```json
{
  "id": "uuid",
  "rating": 5,
  "content": "...",
  "status": "APPROVED",
  "photos": [{ "id": "uuid", "url": "https://res.cloudinary.com/..." }]
}
```

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Validation lỗi |
| 404 | OrderItem không tồn tại hoặc không thuộc đơn DELIVERED của user |
| 409 | Đã có review cho OrderItem này |

---

### PUT /api/reviews/:id

**Auth:** Chủ review  
**Content-Type:** `multipart/form-data`

**Body (ít nhất 1 field):**

| Field | Type | Ghi chú |
|---|---|---|
| `rating` | string (1–5) | Optional |
| `content` | string | Optional, 10–2000 ký tự |
| `photos` | file[] | Optional, tối đa 5; thay toàn bộ ảnh cũ |

**Response 200:** Review đã cập nhật (kèm photos mới)

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Không có field nào / quá 30 ngày / validation lỗi |
| 404 | Review không tồn tại hoặc không phải của user |

---

### DELETE /api/reviews/:id

**Auth:** Chủ review

**Response 200:** `{ message: "..." }`

**Lỗi:** `404`

---

### POST /api/reviews/:id/helpful

**Auth:** Customer+

**Response 200:**
```json
{ "helpful": true, "count": 13 }
```

**Lỗi:** `404` nếu review không tồn tại hoặc không APPROVED

---

## Admin Endpoints (STAFF+)

### GET /api/admin/reviews

**Auth:** STAFF+

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `status` | PENDING \| APPROVED | Lọc theo status |
| `productId` | string | Lọc theo sản phẩm |
| `rating` | 1–5 | Lọc theo số sao |
| `page`, `limit` | number | Phân trang |

**Response 200:**
```json
{
  "reviews": [
    {
      "id": "uuid", "rating": 3, "content": "...",
      "status": "APPROVED", "replyContent": null, "repliedAt": null,
      "createdAt": "...", "updatedAt": "...",
      "user":    { "id": "uuid", "fullName": "...", "email": "user@example.com" },
      "product": { "id": "uuid", "name": "iPhone 15 Pro", "slug": "iphone-15-pro" },
      "photos":  [{ "id": "uuid", "url": "https://..." }],
      "_count":  { "helpful": 2 }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 50, "totalPages": 5 }
}
```

---

### POST /api/admin/reviews/:id/reply

**Auth:** STAFF+

**Body:**
```json
{ "content": "Cảm ơn bạn đã đánh giá! Chúng tôi..." }
```

**Validate:** `content` required, 1–1000 ký tự

**Response 200:** Full review (cùng format GET admin list)

**Lỗi:** `404`

---

### DELETE /api/admin/reviews/:id

**Auth:** STAFF+

**Response 200:** `{ message: "..." }`

**Lỗi:** `404`
