# SRS — Software Requirement Specification
## Module: Inventory
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22 | **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Endpoints tổng quan

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/admin/inventory` | STAFF+ | Danh sách biến thể + tóm tắt tồn kho |

**Chỉ một endpoint — read-only report.**

---

## 2. Yêu cầu chức năng

### FR-01: Xem tồn kho

**Query params:**

| Param | Type | Default | Mô tả |
|---|---|---|---|
| `page` | number | 1 | Trang |
| `limit` | number | LIMITS.INVENTORY | Số bản ghi/trang (max LIMITS.MAX_INVENTORY) |
| `search` | string | — | Tìm theo tên sản phẩm (Full Text Search) |
| `brandSlug` | string | — | Lọc theo brand |
| `stockStatus` | string | — | `out_of_stock` \| `low_stock` \| `in_stock` |
| `lowThreshold` | number | 5 | Ngưỡng "tồn thấp" (min 1) |

**Xử lý:**

1. `parsePagination(query, LIMITS.INVENTORY, LIMITS.MAX_INVENTORY)`
2. `threshold = Math.max(1, Number(query.lowThreshold) || 5)`
3. Khởi động `getInventorySummary(threshold)` song song (hoặc lấy cache)
4. Build `WHERE` từ các filter
5. Nếu `search` có giá trị → Full Text Search trên bảng `products`
6. Nếu `brandSlug` → filter `product.brand.slug = brandSlug`
7. `stockStatus` filter:
   - `out_of_stock`: `stock = 0`
   - `low_stock`: `0 < stock <= threshold`
   - `in_stock`: `stock > threshold`
8. Song song: `findMany + count` biến thể, await `summaryPromise`
9. Trả `{ variants, summary, pagination }`

**Sort:** `stock ASC` — biến thể tồn ít nhất luôn ở đầu.

---

## 3. Cơ chế Full Text Search

```sql
SELECT id FROM products
WHERE to_tsvector('simple', name) @@ to_tsquery('simple', ${tsQuery})
```

- Dùng `prisma.$queryRaw` — Prisma ORM không hỗ trợ `to_tsvector` trực tiếp
- `toTsQuery(search)` chuyển chuỗi thành query FTS hợp lệ
- Nếu sau khi parse không có token nào → trả kết quả rỗng ngay (không query variant)

---

## 4. Cấu trúc response

```typescript
{
  variants: [
    {
      id, sku, color, storage, ram,
      imageUrl, stock, isActive, salePrice,
      product: {
        id, name, slug,
        category: { name },
        brand: { name },
        images: [{ url }]  // isCover=true, take: 1
      }
    }
  ],
  summary: {
    totalVariants: number,  // tổng biến thể
    totalStock:    number,  // tổng số lượng
    outOfStock:    number,  // số biến thể hết hàng (stock=0)
    lowStock:      number,  // số biến thể tồn thấp (0 < stock <= threshold)
    threshold:     number   // ngưỡng đang dùng (để FE hiển thị đúng nhãn)
  },
  pagination: { page, limit, total, totalPages }
}
```

---

## 5. In-memory Cache cho Summary

```typescript
let inventorySummaryCache: {
  threshold: number
  data: InventorySummary
  expiresAt: number
} | null = null

const SUMMARY_CACHE_TTL_MS = 60_000  // 60 giây
```

**Logic:**
- Cache được keyed theo `threshold` — `lowThreshold=5` và `lowThreshold=20` có cache riêng
- Hết TTL → tính lại qua 3 query song song: `aggregate`, `count outOfStock`, `count lowStock`
- Không invalidate cache khi tồn kho thay đổi — chấp nhận lag 60s cho summary

---

## 6. Yêu cầu phi chức năng

| | |
|---|---|
| **Performance** | Summary cache 60s — tránh 3 COUNT query mỗi request |
| **Search** | FTS dùng index `to_tsvector` — nhanh hơn ILIKE trên bảng lớn |
| **Sort** | `stock ASC` — hiển thị cần xử lý gấp trước |
| **Auth** | STAFF_ROLES — Staff có quyền, không chỉ Admin |
