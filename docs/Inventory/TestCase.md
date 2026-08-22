# Test Case Document
## Module: Inventory
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| Auth | 3 |
| Trả dữ liệu cơ bản | 3 |
| stockStatus filter | 3 |
| lowThreshold | 2 |
| search (FTS) | 3 |
| brandSlug filter | 2 |
| Summary cache | 2 |
| **Tổng** | **18** |

---

## TC-AUTH: Phân quyền

### TC-AUTH-01: ADMIN xem được

**Input:** `GET /api/admin/inventory` với ADMIN token  
**Expected:** `200`

---

### TC-AUTH-02: STAFF xem được

**Input:** `GET /api/admin/inventory` với STAFF token  
**Expected:** `200` (khác Admin module — STAFF có quyền)

---

### TC-AUTH-03: CUSTOMER không có quyền → 403

**Input:** `GET /api/admin/inventory` với CUSTOMER token  
**Expected:** `403`

---

## TC-BASE: Dữ liệu cơ bản

### TC-BASE-01: Trả đủ 3 phần: variants, summary, pagination

**Input:** `GET /api/admin/inventory`  
**Expected:**
- `data.variants` là mảng
- `data.summary.totalVariants` là number
- `data.summary.outOfStock` là number
- `data.summary.lowStock` là number
- `data.summary.threshold === 5` (default)
- `data.pagination` có `total`, `page`, `totalPages`

---

### TC-BASE-02: Sắp xếp stock ASC

**Precondition:** Có 3 variant với stock = 0, 3, 10  
**Expected:** Thứ tự: stock=0 → stock=3 → stock=10

---

### TC-BASE-03: Phân trang hoạt động

**Input:** `?page=1&limit=2` với 5 biến thể  
**Expected:**
- `data.variants.length === 2`
- `data.pagination.total === 5`
- `data.pagination.totalPages === 3`

---

## TC-STOCK-FILTER: Lọc theo stockStatus

### TC-FILTER-01: out_of_stock chỉ trả biến thể stock=0

**Input:** `?stockStatus=out_of_stock`  
**Expected:** Mọi biến thể trong response có `stock === 0`

---

### TC-FILTER-02: low_stock chỉ trả biến thể trong ngưỡng

**Input:** `?stockStatus=low_stock` (threshold mặc định = 5)  
**Expected:** Mọi biến thể có `0 < stock <= 5`

---

### TC-FILTER-03: in_stock chỉ trả biến thể stock > threshold

**Input:** `?stockStatus=in_stock`  
**Expected:** Mọi biến thể có `stock > 5`

---

## TC-THRESHOLD: Ngưỡng tồn thấp tùy chỉnh

### TC-THRESHOLD-01: lowThreshold=10 mở rộng vùng low_stock

**Input:** `?stockStatus=low_stock&lowThreshold=10`  
**Expected:**
- Biến thể có `stock = 8` xuất hiện (với threshold=5 thì không)
- `data.summary.threshold === 10`

---

### TC-THRESHOLD-02: lowThreshold=0 hoặc âm → dùng 1

**Input:** `?stockStatus=low_stock&lowThreshold=0`  
**Expected:** `data.summary.threshold === 1` (Math.max(1, ...))

---

## TC-SEARCH: Full Text Search

### TC-SEARCH-01: Tìm theo tên sản phẩm

**Precondition:** Sản phẩm "iPhone 15 Pro" tồn tại  
**Input:** `?search=iPhone`  
**Expected:** Chỉ biến thể của sản phẩm có "iPhone" trong tên

---

### TC-SEARCH-02: Tìm không có kết quả → variants rỗng

**Input:** `?search=xyznotexist123`  
**Expected:**
- `data.variants === []`
- `data.pagination.total === 0`
- `data.summary` vẫn được trả về (summary toàn kho)

---

### TC-SEARCH-03: Search kết hợp stockStatus

**Input:** `?search=iPhone&stockStatus=out_of_stock`  
**Expected:** Chỉ biến thể iPhone có `stock === 0`

---

## TC-BRAND: Lọc theo brand

### TC-BRAND-01: Chỉ trả biến thể của brand

**Input:** `?brandSlug=apple`  
**Expected:** Mọi biến thể có `product.brand.name === "Apple"`

---

### TC-BRAND-02: Brand không tồn tại → variants rỗng

**Input:** `?brandSlug=nonexistent-brand`  
**Expected:** `data.variants === []`

---

## TC-CACHE: Summary cache

### TC-CACHE-01: Gọi 2 lần cùng threshold — query chỉ chạy 1 lần

**Action:** Gọi `GET /api/admin/inventory` 2 lần liên tiếp  
**Verify (mock):** `prisma.productVariant.aggregate` chỉ được gọi 1 lần (lần 2 lấy cache)

---

### TC-CACHE-02: threshold khác nhau → cache riêng

**Action:**
1. `GET /api/admin/inventory?lowThreshold=5`
2. `GET /api/admin/inventory?lowThreshold=20`

**Expected:**
- Response 1: `summary.threshold === 5`
- Response 2: `summary.threshold === 20`
- Aggregate được gọi 2 lần (cache riêng biệt)

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| STAFF có quyền (khác Admin module) | TC-AUTH-02 |
| Sort stock ASC | TC-BASE-02 |
| out_of_stock filter | TC-FILTER-01 |
| low_stock filter | TC-FILTER-02 |
| in_stock filter | TC-FILTER-03 |
| lowThreshold tùy chỉnh | TC-THRESHOLD-01 |
| Math.max(1, threshold) | TC-THRESHOLD-02 |
| FTS tìm tên sản phẩm | TC-SEARCH-01 |
| FTS không kết quả → rỗng (summary vẫn trả) | TC-SEARCH-02 |
| Summary cache 60s | TC-CACHE-01 |
| Cache theo threshold | TC-CACHE-02 |
