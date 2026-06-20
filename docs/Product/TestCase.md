# Test Case Document
## Module: Product (Sản phẩm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [SRS.md](./SRS.md) | [APISpec.md](./APISpec.md)  
> **Test Framework:** Vitest + Supertest  
> **Môi trường:** Test DB (NODE_ENV=test)

---

## Tổng quan Test Suite

| Nhóm | Số TC | Phủ |
|---|---|---|
| GET /products (Public) | 6 | Danh sách sản phẩm công khai |
| GET /products/:slug (Public) | 4 | Chi tiết sản phẩm |
| GET /products/featured (Public) | 3 | Sản phẩm nổi bật |
| GET /admin/products (Admin) | 5 | Admin danh sách tất cả |
| GET /admin/products/:id (Admin) | 3 | Admin chi tiết theo ID |
| POST /admin/products (Admin) | 8 | Tạo sản phẩm |
| PUT /admin/products/:id (Admin) | 6 | Cập nhật sản phẩm |
| DELETE /admin/products/:id (Admin) | 3 | Xóa sản phẩm |
| PATCH /admin/products/:id/status (Admin) | 3 | Toggle hiển thị |
| PATCH /admin/products/:id/featured (Admin) | 3 | Toggle nổi bật |
| POST /admin/products/:id/images (Admin) | 4 | Thêm ảnh |
| DELETE /admin/products/:id/images/:imageId (Admin) | 4 | Xóa ảnh |
| PATCH /admin/products/:id/images/:imageId/cover (Admin) | 3 | Đặt ảnh bìa |
| POST /admin/products/:id/variants (Admin) | 5 | Thêm variant |
| PUT /admin/products/:id/variants/:variantId (Admin) | 4 | Cập nhật variant |
| DELETE /admin/products/:id/variants/:variantId (Admin) | 4 | Xóa variant |
| PATCH /admin/products/:id/variants/:variantId/stock (Admin) | 3 | Patch stock |
| GET /admin/inventory (Admin) | 5 | Báo cáo tồn kho |
| **Tổng cộng** | **82** | |

---

## TC-PUB: Public Endpoints

### TC-PUB-01: Danh sách sản phẩm - Happy Path

**ID:** TC-PUB-01  
**Level:** Smoke

**Input:** `GET /api/products?page=1&limit=12`

**Expected Output:**
- HTTP: `200`
- Body: `{ products: [], pagination: { page: 1, limit: 12, total: N, totalPages: M } }`
- `products` array không chứa `isActive = false`
- Mỗi product có `coverImage` và ít nhất 1 `variant` active

---

### TC-PUB-02: Danh sách sản phẩm - Filter by Category

**Input:** `GET /api/products?category=dien-thoai`

**Expected Output:**
- HTTP: `200`
- Tất cả products có `category.slug = 'dien-thoai'`

---

### TC-PUB-03: Danh sách sản phẩm - Filter by Price Range

**Input:** `GET /api/products?minPrice=10000000&maxPrice=20000000`

**Expected Output:**
- HTTP: `200`
- Tất cả products có ít nhất 1 variant với `salePrice` trong khoảng [10M, 20M]

---

### TC-PUB-04: Danh sách sản phẩm - Full-text Search

**Input:** `GET /api/products?search=iphone`

**Expected Output:**
- HTTP: `200`
- Tất cả products có `name` khớp với query "iphone" (FTS)

---

### TC-PUB-05: Danh sách sản phẩm - Sort

**Input:** `GET /api/products?sort=name_asc`

**Expected Output:**
- HTTP: `200`
- Products sorted by `name` A-Z

---

### TC-PUB-06: Danh sách sản phẩm - Limit exceeded

**Input:** `GET /api/products?limit=100`

**Expected Output:**
- HTTP: `400`
- Message: `Số item/trang tối đa là 50`

---

### TC-PUB-07: Chi tiết sản phẩm - Happy Path

**Input:** `GET /api/products/iphone-15-pro-max`

**Expected Output:**
- HTTP: `200`
- Body: Product object với đầy đủ variants, images, tags, category, brand

---

### TC-PUB-08: Chi tiết sản phẩm - Not Found

**Input:** `GET /api/products/slug-khong-ton-tai`

**Expected Output:**
- HTTP: `404`
- Message: `Sản phẩm không tồn tại`

---

### TC-PUB-09: Chi tiết sản phẩm - Inactive Product

**Precondition:** Product với slug `test-inactive` có `isActive = false`

**Input:** `GET /api/products/test-inactive`

**Expected Output:**
- HTTP: `404`
- Message: `Sản phẩm không tồn tại`

