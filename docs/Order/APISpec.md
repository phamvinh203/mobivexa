# API Specification
## Module: Order
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## Customer Endpoints

### POST /api/orders

**Auth:** Customer+

**Body:**
```json
{
  "addressId": "uuid",
  "paymentMethod": "COD",
  "note": "Giao buổi sáng",
  "couponCode": "SUMMER20",
  "items": [
    { "variantId": "uuid", "quantity": 2 }
  ]
}
```

> `items` optional — nếu bỏ qua, hệ thống lấy từ giỏ hàng.  
> `paymentMethod` optional, default `COD`.

**Response 201:**
```json
{
  "id": "uuid",
  "orderCode": "ORD-20260822-A1B2C3",
  "userId": "uuid",
  "shippingName": "Nguyễn Văn A",
  "shippingPhone": "0901234567",
  "shippingProvince": "Hồ Chí Minh",
  "shippingDistrict": "Quận 1",
  "shippingWard": "Phường Bến Nghé",
  "shippingDetail": "123 Đường Lê Lợi",
  "subtotal": 27990000,
  "shippingFee": 0,
  "discount": 2799000,
  "total": 25191000,
  "status": "PENDING",
  "paymentMethod": "COD",
  "paymentStatus": "UNPAID",
  "note": "Giao buổi sáng",
  "couponCode": "SUMMER20",
  "paidAt": null,
  "createdAt": "2026-08-22T08:00:00.000Z",
  "updatedAt": "2026-08-22T08:00:00.000Z",
  "items": [
    {
      "id": "uuid",
      "orderId": "uuid",
      "variantId": "uuid",
      "productName": "iPhone 15 Pro",
      "sku": "IPH15-BLK-256",
      "color": "Đen",
      "storage": "256GB",
      "ram": null,
      "unitPrice": 27990000,
      "quantity": 1,
      "subtotal": 27990000
    }
  ]
}
```

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Validation lỗi / giỏ rỗng / variant không active / stock không đủ |
| 404 | Address không tồn tại hoặc không phải của user |
| 409 | Coupon hết lượt / đã dùng mã này rồi |

---

### GET /api/orders

**Auth:** Customer+

**Query params:**

| Param | Mô tả |
|---|---|
| `status` | PENDING \| CONFIRMED \| SHIPPING \| DELIVERED \| CANCELLED |
| `page`, `limit` | Phân trang |

**Response 200:**
```json
{
  "orders": [ /* Order objects, include items */ ],
  "pagination": { "page": 1, "limit": 10, "total": 5, "totalPages": 1 }
}
```

---

### GET /api/orders/:id

**Auth:** Chủ đơn hàng

**Response 200:** Order object (include items)

**Lỗi:** `404`

---

### PATCH /api/orders/:id/cancel

**Auth:** Chủ đơn hàng

**Body:** (không bắt buộc)
```json
{ "reason": "Tôi muốn đổi địa chỉ" }
```

> Lý do mặc định nếu không truyền: `'Khách hàng hủy đơn'`

**Response 200:** Order đã CANCELLED

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Trạng thái không cho phép hủy |
| 404 | Đơn không tồn tại hoặc không phải của user |
| 409 | Concurrency: đơn vừa được cập nhật |

---

## Admin Endpoints (STAFF+)

### GET /api/admin/orders

**Auth:** STAFF+

**Query params:**

| Param | Mô tả |
|---|---|
| `search` | Tìm theo orderCode (contains, insensitive) |
| `status` | Lọc theo OrderStatus |
| `userId` | Lọc theo user |
| `paymentMethod` | COD \| BANK_TRANSFER |
| `paymentStatus` | UNPAID \| PAID \| REFUNDED |
| `from`, `to` | Date range theo `createdAt` |
| `page`, `limit` | Phân trang |

**Response 200:**
```json
{
  "orders": [
    {
      "id": "uuid",
      "orderCode": "ORD-20260822-A1B2C3",
      "status": "PENDING",
      "paymentStatus": "UNPAID",
      "total": 25191000,
      "createdAt": "...",
      "_count": { "items": 2 },
      "user": { "id": "uuid", "fullName": "Nguyễn Văn A", "email": "user@example.com" }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 120, "totalPages": 12 }
}
```

> Admin list **không** trả `items[]` đầy đủ, chỉ `_count.items`.

---

### GET /api/admin/orders/:id

**Auth:** STAFF+

**Response 200:** Order object đầy đủ (include items[])

**Lỗi:** `404`

---

### PATCH /api/admin/orders/:id/status

**Auth:** STAFF+

**Body:**
```json
{
  "status": "CONFIRMED",
  "cancelReason": "Hàng hết" 
}
```

> `cancelReason` bắt buộc khi `status = CANCELLED`

**Validate:** `status` phải là OrderStatus enum; transition phải hợp lệ theo `VALID_TRANSITIONS`

**Response 200:** Order đã cập nhật

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Enum không hợp lệ / transition không hợp lệ / thiếu cancelReason |
| 404 | Đơn không tồn tại |
| 409 | Concurrency conflict |

---

### PATCH /api/admin/orders/:id/payment

**Auth:** STAFF+

**Body:**
```json
{ "paymentStatus": "PAID" }
```

**Response 200:** Order đã cập nhật (include items)

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | paymentStatus không hợp lệ |
| 404 | Đơn không tồn tại |
