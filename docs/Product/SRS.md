# SRS — Software Requirement Specification
## Module: Product (Sản phẩm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Phạm vi hệ thống

Module Product cung cấp các chức năng:
- Quản lý sản phẩm (CRUD, toggle trạng thái/nổi bật)
- Quản lý variant (phiên bản) với các thông số màu, bộ nhớ, RAM, giá, tồn kho
- Quản lý ảnh sản phẩm (upload, xóa, đặt ảnh bìa)
- Tìm kiếm, filter, sort sản phẩm cho khách hàng
- Báo cáo tồn kho cho admin
- Cache thông minh để tối ưu hiệu suất

**Ngoài phạm vi:** Bulk import/export sản phẩm, quản lý danh mục/category (module riêng), so sánh sản phẩm.

---

## 2. Yêu cầu chức năng (Functional Requirements)

### FR-01: Danh sách sản phẩm (Public)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-01 |
| **Tên** | Lấy danh sách sản phẩm công khai |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/products` |

**Đầu vào (Query params):**
- `page` (number, optional): trang hiện tại, default 1
- `limit` (number, optional): số item/trang, default 12, max 50
- `category` (string, optional): slug danh mục
- `brand` (string, optional): slug thương hiệu
- `tag` (string, optional): slug tag
- `search` (string, optional): tìm theo tên (Full-text search)
- `minPrice` (number, optional): giá tối thiểu
- `maxPrice` (number, optional): giá tối đa
- `sort` (string, optional): `newest` (default) / `oldest` / `name_asc` / `name_desc`

**Xử lý:**
1. Check Redis cache — nếu hit thì trả về cache
2. Build `where` clause theo filter
3. Query DB với pagination, sort
4. Chỉ lấy sản phẩm `isActive = true`
5. Chỉ lấy variants `isActive = true`
6. Include ảnh bìa (`isCover = true`)
7. Cache result (5 phút TTL)

**Đầu ra thành công:** `200` + `{ products, pagination }`

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| limit > 50 | 400 | `Số item/trang tối đa là 50` |
| minPrice/maxPrice không hợp lệ | 400 | `Giá không hợp lệ` |

---

### FR-02: Chi tiết sản phẩm (Public)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-02 |
| **Tên** | Lấy chi tiết sản phẩm theo slug |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/products/:slug` |

**Đầu vào:**
- `slug` (string, required): URL-friendly identifier

**Xử lý:**
1. Check Redis cache
2. Find product by slug — `404` nếu không tồn tại hoặc `isActive = false`
3. Include category, brand, tags, tất cả variants active, tất cả ảnh
4. Sort variants by `salePrice ASC`
5. Sort images by `sortOrder ASC`
6. Cache result (5 phút TTL)

**Đầu ra thành công:** `200` + product object (full detail)

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Slug không tồn tại hoặc inactive | 404 | `Sản phẩm không tồn tại` |

---

### FR-03: Sản phẩm nổi bật (Public)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-03 |
| **Tên** | Lấy danh sách sản phẩm nổi bật |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `GET /api/products/featured` |

**Đầu vào (Query params):**
- `limit` (number, optional): số lượng, default 8, max 20

**Xử lý:**
1. Check Redis cache (10 phút TTL)
2. Query: `isActive = true AND isFeatured = true`
3. Sort by `createdAt DESC`
4. Take `limit` products
5. Include ảnh bìa và variants active

**Đầu ra thành công:** `200` + array products

---

### FR-04: Danh sách sản phẩm (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-04 |
| **Tên** | Admin xem danh sách tất cả sản phẩm |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/admin/products` |
| **Auth** | STAFF+ |

**Đầu vào (Query params):**
- Tất cả params của FR-01
- `isActive` (string, optional): `'true'` / `'false'`
- `isFeatured` (string, optional): `'true'` / `'false'`

**Xử lý:**
1. Không dùng cache — luôn đọc DB
2. Trả về tất cả sản phẩm (kể cả `isActive = false`)
3. Trả về tất cả variants (kể cả `isActive = false`)
4. Filter bổ sung theo `isActive`, `isFeatured`

**Đầu ra thành công:** `200` + `{ products, pagination }`

---

### FR-05: Chi tiết sản phẩm (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-05 |
| **Tên** | Admin xem chi tiết sản phẩm theo ID |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/admin/products/:id` |
| **Auth** | STAFF+ |

**Xử lý:**
1. Find by ID — `404` nếu không tồn tại
2. Trả về full detail kể cả inactive

**Đầu ra thành công:** `200` + product object (full detail)

---

