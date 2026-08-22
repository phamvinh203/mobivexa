# API Specification
## Module: Coupon
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22  
> **Base URL:** `/api`

---

## Customer Endpoints

### GET /coupons
Danh sách mã giảm giá đang chạy.

**Auth:** Bearer token (Customer)

**Response 200:**
```json
{
  "coupons": [
    {
      "id": "uuid",
      "code": "SUMMER20",
      "description": "Giảm 20% mùa hè",
      "type": "PERCENT",
      "value": 20,
      "maxDiscount": 100000,
      "minOrderValue": 200000,
      "endsAt": "2026-08-31T23:59:59.000Z",
      "used": false
    }
  ]
}
```

> `used: true` — khách đã dùng mã này rồi (FE làm mờ, không ẩn).  
> Không có `usedCount`, `usageLimit`, `startsAt` trong response.

---

### POST /coupons/preview
Xem trước mức giảm.

**Auth:** Bearer token (Customer)  
**Rate limit:** `couponPreviewLimiter`  
**Content-Type:** `application/json`

**Request body:**
```json
{
  "code": "SUMMER20",
  "items": [
    { "variantId": "variant-uuid-1", "quantity": 2 },
    { "variantId": "variant-uuid-2", "quantity": 1 }
  ]
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `code` | string | ✅ | ≤ 32 ký tự |
| `items` | array | ❌ | Nếu có: mỗi item cần `variantId` (string) + `quantity` (int > 0) |

**Response 200 — hợp lệ:**
```json
{
  "valid": true,
  "subtotal": 500000,
  "discount": 100000,
  "total": 400000
}
```

**Response 200 — không hợp lệ:**
```json
{
  "valid": false,
  "subtotal": 150000,
  "discount": 0,
  "total": 150000,
  "reason": "Đơn hàng tối thiểu 200.000đ"
}
```

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | `code` rỗng, quá 32 ký tự, hoặc `items` không hợp lệ |
| 401 | Chưa đăng nhập |
| 429 | Vượt rate limit |

---

## Admin Endpoints

### GET /admin/coupons
Danh sách mã (admin, có phân trang).

**Auth:** Bearer token (STAFF+)

**Query params:**
| Param | Type | Mô tả |
|---|---|---|
| `page` | number | Trang (default 1) |
| `limit` | number | Số bản ghi/trang |
| `search` | string | Tìm theo code (không phân biệt hoa/thường) |
| `isActive` | `"true"` \| `"false"` | Lọc theo trạng thái |
| `status` | `running` \| `scheduled` \| `expired` | Lọc theo thời gian |

**Response 200:**
```json
{
  "coupons": [
    {
      "id": "uuid",
      "code": "SUMMER20",
      "description": "...",
      "type": "PERCENT",
      "value": 20,
      "maxDiscount": 100000,
      "minOrderValue": 200000,
      "usageLimit": 100,
      "usedCount": 45,
      "startsAt": "2026-08-01T00:00:00.000Z",
      "endsAt": "2026-08-31T23:59:59.000Z",
      "isActive": true,
      "createdAt": "2026-07-15T10:00:00.000Z",
      "updatedAt": "2026-07-15T10:00:00.000Z",
      "_count": { "usages": 45 }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### GET /admin/coupons/:id
Chi tiết một mã.

**Auth:** Bearer token (STAFF+)

**Response 200:** Object coupon (như trên, kèm `_count.usages`)  
**Response 404:** `Mã giảm giá không tồn tại`

---

### POST /admin/coupons
Tạo mã giảm giá.

**Auth:** Bearer token (STAFF+)  
**Content-Type:** `application/json`

**Request body:**
```json
{
  "code": "SUMMER20",
  "description": "Giảm 20% mùa hè",
  "type": "PERCENT",
  "value": 20,
  "maxDiscount": 100000,
  "minOrderValue": 200000,
  "usageLimit": 100,
  "startsAt": "2026-08-01T00:00:00.000Z",
  "endsAt": "2026-08-31T23:59:59.000Z",
  "isActive": true
}
```

| Field | Required | Validation |
|---|---|---|
| `code` | ✅ | A-Z 0-9 _ - ; 3-32 ký tự |
| `type` | ✅ | `PERCENT` \| `FIXED` |
| `value` | ✅ | > 0; nếu PERCENT thì ≤ 100 |
| `maxDiscount` | ❌ | Chỉ với PERCENT; > 0 nếu gửi |
| `minOrderValue` | ✅ | ≥ 0 |
| `startsAt` | ✅ | ISO 8601 |
| `endsAt` | ✅ | ISO 8601; > startsAt |
| `usageLimit` | ❌ | Nguyên dương nếu gửi; null = vô hạn |
| `description` | ❌ | string nếu gửi |
| `isActive` | ❌ | boolean nếu gửi; default true |

**Response 201:** `{ coupon: {...} }`  
**Errors:**

| HTTP | Điều kiện |
|---|---|
| 400 | Field không hợp lệ |
| 409 | Code đã tồn tại |

---

### PUT /admin/coupons/:id
Cập nhật mã (partial update).

**Auth:** Bearer token (STAFF+)

Body: cùng schema với POST, tất cả fields đều optional.

**Response 200:** `{ coupon: {...} }`  
**Errors:** 400, 404, 409

---

### PATCH /admin/coupons/:id/status
Toggle `isActive`.

**Auth:** Bearer token (STAFF+)  
**Body:** Không cần.

**Response 200:** `{ coupon: { ...isActive: !prev } }`

---

### DELETE /admin/coupons/:id
Xóa mã.

**Auth:** Bearer token (STAFF+)

**Response 200:** `{ message: "Xóa mã giảm giá thành công" }`  
**Errors:**

| HTTP | Điều kiện |
|---|---|
| 404 | Mã không tồn tại |
| 409 | Mã đã có người sử dụng, hãy tắt thay vì xóa |