---

### TC-PUB-10: Sản phẩm nổi bật - Happy Path

**Input:** `GET /api/products/featured?limit=8`

**Expected Output:**
- HTTP: `200`
- Body: Array products với `isActive = true AND isFeatured = true`
- Sorted by `createdAt DESC`
- Max 8 products

---

### TC-PUB-11: Sản phẩm nổi bật - No featured products

**Precondition:** Không có product nào với `isFeatured = true`

**Input:** `GET /api/products/featured`

**Expected Output:**
- HTTP: `200`
- Body: `[]` (empty array)

---

### TC-PUB-12: Sản phẩm nổi bật - Limit exceeded

**Input:** `GET /api/products/featured?limit=50`

**Expected Output:**
- HTTP: `200`
- Trả về tối đa 20 products (internal cap)

---

## TC-ADMIN: Admin Endpoints

### TC-ADMIN-01: Admin danh sách - Happy Path (Auth)

**Input:** `GET /api/admin/products` với JWT token (STAFF+)

**Expected Output:**
- HTTP: `200`
- Body: `{ products: [], pagination: {} }`
- Trả về tất cả products (kể cả `isActive = false`)

---

### TC-ADMIN-02: Admin danh sách - Unauthorized (No Token)

**Input:** `GET /api/admin/products` (không có JWT token)

**Expected Output:**
- HTTP: `401`
- Message: `Không có token xác thực`

---

### TC-ADMIN-03: Admin danh sách - Forbidden (Wrong Role)

**Input:** `GET /api/admin/products` với JWT token (CUSTOMER)

**Expected Output:**
- HTTP: `403`
- Message: `Bạn không có quyền thực hiện thao tác này`

---

### TC-ADMIN-04: Admin danh sách - Filter by isActive

**Input:** `GET /api/admin/products?isActive=false`

**Expected Output:**
- HTTP: `200`
- Tất cả products với `isActive = false`

---

### TC-ADMIN-05: Admin chi tiết theo ID - Happy Path

**Input:** `GET /api/admin/products/{existing_id}`

**Expected Output:**
- HTTP: `200`
- Body: Product object đầy đủ (kể cả inactive)

---

### TC-ADMIN-06: Admin chi tiết theo ID - Not Found

**Input:** `GET /api/admin/products/non-existing-id`

**Expected Output:**
- HTTP: `404`
- Message: `Sản phẩm không tồn tại`

---

### TC-ADMIN-07: Admin chi tiết theo ID - Unauthorized

**Input:** `GET /api/admin/products/{id}` (không có JWT token)

**Expected Output:**
- HTTP: `401`

---

## TC-CREATE: Tạo sản phẩm

### TC-CREATE-01: Tạo sản phẩm - Happy Path

**Input:** `POST /api/admin/products` với form-data:
- `name`: "iPhone 15 Test"
- `categoryId`: valid category ID
- `brandId`: valid brand ID
- `variants`: JSON array with 1 variant (valid SKU, prices)
- `images`: 1 file JPG

**Expected Output:**
- HTTP: `201`
- Body: Product object với đầy đủ variants, images, tags
- `slug` được auto-generated
- `isActive = true`, `isFeatured = false`
- Ảnh đầu tiên có `isCover = true`

---

### TC-CREATE-02: Tạo sản phẩm - Name too short

**Input:** `name`: "A"

**Expected Output:**
- HTTP: `400`
- Message: `Tên sản phẩm phải có ít nhất 2 ký tự`

---

### TC-CREATE-03: Tạo sản phẩm - Missing Category

**Input:** Không gửi `categoryId`

**Expected Output:**
- HTTP: `400`
- Message: `Vui lòng chọn danh mục`

---

### TC-CREATE-04: Tạo sản phẩm - Missing Brand

**Input:** Không gửi `brandId`

**Expected Output:**
- HTTP: `400`
- Message: `Vui lòng chọn thương hiệu`

---

### TC-CREATE-05: Tạo sản phẩm - No Variants

**Input:** `variants`: `[]`

**Expected Output:**
- HTTP: `400`
- Message: `Sản phẩm phải có ít nhất một phiên bản`

---

### TC-CREATE-06: Tạo sản phẩm - SKU Duplicate in Payload

**Input:** `variants`: JSON array với 2 variants có cùng SKU

**Expected Output:**
- HTTP: `409`
- Message: `SKU bị trùng trong danh sách phiên bản`

---

### TC-CREATE-07: Tạo sản phẩm - SKU Exists in DB