### FR-06: Tạo sản phẩm (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-06 |
| **Tên** | Tạo sản phẩm mới với ảnh và variants |
| **Ưu tiên** | Cao |
| **Endpoint** | `POST /api/admin/products` |
| **Auth** | STAFF+ |

**Đầu vào (FormData multipart):**
- `name` (string, required): ≥ 2 ký tự
- `categoryId` (string, required): ID danh mục tồn tại
- `brandId` (string, required): ID thương hiệu tồn tại
- `description` (string, optional)
- `tagIds` (string, optional): JSON string array of tag IDs
- `isActive` (boolean, optional): default true
- `isFeatured` (boolean, optional): default false
- `variants` (string, required): JSON string array of variant objects
  - Mỗi variant: `sku` (required), `color`, `storage`, `ram`, `originalPrice` (required, ≥ 0), `salePrice` (required, ≥ 0, ≤ originalPrice), `stock` (optional, ≥ 0, default 0), `imageUrl`
- `images` (file[], optional): tối đa 10 ảnh, JPG/JPEG/PNG/WebP, max 5MB/ảnh

**Xử lý:**
1. Parse `variants` và `tagIds` từ JSON string
2. Validate đầu vào
3. Check song song: category tồn tại, brand tồn tại, tags tồn tại, SKUs unique
4. Sinh slug duy nhất
5. Upload tất cả ảnh song song lên Cloudinary
6. Tạo Product + Variants + Tags + Images trong 1 transaction
   - Ảnh đầu tiên (`i === 0`) → `isCover = true`
   - `sortOrder` = index trong mảng
7. Bust toàn bộ cache list và featured

**Đầu ra thành công:** `201` + product object (full detail)

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| name < 2 ký tự | 400 | `Tên sản phẩm phải có ít nhất 2 ký tự` |
| Thiếu categoryId | 400 | `Vui lòng chọn danh mục` |
| Thiếu brandId | 400 | `Vui lòng chọn thương hiệu` |
| variants rỗng hoặc thiếu | 400 | `Sản phẩm phải có ít nhất một phiên bản` |
| SKU rỗng | 400 | `SKU không được để trống` |
| originalPrice < 0 hoặc sai kiểu | 400 | `Giá gốc không hợp lệ` |
| salePrice > originalPrice | 400 | `Giá bán không được lớn hơn giá gốc` |
| Category/Brand/Tag không tồn tại | 400 | `Danh mục/Thương hiệu/Tag không tồn tại` |
| SKU trùng trong payload | 409 | `SKU bị trùng trong danh sách phiên bản` |
| SKU đã tồn tại trong DB | 409 | `SKU đã tồn tại: {sku1}, {sku2}` |

---

### FR-07: Cập nhật sản phẩm (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-07 |
| **Tên** | Cập nhật thông tin sản phẩm |
| **Ưu tiên** | Cao |
| **Endpoint** | `PUT /api/admin/products/:id` |
| **Auth** | STAFF+ |

**Đầu vào:** Giống FR-06, nhưng tất cả optional (partial update)

**Xử lý:**
1. Find product — `404` nếu không tồn tại
2. Validate các FK (category, brand, tags)
3. Partial update: chỉ update trường được gửi
4. Nếu có file ảnh mới → upload song song → thêm vào sau ảnh hiện có
5. Nếu có `tagIds` → transaction: xóa hết tag cũ → tạo lại tag mới
6. Bust cache list + cache slug
7. Không update variants tại endpoint này (dùng `/variants` riêng)

**Đầu ra thành công:** `200` + product object (full detail)

---

### FR-08: Xóa sản phẩm (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-08 |
| **Tên** | Xóa sản phẩm |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `DELETE /api/admin/products/:id` |
| **Auth** | STAFF+ |

**Xử lý:**
1. Song song: lấy tất cả ảnh (để lấy `publicId`) + lấy slug (để bust cache)
2. Xóa product khỏi DB (cascade xóa variants, productTags, images)
3. Xóa tất cả ảnh trên Cloudinary ở nền (fire-and-forget)
4. Bust cache

**Đầu ra thành công:** `200` + `{ message: 'Xóa sản phẩm thành công' }`

---

### FR-09: Toggle trạng thái sản phẩm (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-09 |
| **Tên** | Bật/tắt hiển thị sản phẩm |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `PATCH /api/admin/products/:id/status` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `isActive` (boolean, required)

**Xử lý:**
1. Find product — `404` nếu không tồn tại
2. Update `isActive`
3. Bust cache

**Đầu ra thành công:** `200` + product object

---

### FR-10: Toggle sản phẩm nổi bật (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-10 |
| **Tên** | Bật/tắt nổi bật sản phẩm |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `PATCH /api/admin/products/:id/featured` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `isFeatured` (boolean, required)

