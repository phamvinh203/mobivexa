# Use Case Document
## Module: Inventory
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Staff / Admin** | Xem báo cáo tồn kho |

---

## 2. Danh sách Use Case

| ID | Tên | Ưu tiên |
|---|---|---|
| UC-01 | Xem tổng quan tồn kho | Cao |
| UC-02 | Lọc biến thể theo tình trạng tồn | Cao |
| UC-03 | Tìm kiếm sản phẩm trong kho | Trung bình |
| UC-04 | Lọc theo brand | Thấp |

> Tất cả UC đều dùng cùng một endpoint. Tách UC để thể hiện các use case sử dụng riêng biệt.

---

## 3. Chi tiết Use Case

---

### UC-01: Xem tổng quan tồn kho

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Nắm nhanh số liệu tồn kho toàn hệ thống |
| **Tiền điều kiện** | Đã đăng nhập STAFF+ |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/admin/inventory`
2. Tính summary (hoặc lấy từ cache)
3. Query biến thể sắp `stock ASC`
4. Trả `{ variants, summary, pagination }`

**Summary bao gồm:**
- `totalVariants` — tổng số biến thể
- `totalStock` — tổng số lượng hàng
- `outOfStock` — số biến thể hết hàng
- `lowStock` — số biến thể tồn thấp (theo ngưỡng)
- `threshold` — ngưỡng đang dùng

---

### UC-02: Lọc biến thể theo tình trạng tồn

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Tập trung vào nhóm biến thể cần xử lý |
| **Tiền điều kiện** | Đã đăng nhập STAFF+ |

**Luồng chính:**
1. `GET /api/admin/inventory?stockStatus=out_of_stock`
2. Build `WHERE stock = 0`
3. Trả danh sách biến thể hết hàng

**Ba trạng thái:**

| `stockStatus` | Điều kiện DB | Ý nghĩa |
|---|---|---|
| `out_of_stock` | `stock = 0` | Hết hàng hoàn toàn |
| `low_stock` | `0 < stock <= threshold` | Tồn thấp, sắp hết |
| `in_stock` | `stock > threshold` | Còn hàng đầy đủ |

**Tùy chỉnh ngưỡng:** `?stockStatus=low_stock&lowThreshold=10` → low = 1..10

---

### UC-03: Tìm kiếm sản phẩm trong kho

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xem tồn kho của sản phẩm cụ thể |

**Luồng chính:**
1. `GET /api/admin/inventory?search=iPhone`
2. FTS trên `products.name` → lấy `productId[]`
3. Filter variant `WHERE productId IN [...]`
4. Trả biến thể của các sản phẩm khớp

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| `search` không ra token FTS hợp lệ | Trả `{ variants: [], summary, pagination: total=0 }` ngay |
| Không có sản phẩm nào khớp | Trả `{ variants: [], ... }` |

---

### UC-04: Lọc theo brand

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xem tồn kho của một brand cụ thể |

**Luồng chính:**
1. `GET /api/admin/inventory?brandSlug=apple`
2. `WHERE product.brand.slug = 'apple'`
3. Trả danh sách biến thể của brand đó

---

## 4. Kết hợp filter

Các filter có thể kết hợp tự do:

```
?search=iPhone&brandSlug=apple&stockStatus=low_stock&lowThreshold=10
```
→ Biến thể iPhone của Apple có tồn 1..10 — xử lý FTS trước, rồi apply các WHERE còn lại.

---

## 5. So sánh với Product list

| Tiêu chí | Inventory | Product List (public) |
|---|---|---|
| Đơn vị | Variant | Product |
| Sort | stock ASC | relevance / price |
| Summary | ✅ (cache 60s) | ❌ |
| Search | FTS (to_tsvector) | FTS (to_tsvector) |
| Auth | STAFF+ | Public |
| Filter | stockStatus + brand | category + tag + price |