**Precondition:** Variant với SKU `TEST-001` đã tồn tại trong DB

**Input:** `variants`: JSON array với SKU `TEST-001`

**Expected Output:**
- HTTP: `409`
- Message: `SKU đã tồn tại: TEST-001`

---

### TC-CREATE-08: Tạo sản phẩm - salePrice > originalPrice

**Input:** `variants`: JSON array với `originalPrice: 1000000`, `salePrice: 1500000`

**Expected Output:**
- HTTP: `400`
- Message: `Giá bán không được lớn hơn giá gốc`

---

## TC-UPDATE: Cập nhật sản phẩm

### TC-UPDATE-01: Cập nhật sản phẩm - Happy Path (Partial)

**Precondition:** Product với ID `prod_123` tồn tại

**Input:** `PUT /api/admin/products/prod_123` với form-data:
- `name`: "iPhone 15 Updated"

**Expected Output:**
- HTTP: `200`
- Body: Product object với `name` updated
- Các fields khác không đổi

---

### TC-UPDATE-02: Cập nhật sản phẩm - Add Images

**Input:** `PUT /api/admin/products/prod_123` với `images`: 2 files

**Expected Output:**
- HTTP: `200`
- 2 ảnh mới được thêm vào sau ảnh hiện có
- `sortOrder` tiếp nối từ existing count

---

### TC-UPDATE-03: Cập nhật sản phẩm - Replace Tags

**Input:** `PUT /api/admin/products/prod_123` với `tagIds`: JSON array ["tag1", "tag2"]

**Expected Output:**
- HTTP: `200`
- Tags cũ bị xóa, tags mới được tạo
- Transaction atomic

---

### TC-UPDATE-04: Cập nhật sản phẩm - Not Found

**Input:** `PUT /api/admin/products/non-existing-id`

**Expected Output:**
- HTTP: `404`
- Message: `Sản phẩm không tồn tại`

---

### TC-UPDATE-05: Cập nhật sản phẩm - Invalid Category

**Input:** `categoryId`: non-existing ID

**Expected Output:**
- HTTP: `400`
- Message: `Danh mục không tồn tại`

---

### TC-UPDATE-06: Cập nhật sản phẩm - Unauthorized

**Input:** `PUT /api/admin/products/prod_123` (không có JWT token)

**Expected Output:**
- HTTP: `401`

---

## TC-DELETE: Xóa sản phẩm

### TC-DELETE-01: Xóa sản phẩm - Happy Path

**Precondition:** Product với ID `prod_123` tồn tại, có 2 variants và 3 images

**Input:** `DELETE /api/admin/products/prod_123`

**Expected Output:**
- HTTP: `200`
- Message: `Xóa sản phẩm thành công`
- DB: Product, variants, images, tags bị xóa (cascade)
- Cloudinary: 3 images bị xóa (background)

---

### TC-DELETE-02: Xóa sản phẩm - Not Found

**Input:** `DELETE /api/admin/products/non-existing-id`

**Expected Output:**
- HTTP: `404`

---

### TC-DELETE-03: Xóa sản phẩm - Unauthorized

**Input:** `DELETE /api/admin/products/prod_123` (không có JWT token)

**Expected Output:**
- HTTP: `401`

---

## TC-STATUS: Toggle hiển thị

### TC-STATUS-01: Toggle hiển thị - Happy Path

**Precondition:** Product với `isActive = true`

**Input:** `PATCH /api/admin/products/prod_123/status` với `{ "isActive": false }`

**Expected Output:**
- HTTP: `200`
- Body: Product object với `isActive = false`

---

### TC-STATUS-02: Toggle hiển thị - Not Found

**Input:** `PATCH /api/admin/products/non-existing-id/status`

**Expected Output:**
- HTTP: `404`

---

### TC-STATUS-03: Toggle hiển thị - Unauthorized

**Input:** `PATCH /api/admin/products/prod_123/status` (không có JWT token)

**Expected Output:**
- HTTP: `401`

---

## TC-FEATURED: Toggle nổi bật

### TC-FEATURED-01: Toggle nổi bật - Happy Path

**Input:** `PATCH /api/admin/products/prod_123/featured` với `{ "isFeatured": true }`

**Expected Output:**
- HTTP: `200`
- Body: Product object với `isFeatured = true`

---

### TC-FEATURED-02: Toggle nổi bật - Not Found

**Input:** `PATCH /api/admin/products/non-existing-id/featured`

**Expected Output:**
- HTTP: `404`

---

### TC-FEATURED-03: Toggle nổi bật - Unauthorized

**Input:** `PATCH /api/admin/products/prod_123/featured` (không có JWT token)