**Xử lý:** Giống FR-09

**Đầu ra thành công:** `200` + product object

---

### FR-11: Thêm ảnh sản phẩm (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-11 |
| **Tên** | Upload thêm ảnh vào sản phẩm |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `POST /api/admin/products/:id/images` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `images` (file[], required): tối đa 10 ảnh

**Xử lý:**
1. Find product — `404` nếu không tồn tại
2. Upload song song tất cả ảnh lên Cloudinary
3. `sortOrder` = `existingCount + i`
4. `isCover = true` chỉ khi product chưa có ảnh nào và đây là ảnh đầu tiên
5. Bust cache

**Đầu ra thành công:** `201` + images array

---

### FR-12: Xóa ảnh sản phẩm (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-12 |
| **Tên** | Xóa ảnh khỏi sản phẩm |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `DELETE /api/admin/products/:id/images/:imageId` |
| **Auth** | STAFF+ |

**Xử lý:**
1. Kiểm tra ảnh thuộc product — `404` nếu không
2. Xóa DB → xóa Cloudinary ở nền
3. Nếu ảnh bị xóa là `isCover` → set ảnh kế tiếp làm bìa mới
4. Bust cache

**Đầu ra thành công:** `200` + `{ message: 'Xóa ảnh thành công' }`

---

### FR-13: Đặt ảnh bìa (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-13 |
| **Tên** | Đặt ảnh làm ảnh bìa |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `PATCH /api/admin/products/:id/images/:imageId/cover` |
| **Auth** | STAFF+ |

**Xử lý:**
1. Kiểm tra ảnh thuộc product — `404` nếu không
2. Atomic transaction: bỏ `isCover` tất cả → set `isCover = true` cho ảnh được chọn
3. Bust cache

**Đầu ra thành công:** `200` + images array

---

### FR-14: Thêm variant (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-14 |
| **Tên** | Thêm variant mới vào sản phẩm |
| **Ưu tiên** | Cao |
| **Endpoint** | `POST /api/admin/products/:id/variants` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `sku` (string, required): unique toàn hệ thống
- `color` (string, optional)
- `storage` (string, optional)
- `ram` (string, optional)
- `originalPrice` (number, required): ≥ 0
- `salePrice` (number, required): ≥ 0, ≤ originalPrice
- `stock` (number, optional): ≥ 0, default 0
- `imageUrl` (string, optional)

**Xử lý:**
1. Find product — `404` nếu không tồn tại
2. Check SKU unique
3. Tạo variant với `isActive = true`, `stock = 0` (nếu không gửi)
4. Bust cache

**Đầu ra thành công:** `201` + variant object

---

### FR-15: Cập nhật variant (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-15 |
| **Tên** | Cập nhật thông tin variant |
| **Ưu tiên** | Cao |
| **Endpoint** | `PUT /api/admin/products/:id/variants/:variantId` |
| **Auth** | STAFF+ |

**Đầu vào:** Giống FR-14, tất cả optional (partial update)

**Xử lý:**
1. Kiểm tra variant tồn tại và thuộc product — `404` nếu không
2. Partial update từng trường được gửi
3. Nếu sửa `sku` → check unique (bỏ qua chính nó)
4. Nếu thay đổi `salePrice`, `stock`, hoặc `isActive` → bust cache

**Đầu ra thành công:** `200` + variant object

---

### FR-16: Xóa variant (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-16 |
| **Tên** | Xóa variant khỏi sản phẩm |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `DELETE /api/admin/products/:id/variants/:variantId` |
| **Auth** | STAFF+ |

**Xử lý:**
1. Kiểm tra variant thuộc product — `404` nếu không
2. Đếm tổng số variant của product
3. Nếu chỉ còn 1 variant → `409` (không được xóa)
4. Xóa variant
5. Bust cache

**Đầu ra thành công:** `200` + `{ message: 'Xóa phiên bản thành công' }`

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Chỉ còn 1 variant | 409 | `Không thể xóa phiên bản cuối cùng của sản phẩm` |

---

### FR-17: Cập nhật tồn kho nhanh (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-17 |
| **Tên** | Patch stock nhanh |
| **Ưu tiên** | Cao |
| **Endpoint** | `PATCH /api/admin/products/:id/variants/:variantId/stock` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `stock` (number, required): ≥ 0

**Xử lý:**
1. Validate: `stock` là số nguyên ≥ 0
2. Gọi `updateVariant` với chỉ trường `stock`
3. Bust cache

**Đầu ra thành công:** `200` + variant object

---

