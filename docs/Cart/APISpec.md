# API Specification
## Module: Cart
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22  
> **Auth:** Tất cả endpoints đều yêu cầu Bearer token (Customer+)

---

### GET /api/cart

**Response 200:**
```json
{
  "id": "cart-uuid",
  "userId": "user-uuid",
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-22T08:00:00.000Z",
  "items": [
    {
      "id": "item-uuid",
      "cartId": "cart-uuid",
      "variantId": "variant-uuid",
      "quantity": 2,
      "createdAt": "2026-08-10T10:00:00.000Z",
      "updatedAt": "2026-08-22T08:00:00.000Z",
      "variant": {
        "id": "variant-uuid",
        "sku": "IPH15-BLK-256",
        "color": "Đen",
        "storage": "256GB",
        "ram": null,
        "price": 30990000,
        "salePrice": 27990000,
        "stock": 15,
        "isActive": true,
        "imageUrl": null,
        "product": {
          "id": "product-uuid",
          "name": "iPhone 15 Pro",
          "slug": "iphone-15-pro",
          "images": [{ "url": "https://res.cloudinary.com/..." }]
        }
      }
    }
  ]
}
```

> Giỏ được tạo tự động nếu chưa tồn tại. Items sắp xếp `createdAt ASC`.

---

### POST /api/cart/items

**Body:**
```json
{
  "variantId": "variant-uuid",
  "quantity": 1
}
```

**Validate:** `variantId` (string, truthy); `quantity` (integer 1–100)

**Response 200:**
```json
{
  "cartId": "cart-uuid",
  "itemCount": 3
}
```

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Validation lỗi / stock không đủ / cộng dồn vượt tồn kho |
| 404 | Variant không tồn tại hoặc `isActive = false` |

---

### PUT /api/cart/items/:itemId

**Body:**
```json
{ "quantity": 3 }
```

**Validate:** `quantity` (integer 1–100)

**Response 200:**
```json
{
  "cartId": "cart-uuid",
  "itemCount": 3
}
```

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | Validation lỗi / quantity > stock |
| 404 | Giỏ không tồn tại / item không trong giỏ |

---

### DELETE /api/cart/items/:itemId

**Response 200:**
```json
{
  "cartId": "cart-uuid",
  "itemCount": 2
}
```

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 404 | Giỏ không tồn tại / item không trong giỏ |

---

### DELETE /api/cart

**Response 200:** `{ message: "..." }` hoặc `204 No Content`

> Cart record vẫn giữ nguyên; chỉ xóa tất cả CartItem.