**Expected Output:**
- HTTP: `401`

---

## TC-IMAGE: Quản lý ảnh

### TC-IMAGE-01: Thêm ảnh - Happy Path

**Input:** `POST /api/admin/products/prod_123/images` với `images`: 3 files

**Expected Output:**
- HTTP: `201`
- Body: Array 3 images
- `sortOrder` = existingCount + index
- Nếu product chưa có ảnh → ảnh đầu tiên `isCover = true`

---

### TC-IMAGE-02: Thêm ảnh - Too Many Files

**Input:** `POST /api/admin/products/prod_123/images` với 11 files

**Expected Output:**
- HTTP: `400`
- Message: `Tối đa 10 ảnh mỗi lần upload`

---

### TC-IMAGE-03: Xóa ảnh - Happy Path

**Input:** `DELETE /api/admin/products/prod_123/images/img_123`

**Expected Output:**
- HTTP: `200`
- Message: `Xóa ảnh thành công`
- Nếu ảnh là `isCover` → ảnh kế tiếp thành bìa mới

---

### TC-IMAGE-04: Xóa ảnh - Not Found

**Input:** `DELETE /api/admin/products/prod_123/images/non-existing-img`

**Expected Output:**
- HTTP: `404`

---

### TC-IMAGE-05: Đặt ảnh bìa - Happy Path

**Input:** `PATCH /api/admin/products/prod_123/images/img_123/cover`

**Expected Output:**
- HTTP: `200`
- Body: Array images với img_123 có `isCover = true`
- Các ảnh khác có `isCover = false`

---

### TC-IMAGE-06: Đặt ảnh bìa - Not Found

**Input:** `PATCH /api/admin/products/prod_123/images/non-existing-img/cover`

**Expected Output:**
- HTTP: `404`

---

## TC-VARIANT: Quản lý variant

### TC-VARIANT-01: Thêm variant - Happy Path

**Input:** `POST /api/admin/products/prod_123/variants` với:
```json
{
  "sku": "NEW-VARIANT-001",
  "color": "Đen",
  "storage": "128GB",
  "originalPrice": 20000000,
  "salePrice": 18000000,
  "stock": 10
}
```

**Expected Output:**
- HTTP: `201`
- Body: Variant object với `isActive = true`

---

### TC-VARIANT-02: Thêm variant - SKU Exists

**Precondition:** SKU `EXISTING-SKU` đã tồn tại trong DB

**Input:** `POST /api/admin/products/prod_123/variants` với `{ "sku": "EXISTING-SKU", ... }`

**Expected Output:**
- HTTP: `409`
- Message: `SKU đã tồn tại`

---

### TC-VARIANT-03: Cập nhật variant - Happy Path

**Input:** `PUT /api/admin/products/prod_123/variants/var_123` với `{ "stock": 50 }`

**Expected Output:**
- HTTP: `200`
- Body: Variant object với `stock = 50`

---

### TC-VARIANT-04: Cập nhật variant - Change SKU

**Input:** `PUT /api/admin/products/prod_123/variants/var_123` với `{ "sku": "NEW-SKU-001" }`

**Expected Output:**
- HTTP: `200`
- Body: Variant object với `sku` updated
- Check SKU unique (bỏ qua chính nó)

---

### TC-VARIANT-05: Xóa variant - Happy Path

**Precondition:** Product có ≥ 2 variants

**Input:** `DELETE /api/admin/products/prod_123/variants/var_123`

**Expected Output:**
- HTTP: `200`
- Message: `Xóa phiên bản thành công`

---

### TC-VARIANT-06: Xóa variant - Last Variant

**Precondition:** Product chỉ có 1 variant

**Input:** `DELETE /api/admin/products/prod_123/variants/var_123`

**Expected Output:**
- HTTP: `409`
- Message: `Không thể xóa phiên bản cuối cùng của sản phẩm`

---

### TC-VARIANT-07: Patch stock - Happy Path

**Input:** `PATCH /api/admin/products/prod_123/variants/var_123/stock` với `{ "stock": 100 }`

**Expected Output:**
- HTTP: `200`
- Body: Variant object với `stock = 100`

---

### TC-VARIANT-08: Patch stock - Invalid Value

**Input:** `PATCH /api/admin/products/prod_123/variants/var_123/stock` với `{ "stock": -5 }`

**Expected Output:**
- HTTP: `400`
- Message: `Tồn kho phải là số nguyên không âm`

---

## TC-INVENTORY: Báo cáo tồn kho

### TC-INVENTORY-01: Báo cáo tồn kho - Happy Path

