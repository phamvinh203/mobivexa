# Test Case Document
## Module: Product
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| Listing public | 7 |
| Chi tiết public | 3 |
| Tạo sản phẩm | 8 |
| Cập nhật sản phẩm | 5 |
| Xóa sản phẩm | 2 |
| Toggle status/featured | 2 |
| Quản lý ảnh | 6 |
| Quản lý specs | 4 |
| Quản lý variant | 7 |
| Tồn kho | 3 |
| Inventory report | 3 |
| **Tổng** | **50** |

---

## TC-LIST: Listing public

### TC-LIST-01: Listing cơ bản — chỉ isActive

**Expected:**
- `200`
- Tất cả `products[].isActive = true`
- Chỉ variant `isActive = true` trong mỗi sản phẩm
- Không có `description` trong response

---

### TC-LIST-02: Lọc theo category slug

**Input:** `?category=dien-thoai`  
**Expected:** Tất cả products thuộc category slug `dien-thoai`

---

### TC-LIST-03: Lọc giá hợp lệ

**Input:** `?minPrice=10000000&maxPrice=30000000`  
**Expected:** Products có ít nhất 1 variant active với `salePrice` trong khoảng

---

### TC-LIST-04: minPrice > maxPrice → 400

**Input:** `?minPrice=30000000&maxPrice=10000000`  
**Expected:** `400`

---

### TC-LIST-05: minPrice không phải số → 400

**Input:** `?minPrice=abc`  
**Expected:** `400`

---

### TC-LIST-06: Search FTS

**Input:** `?search=iphone`  
**Expected:** Products có `name` chứa "iphone" (case-insensitive, GIN index)

---

### TC-LIST-07: Search không tìm thấy — trả rỗng

**Input:** `?search=xyzxyz_không_tồn_tại`  
**Expected:** `200 { products: [], pagination: { total: 0 } }`

---

## TC-DETAIL: Chi tiết public

### TC-DETAIL-01: Xem chi tiết hợp lệ

**Expected:**
- `200`
- `description` có trong response
- `specs` sắp xếp theo `sortOrder`
- `images` sắp xếp theo `sortOrder`

---

### TC-DETAIL-02: Slug không tồn tại → 404

**Input:** slug ngẫu nhiên  
**Expected:** `404`

---

### TC-DETAIL-03: Product isActive=false → 404

**Precondition:** Sản phẩm đang có `isActive = false`  
**Expected:** `404`

---

## TC-CREATE: Tạo sản phẩm

### TC-CREATE-01: Tạo thành công với ảnh và specs

**Input:** multipart/form-data đầy đủ  
**Expected:**
- `201`
- `product.slug` khác rỗng
- Ảnh đầu tiên `isCover = true`
- `variants.length >= 1`

---

### TC-CREATE-02: Tạo không có slug — tự sinh từ name

**Input:** Không có `slug` field  
**Expected:** `product.slug` được sinh từ `name`

---

### TC-CREATE-03: SKU trùng trong payload → 409

**Input:** variants chứa 2 item cùng SKU  
**Expected:** `409 SKU bị trùng trong danh sách phiên bản`

---

### TC-CREATE-04: SKU đã tồn tại trong DB → 409

**Precondition:** SKU đã được dùng bởi sản phẩm khác  
**Expected:** `409 SKU đã tồn tại: ...`

---

### TC-CREATE-05: Category không tồn tại → 400

**Expected:** `400 Danh mục không tồn tại`

---

### TC-CREATE-06: Brand không tồn tại → 400

**Expected:** `400 Thương hiệu không tồn tại`

---

### TC-CREATE-07: originalPrice <= 0 → 400 (validator)

**Input:** `originalPrice: 0`  
**Expected:** `400 Giá gốc phải là số nguyên lớn hơn 0`

---

### TC-CREATE-08: salePrice > originalPrice → 400 (validator)

