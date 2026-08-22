# API Specification
## Module: Inventory
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22  
> **Auth:** Bearer token (STAFF hoặc ADMIN)

---

### GET /admin/inventory
Danh sách biến thể kèm báo cáo tồn kho.

**Auth:** Bearer token (STAFF+)

**Query params:**

| Param | Type | Default | Mô tả |
|---|---|---|---|
| `page` | number | 1 | Trang hiện tại |
| `limit` | number | LIMITS.INVENTORY | Số biến thể/trang |
| `search` | string | — | Tìm theo tên sản phẩm (Full Text Search) |
| `brandSlug` | string | — | Lọc theo slug của brand |
| `stockStatus` | string | — | `out_of_stock` \| `low_stock` \| `in_stock` |
| `lowThreshold` | number | 5 | Ngưỡng xác định "tồn thấp" (min 1) |

**Response 200:**
```json
{
  "variants": [
    {
      "id": "var-uuid",
      "sku": "IPH15-BLK-256",
      "color": "Black",
      "storage": "256GB",
      "ram": null,
      "imageUrl": "https://res.cloudinary.com/...",
      "stock": 2,
      "isActive": true,
      "salePrice": 27990000,
      "product": {
        "id": "prod-uuid",
        "name": "iPhone 15 Pro",
        "slug": "iphone-15-pro",
        "category": { "name": "Điện thoại" },
        "brand": { "name": "Apple" },
        "images": [{ "url": "https://..." }]
      }
    }
  ],
  "summary": {
    "totalVariants": 142,
    "totalStock": 856,
    "outOfStock": 12,
    "lowStock": 23,
    "threshold": 5
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 35,
    "totalPages": 1
  }
}
```

**Ghi chú:**
- Biến thể được sắp xếp `stock ASC` — hết hàng và sắp hết xuất hiện trước
- `summary.threshold` phản ánh ngưỡng đang được dùng (để FE hiển thị đúng label)
- `summary` được cache 60 giây — có thể lag với stock thực tế trong khung đó
- Khi `search` không khớp sản phẩm nào → `variants: []`, `pagination.total: 0`, nhưng `summary` vẫn được trả về

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 401 | Chưa đăng nhập |
| 403 | Role là CUSTOMER |

---

## Ví dụ filter

**Hết hàng:**
```
GET /api/admin/inventory?stockStatus=out_of_stock
```

**Tồn thấp với ngưỡng 10:**
```
GET /api/admin/inventory?stockStatus=low_stock&lowThreshold=10
```

**iPhone còn hàng của Apple:**
```
GET /api/admin/inventory?search=iPhone&brandSlug=apple&stockStatus=in_stock
```

**Trang 2, 20 biến thể/trang:**
```
GET /api/admin/inventory?page=2&limit=20
```