**Input:** `GET /api/admin/inventory`

**Expected Output:**
- HTTP: `200`
- Body: `{ variants: [], summary: {}, pagination: {} }`
- `summary`包含: `totalVariants`, `totalStock`, `outOfStock`, `lowStock`, `inStock`
- Variants sorted by `stock ASC` (hết hàng lên đầu)

---

### TC-INVENTORY-02: Báo cáo tồn kho - Filter Out of Stock

**Input:** `GET /api/admin/inventory?stockStatus=out_of_stock`

**Expected Output:**
- HTTP: `200`
- Chỉ variants với `stock = 0`

---

### TC-INVENTORY-03: Báo cáo tồn kho - Filter Low Stock

**Input:** `GET /api/admin/inventory?stockStatus=low_stock&lowThreshold=10`

**Expected Output:**
- HTTP: `200`
- Chỉ variants với `0 < stock ≤ 10`

---

### TC-INVENTORY-04: Báo cáo tồn kho - Search Product

**Input:** `GET /api/admin/inventory?search=iphone`

**Expected Output:**
- HTTP: `200`
- Variants của products có name khớp "iphone" (FTS)

---

### TC-INVENTORY-05: Báo cáo tồn kho - Summary Cache

**Precondition:** Gọi lần 1 → summary được cache

**Input:** `GET /api/admin/inventory` (lần 2 trong 60s)

**Expected Output:**
- HTTP: `200`
- Summary từ cache (không tính lại từ DB)

---

## TC-CACHE: Cache Bust

### TC-CACHE-01: Cache Bust - Tạo sản phẩm

**Precondition:** `GET /api/products` đã cache

**Input:** `POST /api/admin/products` (tạo product thành công)

**Expected Output:**
- Redis: `products:list:*` keys bị xóa
- Redis: `products:featured:*` keys bị xóa
- `GET /api/products` lần sau → fresh data

---

### TC-CACHE-02: Cache Bust - Cập nhật tồn kho

**Precondition:** `GET /api/products` và `GET /api/products/:slug` đã cache

**Input:** `PATCH /api/admin/products/:id/variants/:variantId/stock` (update stock)

**Expected Output:**
- Redis: `products:list:*` và `products:slug:{slug}` bị xóa
- Public API thấy fresh stock

---

### TC-CACHE-03: Cache Hit - Public API

**Precondition:** Gọi `GET /api/products` lần 1 → cache

**Input:** `GET /api/products` (lần 2 trong 5 phút)

**Expected Output:**
- HTTP: `200`
- Response từ cache (không query DB)
- Response time nhanh hơn

---

## Checklist Coverage

| Tiêu chí | Trạng thái |
|---|---|
| Happy path tất cả endpoints | ✅ |
| Validation errors (400) | ✅ |
| Not found (404) | ✅ |
| Unauthorized (401) | ✅ |
| Forbidden (403) | ✅ |
| Conflict (409) - SKU trùng | ✅ |
| Ràng buộc nghiệp vụ (xóa variant cuối) | ✅ |
| Cache hit/miss | ✅ |
| Cache bust sau thay đổi | ✅ |
| Cascade delete (product → variants/images) | ✅ |
| Transaction atomic (replace tags) | ✅ |
| DB state verification sau mỗi action | ✅ |
| Cloudinary upload/delete | ✅ (mock test) |

---

## Test Data Setup

**Seed Data:**

```typescript
// Category
const category = await db.category.create({
  data: { name: "Điện thoại", slug: "dien-thoai" }
});

// Brand
const brand = await db.brand.create({
  data: { name: "Apple", slug: "apple" }
});

// Tag
const tag = await db.tag.create({
  data: { name: "Hàng mới", slug: "hang-moi" }
});

// Product
const product = await db.product.create({
  data: {
    name: "iPhone 15 Test",
    slug: "iphone-15-test",
    categoryId: category.id,
    brandId: brand.id,
    isActive: true,
    isFeatured: true,
    variants: {
      create: [
        {
          sku: "IP15-TEST-001",
          color: "Đen",
          storage: "128GB",
          originalPrice: 20000000,
          salePrice: 18000000,
          stock: 10
        }
      ]
    },
    images: {
      create: [
        {
          url: "https://res.cloudinary.com/test/image.jpg",
          publicId: "products/test/cover",
          isCover: true,
          sortOrder: 0
        }
      ]
    },
    productTags: {
      create: [{ tagId: tag.id }]
    }
  }
});
```

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Total Test Cases:** 82  
> **Next Review:** After test implementation