**Input:** `originalPrice: 100, salePrice: 200`  
**Expected:** `400 Giá bán không được lớn hơn giá gốc`

---

## TC-UPDATE: Cập nhật sản phẩm

### TC-UPDATE-01: Cập nhật name + tags

**Input:** `{ name: "Tên mới", tagIds: ["uuid1"] }`  
**Expected:** `200`; tags cũ bị xóa, tag mới được gắn; `product.name = "Tên mới"`

---

### TC-UPDATE-02: Slug rỗng → sinh lại từ name hiện tại

**Input:** `{ slug: "" }`  
**Expected:** `slug` được sinh lại từ `product.name` hiện tại

---

### TC-UPDATE-03: Product không tồn tại → 404

**Input:** ID ngẫu nhiên  
**Expected:** `404`

---

### TC-UPDATE-04: Thêm ảnh qua PUT — ảnh cũ giữ nguyên

**Input:** PUT với files mới  
**Expected:** ảnh cũ vẫn còn; ảnh mới có `isCover = false`; `sortOrder = existingCount + i`

---

### TC-UPDATE-05: categoryId không tồn tại → 400

**Input:** `{ categoryId: "uuid-không-có" }`  
**Expected:** `400`

---

## TC-DELETE: Xóa sản phẩm

### TC-DELETE-01: Xóa thành công — cascade

**Expected:** `200`; product không còn trong DB; variants, images, specs cũng bị xóa (cascade)

---

### TC-DELETE-02: Ảnh Cloudinary được gọi destroyImage async

**Expected:** `destroyImage` được gọi với publicId của từng ảnh (mock Cloudinary)

---

## TC-TOGGLE: Toggle status/featured

### TC-TOGGLE-01: toggleStatus flip isActive

**Precondition:** `isActive = true`  
**Expected:** `200`; `isActive = false` trong DB

---

### TC-TOGGLE-02: toggleFeatured flip isFeatured

**Precondition:** `isFeatured = false`  
**Expected:** `200`; `isFeatured = true` trong DB

---

## TC-IMG: Quản lý ảnh

### TC-IMG-01: Thêm ảnh khi chưa có ảnh nào — ảnh đầu là cover

**Precondition:** Product chưa có ảnh nào  
**Expected:** ảnh đầu `isCover = true`

---

### TC-IMG-02: Thêm ảnh khi đã có — không thay cover

**Precondition:** Đã có ảnh cover  
**Expected:** ảnh mới `isCover = false`; `sortOrder = existingCount + i`

---

### TC-IMG-03: Xóa ảnh cover → auto-set cover tiếp theo

**Precondition:** 2 ảnh; ảnh đầu là cover  
**Expected:** Ảnh thứ 2 trở thành cover sau khi xóa ảnh đầu

---

### TC-IMG-04: Xóa ảnh cuối cùng — không auto-set cover

**Precondition:** 1 ảnh (isCover=true)  
**Expected:** `200`; không có ảnh nào còn trong DB

---

### TC-IMG-05: Xóa ảnh sai productId → 404

**Input:** imageId của product khác  
**Expected:** `404`

---

### TC-IMG-06: Set cover — transaction clear + set

**Expected:** Chỉ đúng 1 ảnh có `isCover = true`; các ảnh còn lại `isCover = false`

---

## TC-SPEC: Quản lý specs

### TC-SPEC-01: Thay thế toàn bộ specs

**Input:** `{ specs: [{label: "CPU", value: "A17 Pro"}, {label: "RAM", value: "8GB"}] }`  
**Expected:** `200`; specs cũ bị xóa; 2 specs mới với `sortOrder = 0, 1`

---

### TC-SPEC-02: Mảng rỗng — xóa sạch specs

**Input:** `{ specs: [] }`  
**Expected:** `200 []`; không còn spec nào trong DB

---

### TC-SPEC-03: Label rỗng → 400

**Input:** `{ specs: [{ label: "", value: "test" }] }`  
**Expected:** `400`

