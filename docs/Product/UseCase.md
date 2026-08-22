# Use Case Document
## Module: Product
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## Actors

| Actor | Mô tả |
|---|---|
| **Guest / Customer** | Xem catalog, tìm kiếm, xem chi tiết |
| **Staff / Admin** | Quản lý sản phẩm, variant, ảnh, specs, tồn kho |

---

## UC-01: Xem danh sách sản phẩm

**Actor:** Guest / Customer  
**Main Flow:**
1. Client gửi `GET /products` với các filter tùy chọn
2. Hệ thống lọc `isActive = true`, áp dụng filter (category, brand, tag, price range, search)
3. Nếu `search` → FTS GIN index trên `name`
4. Hệ thống sắp xếp (default: `createdAt DESC`), phân trang
5. Trả danh sách (không có `description` — chỉ có ở detail)

**Alt:** `minPrice > maxPrice` → 400; giá không phải số hợp lệ → 400

---

## UC-02: Xem sản phẩm nổi bật

**Actor:** Guest / Customer  
**Main Flow:**
1. `GET /products/featured`
2. Hệ thống lấy sản phẩm `isActive=true AND isFeatured=true` (take=8 default)
3. Trả danh sách kèm brand, variant active, ảnh cover

---

## UC-03: Xem chi tiết sản phẩm

**Actor:** Guest / Customer  
**Main Flow:**
1. `GET /products/:slug`
2. Hệ thống tìm theo `slug`; `!product || !product.isActive` → 404
3. Trả đầy đủ: category, brand, variants, tags, images, specs

---

## UC-04: Tạo sản phẩm mới

**Actor:** Staff / Admin  
**Main Flow:**
1. `POST /admin/products` (multipart/form-data) với name, slug?, categoryId, brandId, variants (JSON), specs? (JSON), tagIds? (JSON), images?
2. Validate: name, categoryId, brandId, variants (>= 1), giá integer, SKU unique
3. Parallel: assertCategory + assertBrand + assertTags + assertSkusAvailable
4. `generateUniqueSlug(slug || name)`
5. Upload ảnh parallel (nếu có)
6. `product.create` (variants + specs + tags + images cùng 1 câu)
7. Ảnh đầu tiên → `isCover = true`

**Alt:** Category/Brand không tồn tại → 400; SKU trùng → 409

---

## UC-05: Cập nhật sản phẩm

**Actor:** Staff / Admin  
**Precondition:** Sản phẩm tồn tại  
**Main Flow:**
1. `PUT /admin/products/:id` — partial update
2. Slug rỗng → sinh lại từ `name`
3. Nếu có `tagIds` → transaction: xóa tags cũ + tạo tags mới + update product
4. Files mới → upload + gán `sortOrder = existingCount + i`, `isCover = false`

**Alt:** Product không tồn tại → 404

---

## UC-06: Xóa sản phẩm

**Actor:** Staff / Admin  
**Main Flow:**
1. `DELETE /admin/products/:id`
2. Lấy publicId ảnh TRƯỚC khi xóa
3. `product.delete` (cascade)
4. `destroyImage` async (fire-and-forget)

---

## UC-07: Toggle trạng thái / nổi bật

**Actor:** Staff / Admin  
**Main Flow:**
- `PATCH /:id/status` → flip `isActive`
- `PATCH /:id/featured` → flip `isFeatured`

---

## UC-08: Quản lý ảnh sản phẩm

**Actor:** Staff / Admin  
**Sub-cases:**

**UC-08a: Thêm ảnh**
1. `POST /:id/images` (multipart/form-data)
2. Parallel: upload + count existing
3. `createMany`; nếu chưa có ảnh nào → ảnh đầu tiên làm cover

**UC-08b: Xóa ảnh**
1. `DELETE /:id/images/:imageId`
2. Ownership check → 404
3. `delete` + `destroyImage` async
4. Nếu là cover → tìm ảnh tiếp theo → set làm cover

**UC-08c: Set ảnh cover**
1. `PATCH /:id/images/:imageId/cover`
2. Transaction: clear all isCover + set imageId làm cover

---

## UC-09: Thay thế thông số kỹ thuật

**Actor:** Staff / Admin  
**Main Flow:**
1. `PUT /:id/specs` với `{ specs: [{ label, value }, ...] }`
2. Transaction: `deleteMany` + `createMany` (nếu không rỗng)
3. Mảng rỗng → xóa sạch toàn bộ specs

---

## UC-10: Quản lý phiên bản (variant)

**Actor:** Staff / Admin  

**UC-10a: Thêm variant**
1. `POST /:id/variants` — assertSkusAvailable + create

**UC-10b: Cập nhật variant (partial)**
1. `PUT /:id/variants/:variantId`
2. Ownership check → 404
3. Merge giá hiện tại với giá mới; `nextSale > nextOriginal` → 400

**UC-10c: Cập nhật tồn kho**
1. `PATCH /:id/variants/:variantId/stock`
2. `expectedStock` tùy chọn; nếu có và khác DB → 409

**UC-10d: Xóa variant**
1. `DELETE /:id/variants/:variantId`
2. Parallel: ownership check + count
3. `totalCount <= 1` → 409 (không thể xóa variant cuối)

---

## UC-11: Báo cáo tồn kho

**Actor:** Staff / Admin  
**Main Flow:**
1. `GET /admin/inventory` với filter (search, brandSlug, stockStatus, lowThreshold, page, limit)
2. Hệ thống tính summary (cache 60s theo threshold)
3. Trả variants + summary + pagination