### FR-18: Báo cáo tồn kho (Admin)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-18 |
| **Tên** | Báo cáo tồn kho tổng quan và chi tiết |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/admin/inventory` |
| **Auth** | STAFF+ |

**Đầu vào (Query params):**
- `page` (number, optional): default 1
- `limit` (number, optional): default 20, max 100
- `search` (string, optional): tìm theo tên sản phẩm (FTS)
- `stockStatus` (string, optional): `all` / `in_stock` / `low_stock` / `out_of_stock`
- `lowThreshold` (number, optional): ngưỡng "sắp hết", default 5
- `brandSlug` (string, optional): lọc theo thương hiệu

**Xử lý:**
1. Get summary (in-memory cache, 60s TTL):
   - `totalVariants`: tổng số phiên bản
   - `totalStock`: tổng tồn kho toàn hệ thống
   - `outOfStock`: số phiên bản hết hàng (`stock = 0`)
   - `lowStock`: số phiên bản sắp hết (`0 < stock ≤ lowThreshold`)
   - `inStock`: số phiên bản còn hàng (`stock > lowThreshold`)
2. Query variants theo filter:
   - Sort by `stock ASC` (hết hàng lên đầu)
   - Include product, category, brand, ảnh bìa
3. Return `{ variants, summary, pagination }`

**Đầu ra thành công:** `200` + `{ variants, summary, pagination }`

---

## 3. Yêu cầu phi chức năng (Non-Functional Requirements)

### NFR-01: Hiệu năng

| Chỉ tiêu | Giá trị |
|---|---|
| Thời gian response danh sách (public) | < 1 giây (p95, có cache) |
| Thời gian response danh sách (admin) | < 2 giây (p95, không cache) |
| Thời gian response chi tiết sản phẩm | < 500ms (p95, có cache) |
| Upload ảnh (tối đa 10 ảnh) | < 10 giây (p95) |
| Full-text search latency | < 300ms (p95) |
| Cache hit rate target | > 70% |

---

### NFR-02: Bảo mật

| Yêu cầu | Mô tả |
|---|---|
| Admin endpoints | Yêu cầu JWT token + role STAFF+ |
| Public endpoints | Không cần xác thực |
| Upload validation | Validate định dạng, kích thước ảnh trước khi upload |
| SQL Injection prevention | Prisma ORM escape input |
| XSS prevention | Không render raw HTML từ user input |

---

### NFR-03: Độ tin cậy

| Yêu cầu | Giá trị |
|---|---|
| Uptime | ≥ 99.5% |
| Cache failure fallback | Degrade gracefully — fallback to DB |
| Cloudinary failure | Trả lỗi rõ ràng; không crash hệ thống |
| Atomic operations | Tạo/sửa product dùng Prisma transaction |

---

### NFR-04: Khả năng bảo trì

| Yêu cầu | Mô tả |
|---|---|
| Cache TTL | Cấu hình qua env vars hoặc constants |
| Image limit | Tối đa 10 ảnh/sản phẩm (có thể config) |
| Low stock threshold | Default 5, có thể qua query param |
| Cleanup job | Định kỳ xóa ảnh orphan trên Cloudinary |

---

### NFR-05: Scalability

| Yêu cầu | Giá trị |
|---|---|
| Sản phẩm tối đa | 10,000+ products |
| Variant tối đa | 5 variants/product → 50,000+ variants |
| Ảnh tối đa | 10 images/product → 100,000+ images |
| Concurrent users | 100+ concurrent users trên public API |
| Full-text search | PostgreSQL GIN index support |

---

## 4. Yêu cầu dữ liệu

### 4.1 Bảng Product

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `id` | string | PK, auto-generated |
| `name` | string | not null, ≥ 2 ký tự |
| `slug` | string | unique, auto-generated từ name |
| `description` | string? | nullable |
| `categoryId` | string | FK → Category, not null |
| `brandId` | string | FK → Brand, not null |
| `isActive` | boolean | default true |
| `isFeatured` | boolean | default false |
| `createdAt` | DateTime | auto |
| `updatedAt` | DateTime | auto |

**Indexes:**
- `categoryId` (cho filter)
- `brandId` (cho filter)
- `(isActive, isFeatured)` (cho featured products)
- `createdAt` (cho sort)
- `slug` (unique)

---

### 4.2 Bảng ProductVariant

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `id` | string | PK, auto-generated |
| `productId` | string | FK → Product, not null |
| `sku` | string | unique, not null |
| `color` | string? | nullable |
| `storage` | string? | nullable |
| `ram` | string? | nullable |
| `imageUrl` | string? | nullable |
| `originalPrice` | Decimal | not null, ≥ 0 |
| `salePrice` | Decimal | not null, ≥ 0, ≤ originalPrice |
| `stock` | int | ≥ 0, default 0 |
| `isActive` | boolean | default true |
| `createdAt` | DateTime | auto |
| `updatedAt` | DateTime | auto |

**Indexes:**
- `productId` (cho join)
- `stock` (cho inventory)
- `isActive` (cho filter)
- `(isActive, salePrice)` (cho filter + sort)

---

### 4.3 Bảng ProductImage

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `id` | string | PK, auto-generated |
| `productId` | string | FK → Product, not null |
| `url` | string | Cloudinary URL, not null |
| `publicId` | string | Cloudinary public ID, not null |
| `isCover` | boolean | default false |
| `sortOrder` | int | default 0 |
| `createdAt` | DateTime | auto |

**Indexes:**
- `(productId, isCover)` (cho lấy ảnh bìa)

---

### 4.4 Bảng ProductTag (Many-to-Many)

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `productId` | string | FK → Product, PK part |
| `tagId` | string | FK → Tag, PK part |

**Primary Key:** `(productId, tagId)`

---

## 5. Môi trường & Cấu hình

| Biến môi trường | Mô tả | Ràng buộc |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Bắt buộc cho upload |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Bắt buộc |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Bắt buộc |
| `CLOUDINARY_FOLDER` | Folder lưu ảnh | Default `products` |
| `REDIS_URL` | Redis connection string | Bắt buộc cho cache |
| `CACHE_TTL_LIST` | TTL cache danh sách (giây) | Default 300 (5 phút) |
| `CACHE_TTL_FEATURED` | TTL cache featured (giây) | Default 600 (10 phút) |
| `INVENTORY_CACHE_TTL` | TTL cache summary (giây) | Default 60 (1 phút) |

---

## 6. Phụ thuộc

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| `@prisma/client` | latest | ORM tương tác DB |
| `cloudinary` | latest | Upload ảnh |
| `ioredis` | latest | Redis cache |
| `multer` | latest | Parse multipart form-data |
| `slugify` | latest | Sinh slug từ name |
| `@prisma/client` | latest | Full-text search (PostgreSQL GIN) |

---

## 7. Caching Strategy

### 7.1 Redis Cache Keys

| Pattern | TTL | Khi nào bust |
|---|---|---|
| `products:list:{hash(query)}` | 5 phút | Tạo/sửa/xóa product, sửa variant |
| `products:slug:{slug}` | 5 phút | Cập nhật/xóa product có slug đó |
| `products:featured:{limit}` | 10 phút | Tạo/sửa/xóa product |

### 7.2 In-Memory Cache

| Cache | TTL | Mục đích |
|---|---|---|
| Inventory summary | 60 giây | Giảm load DB cho report |

---

## 8. Error Handling

### 8.1 HTTP Status Codes

| Code | Khi nào dùng |
|---|---|
| `200` | Thành công (GET, PATCH) |
| `201` | Tạo thành công (POST) |
| `400` | Validation error |
| `401` | Không xác thực (admin endpoints) |
| `403` | Không đủ quyền |
| `404` | Không tìm thấy (product/variant/image) |
| `409` | Conflict (SKU trùng, xóa variant cuối) |
| `413` | File quá lớn (ảnh > 5MB) |
| `415` | Định dạng file không hỗ trợ |
| `429` | Rate limit (nếu có) |
| `500` | Server error |

### 8.2 Error Response Format

```json
{
  "message": "Tên sản phẩm phải có ít nhất 2 ký tự",
  "errors": [
    { "field": "name", "message": "Tên sản phẩm phải có ít nhất 2 ký tự" }
  ]
}
```

---

## 9. Testing Requirements

### 9.1 Unit Tests

- Validators: product, variant, image
- Slug generation
- Cache key generation
- Inventory summary calculation

### 9.2 Integration Tests

- CRUD Product với DB
- Upload ảnh Cloudinary
- Redis cache hit/miss
- Cascade delete (product → variants/images)

### 9.3 E2E Tests

- Tạo product → upload ảnh → thêm variant → kiểm tra public API
- Xóa variant cuối → expect 409
- Cache bust → verify stale data không trả về

---

## 10. Migration & Rollback

### 10.1 Database Migration

- Tạo indexes cho GIN full-text search
- Migrate data từ hệ thống cũ (nếu có)
- Validate SKU uniqueness before insert

### 10.2 Rollback Plan

- Revert code deployment
- Restore DB backup (nếu schema change)
- Flush Redis cache (full flush)

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Next Review:** After implementation complete