---

### TC-SPEC-04: Vượt 60 dòng → 400

**Input:** Array 61 phần tử  
**Expected:** `400 Tối đa 60 dòng thông số`

---

## TC-VARIANT: Quản lý variant

### TC-VARIANT-01: Thêm variant thành công

**Expected:** `201`; SKU unique; `stock = 0` nếu không truyền

---

### TC-VARIANT-02: Thêm variant SKU trùng → 409

**Expected:** `409`

---

### TC-VARIANT-03: Cập nhật partial — chỉ salePrice

**Input:** `{ salePrice: 25000000 }`  
**Precondition:** `originalPrice = 30000000`  
**Expected:** `200`; `salePrice = 25000000`; `originalPrice` không đổi

---

### TC-VARIANT-04: Update salePrice > originalPrice hiện tại → 400

**Precondition:** `originalPrice = 20000000`  
**Input:** `{ salePrice: 25000000 }` (không gửi originalPrice)  
**Expected:** `400 Giá bán không được lớn hơn giá gốc`

---

### TC-VARIANT-05: Xóa variant — còn >= 2 variant

**Expected:** `200`; variant không còn trong DB

---

### TC-VARIANT-06: Xóa variant cuối → 409

**Precondition:** Chỉ còn 1 variant  
**Expected:** `409 Sản phẩm phải có ít nhất một phiên bản`

---

### TC-VARIANT-07: Variant sai productId → 404

**Input:** variantId của product khác  
**Expected:** `404`

---

## TC-STOCK: Tồn kho

### TC-STOCK-01: Cập nhật stock thành công (không có expectedStock)

**Input:** `{ stock: 50 }`  
**Expected:** `200`; `variant.stock = 50`

---

### TC-STOCK-02: Optimistic lock — expectedStock khớp

**Input:** `{ stock: 50, expectedStock: 15 }` khi DB có `stock = 15`  
**Expected:** `200`

---

### TC-STOCK-03: Optimistic lock — expectedStock không khớp → 409

**Input:** `{ stock: 50, expectedStock: 15 }` khi DB có `stock = 20`  
**Expected:** `409 Tồn kho đã thay đổi (hiện tại 20)`

---

## TC-INVENTORY: Báo cáo tồn kho

### TC-INV-01: Filter out_of_stock

**Input:** `?stockStatus=out_of_stock`  
**Expected:** Tất cả variants trả về có `stock = 0`

---

### TC-INV-02: Summary cache 60 giây

**Precondition:** Gọi inventory lần 1; update stock DB; gọi lần 2 trong 60s  
**Expected:** Summary của lần 2 giống lần 1 (cache chưa hết hạn)

---

### TC-INV-03: Summary cache phân biệt theo lowThreshold

**Input:** Gọi `?lowThreshold=5` rồi `?lowThreshold=20`  
**Expected:** 2 lần trả `lowStock` khác nhau (không dùng chung cache)

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Public chỉ thấy isActive=true | TC-LIST-01, TC-DETAIL-03 |
| description bị omit trong listing | TC-LIST-01 |
| Giá phải là integer VND | TC-CREATE-07, TC-CREATE-08 |
| SKU unique toàn hệ thống | TC-CREATE-03, TC-CREATE-04 |
| Slug tự sinh | TC-CREATE-02 |
| isCover logic khi thêm/xóa ảnh | TC-IMG-01, TC-IMG-03, TC-IMG-04 |
| replaceSpecs là replace-all | TC-SPEC-01, TC-SPEC-02 |
| Không thể xóa variant cuối | TC-VARIANT-06 |
| Optimistic lock tồn kho | TC-STOCK-02, TC-STOCK-03 |
| updateVariant cross-validate giá sau merge | TC-VARIANT-04 |
| Inventory summary cache theo threshold | TC-INV-02, TC-INV-03 |
| destroyImage fire-and-forget | TC-DELETE-02 |
