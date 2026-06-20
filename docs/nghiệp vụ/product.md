# Nghiệp vụ Product (Sản phẩm) — Mobivexa

> **Phạm vi:** `src/services/product.service.ts`, `src/controllers/product.controller.ts`, `src/routes/product.route.ts`, `src/validators/product.validator.ts`, `src/types/product.type.ts`
>
> **Cập nhật:** 2026-06-19

---

## 1. Tổng quan

Module Product là **core nghiệp vụ** của hệ thống, gồm 4 nhóm chức năng:

| Nhóm | Mô tả |
|---|---|
| **Sản phẩm** | CRUD, toggle trạng thái / nổi bật |
| **Ảnh sản phẩm** | Upload nhiều ảnh, xóa ảnh, đặt ảnh bìa |
| **Phiên bản (Variant)** | Thêm / sửa / xóa variant (màu, bộ nhớ, RAM, giá, tồn kho) |
| **Tồn kho (Inventory)** | Báo cáo tổng quan + danh sách theo trạng thái stock |

Mỗi sản phẩm **bắt buộc phải có ít nhất 1 variant**. Variant là đơn vị lưu giá và tồn kho.

---

## 2. Danh sách endpoint

### Public (`/api/products`)

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/api/products` | Danh sách sản phẩm (có phân trang, filter, search) | ❌ |
| `GET` | `/api/products/featured` | Sản phẩm nổi bật | ❌ |
| `GET` | `/api/products/:slug` | Chi tiết sản phẩm | ❌ |

### Admin (`/api/admin/products`) — Yêu cầu STAFF+

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/admin/products` | Danh sách (gồm cả sản phẩm ẩn, filter admin) |
| `GET` | `/api/admin/products/:id` | Chi tiết theo ID (thấy cả sản phẩm ẩn) |
| `POST` | `/api/admin/products` | Tạo sản phẩm (kèm ảnh + variants) |
| `PUT` | `/api/admin/products/:id` | Cập nhật sản phẩm |
| `DELETE` | `/api/admin/products/:id` | Xóa sản phẩm |
| `PATCH` | `/api/admin/products/:id/status` | Bật / tắt hiển thị |
| `PATCH` | `/api/admin/products/:id/featured` | Bật / tắt nổi bật |
| `POST` | `/api/admin/products/:id/images` | Thêm ảnh |
| `DELETE` | `/api/admin/products/:id/images/:imageId` | Xóa ảnh |
| `PATCH` | `/api/admin/products/:id/images/:imageId/cover` | Đặt ảnh bìa |
| `POST` | `/api/admin/products/:id/variants` | Thêm variant |
| `PUT` | `/api/admin/products/:id/variants/:variantId` | Cập nhật variant |
| `DELETE` | `/api/admin/products/:id/variants/:variantId` | Xóa variant |
| `PATCH` | `/api/admin/products/:id/variants/:variantId/stock` | Cập nhật tồn kho |
| `GET` | `/api/admin/inventory` | Báo cáo tồn kho |

---

## 3. Chính sách & Ràng buộc nghiệp vụ

### 3.1 Sản phẩm (Product)

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| `name` | ✅ | Tối thiểu 2 ký tự (sau trim) |
| `categoryId` | ✅ | Phải tồn tại trong DB |
| `brandId` | ✅ | Phải tồn tại trong DB |
| `variants` | ✅ | Mảng ≥ 1 phần tử; bắt buộc khi tạo mới |
| `slug` | ❌ | Tự sinh từ `name` nếu không gửi; unique |
| `description` | ❌ | Mô tả |
| `isActive` | ❌ | Mặc định `true` khi tạo |
| `isFeatured` | ❌ | Mặc định `false` khi tạo |
| `tagIds` | ❌ | Mảng ID tag; tất cả phải tồn tại; gửi qua form-data dạng JSON string |
| `images` | ❌ | File ảnh (multipart); tối đa **10 ảnh** mỗi lần upload |

### 3.2 Variant (Phiên bản sản phẩm)

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| `sku` | ✅ | Không rỗng; **unique toàn hệ thống** (không trùng kể cả giữa các product) |
| `originalPrice` | ✅ | Số không âm (≥ 0) |
| `salePrice` | ✅ | Số không âm; **phải ≤ `originalPrice`** |
| `color` | ❌ | Màu sắc |
| `storage` | ❌ | Dung lượng lưu trữ |
| `ram` | ❌ | RAM |
| `imageUrl` | ❌ | URL ảnh đại diện cho variant |
| `stock` | ❌ | Số nguyên ≥ 0; mặc định `0` khi tạo |
| `isActive` | ❌ | Mặc định `true` khi tạo |

**Ràng buộc SKU:**
- SKU không được trùng trong **cùng payload** (khi tạo nhiều variant lúc tạo sản phẩm)
- SKU không được trùng với bất kỳ variant nào đã có trong DB
- Khi cập nhật: SKU của chính variant đang sửa không bị coi là trùng

**Ràng buộc xóa variant:**
- Mỗi sản phẩm **phải có ít nhất 1 variant** — không thể xóa variant cuối cùng

### 3.3 Ảnh sản phẩm (ProductImage)

| Quy tắc | Giá trị |
|---|---|
| Định dạng | JPG, JPEG, PNG, WebP |
| Kích thước tối đa | 5 MB / ảnh |
| Tối đa mỗi lần upload | 10 ảnh |
| Lưu trữ | Cloudinary, folder `products` |
| `isCover` (ảnh bìa) | Chỉ 1 ảnh bìa; ảnh đầu tiên khi tạo sản phẩm tự thành bìa |
| Xóa ảnh bìa | Hệ thống tự promote ảnh kế tiếp (theo `sortOrder ASC`) làm bìa mới |
| Đặt ảnh bìa | Atomic transaction: bỏ cover tất cả → set cover mới |
| `sortOrder` | Tự tăng theo thứ tự upload; ảnh mới thêm vào sau ảnh cũ |

### 3.4 Cập nhật Tag khi update sản phẩm

- Khi gửi `tagIds` trong update → **replace toàn bộ** (xóa hết tag cũ, tạo lại tag mới) trong **1 transaction**
- Không gửi `tagIds` → giữ nguyên tag hiện tại

### 3.5 Cache (Redis)

| Cache key | TTL | Bust khi nào |
|---|---|---|
| `products:list:*` | 5 phút | Tạo / sửa / xóa sản phẩm, sửa variant (giá/stock/isActive) |
| `products:slug:{slug}` | 5 phút | Cập nhật hoặc xóa sản phẩm có slug đó |
| `products:featured:*` | 10 phút | Tạo / sửa / xóa sản phẩm |

- Cache **chỉ áp dụng cho public** — admin luôn đọc data tươi từ DB
- Cache failure không ảnh hưởng response (silent catch)
- `cacheBust` dùng Redis SCAN (an toàn với production, không dùng KEYS)

### 3.6 Inventory Cache (In-memory)

- `getInventorySummary` dùng **in-memory cache** (không phải Redis), TTL = **60 giây**
- Summary gồm: tổng variants, tổng stock, số hết hàng, số sắp hết

---

## 4. Luồng nghiệp vụ chi tiết

### 4.1 Danh sách sản phẩm (Public)

```
GET /api/products?[params] → listProducts(query, {admin:false})
  → Check Redis cache
  → (cache miss) Build where + query DB + cache result
  → Response
```

**Tham số filter (Public):**

| Param | Mô tả |
|---|---|
| `page` | Trang hiện tại (default: 1) |
| `limit` | Số item/trang (default: 12, max: 50) |
| `category` | Slug danh mục |
| `brand` | Slug thương hiệu |
| `tag` | Slug tag |
| `search` | Tìm theo tên (Full-text search, GIN index) |
| `minPrice` | Giá tối thiểu (lọc theo `salePrice` của variant) |
| `maxPrice` | Giá tối đa |
| `sort` | `newest` (default) / `oldest` / `name_asc` / `name_desc` |

**Hành vi:**
- Chỉ trả về sản phẩm `isActive = true`
- Chỉ trả về variants `isActive = true` của mỗi sản phẩm
- Mỗi sản phẩm kèm ảnh bìa (`isCover = true`, lấy 1 ảnh)
- Filter giá: sản phẩm có **ít nhất 1 variant** có giá trong khoảng
- Search: dùng PostgreSQL Full-text Search (`to_tsvector` + GIN index), hỗ trợ tiếng Việt cơ bản

---

### 4.2 Danh sách sản phẩm (Admin)

Cùng hàm `listProducts` nhưng `admin=true`:

| Hành vi | Public | Admin |
|---|---|---|
| Lọc `isActive` | Chỉ active | Tất cả (có thể filter thêm) |
| Cache | ✅ Redis 5 phút | ❌ Luôn đọc DB |
| Filter thêm | `tag`, `minPrice`, `maxPrice` | `isActive`, `isFeatured` |
| Variant trả về | Chỉ active | Tất cả (kể cả ẩn) |
| `limit` max | 50 | 50 |

**Tham số filter bổ sung (Admin only):**

| Param | Mô tả |
|---|---|
| `isActive` | `'true'` / `'false'` |
| `isFeatured` | `'true'` / `'false'` |

---

### 4.3 Chi tiết sản phẩm (Public — theo slug)

```
GET /api/products/:slug → getProductBySlug
  → Check Redis cache
  → (miss) DB query + cache
  → Response (kèm category, brand, variants active, tags, images)
```

- Trả `404` nếu slug không tồn tại **hoặc** `isActive = false`
- Response đầy đủ: category, brand, tất cả variants active (sắp theo `salePrice ASC`), tags, tất cả ảnh (sắp theo `sortOrder ASC`)

---

### 4.4 Sản phẩm nổi bật (Public)

```
GET /api/products/featured → getFeaturedProducts(limit=8)
  → Check Redis cache (TTL 10 phút)
  → (miss) DB: isActive=true AND isFeatured=true, orderBy createdAt DESC, take 8
  → Response
```

---

### 4.5 Tạo sản phẩm (Admin)

```
POST /api/admin/products
  → [authenticate] → [authorize STAFF+]
  → [uploadImage.array('images', 10)] → [validate]
  → createProduct → DB + Cloudinary → bustCache → Response 201
```

**Happy Path:**
1. Parse `variants` và `tagIds` từ JSON string (form-data)
2. Validate: `name` ≥ 2 ký tự; `categoryId` + `brandId` bắt buộc; `variants` ≥ 1 phần tử
3. Validate từng variant: `sku` không rỗng; `originalPrice ≥ 0`; `salePrice ≥ 0`; `salePrice ≤ originalPrice`
4. Song song kiểm tra: category tồn tại + brand tồn tại + tags tồn tại + SKUs unique
5. Sinh slug duy nhất
6. Upload tất cả ảnh lên Cloudinary song song
7. Tạo Product + Variants + Tags + Images trong 1 lần (nested create)
   - Ảnh đầu tiên (`i === 0`) tự thành `isCover = true`
   - `sortOrder` = index trong mảng
   - `isFeatured` mặc định `false`; `isActive` mặc định `true`
8. Bust toàn bộ cache list và featured
9. Trả về `201` + product đầy đủ (kèm category, brand, variants, tags, images)

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `name` < 2 ký tự | 400 | `Tên sản phẩm phải có ít nhất 2 ký tự` |
| Thiếu `categoryId` | 400 | `Vui lòng chọn danh mục` |
| Thiếu `brandId` | 400 | `Vui lòng chọn thương hiệu` |
| `variants` rỗng hoặc thiếu | 400 | `Sản phẩm phải có ít nhất một phiên bản` |
| `sku` rỗng | 400 | `SKU không được để trống` |
| `originalPrice` < 0 hoặc sai kiểu | 400 | `Giá gốc không hợp lệ` |
| `salePrice` > `originalPrice` | 400 | `Giá bán không được lớn hơn giá gốc` |
| Category không tồn tại | 400 | `Danh mục không tồn tại` |
| Brand không tồn tại | 400 | `Thương hiệu không tồn tại` |
| Có tag không tồn tại | 400 | `Có tag không tồn tại` |
| SKU trùng trong payload | 409 | `SKU bị trùng trong danh sách phiên bản` |
| SKU đã tồn tại trong DB | 409 | `SKU đã tồn tại: {sku1}, {sku2}` |

---

### 4.6 Cập nhật sản phẩm (Admin)

```
PUT /api/admin/products/:id
  → [authenticate] → [authorize STAFF+]
  → [uploadImage.array('images', 10)] → [validate]
  → updateProduct → DB + Cloudinary → bustCache → Response
```

**Happy Path:**
1. Tìm product — `404` nếu không tồn tại
2. Kiểm tra song song các FK thay đổi (category, brand, tags)
3. Partial update: chỉ cập nhật trường được gửi
4. Nếu có file ảnh mới → upload song song → thêm vào sau ảnh hiện có (không thay thế)
5. Nếu có `tagIds` → transaction: xóa hết tag cũ → tạo lại tag mới
6. Bust cache list + cache slug sản phẩm
7. Trả về `200` + product đầy đủ

> **Lưu ý:** Cập nhật variants **không** thực hiện tại endpoint này — có endpoint `/variants` riêng.

---

### 4.7 Xóa sản phẩm (Admin)

```
DELETE /api/admin/products/:id → deleteProduct → DB → Cloudinary → bustCache
```

1. Song song: lấy tất cả ảnh (để lấy `publicId`) + lấy slug (để bust cache)
2. Xóa product khỏi DB (cascade xóa variants, productTags, images trong DB)
3. Xóa tất cả ảnh trên Cloudinary ở nền (không chặn response)
4. Bust cache

> Không có ràng buộc chặn xóa sản phẩm (khác với Category/Brand). Sản phẩm đang trong đơn hàng vẫn xóa được — cần xử lý ở tầng nghiệp vụ đơn hàng.

---

### 4.8 Quản lý ảnh sản phẩm (Admin)

#### Thêm ảnh
```
POST /api/admin/products/:id/images
  → [authenticate] → [authorize STAFF+]
  → [uploadImage.array('images', 10)]
  → addProductImages → Cloudinary + DB → bustCache → Response 201
```
- Tìm product — `404` nếu không tồn tại
- Upload song song tất cả ảnh lên Cloudinary
- `sortOrder` = `existingCount + i` (nối tiếp ảnh cũ)
- `isCover = true` chỉ khi product **chưa có ảnh nào** và đây là ảnh đầu tiên được upload
- Trả về `201` + số lượng ảnh đã thêm

#### Xóa ảnh
```
DELETE /api/admin/products/:id/images/:imageId → deleteProductImage
```
- Kiểm tra ảnh thuộc product (`image.productId === productId`) — `404` nếu không
- Xóa DB → xóa Cloudinary ở nền
- Nếu ảnh bị xóa là `isCover` → tự động set ảnh kế tiếp (`sortOrder ASC`) làm bìa mới

#### Đặt ảnh bìa
```
PATCH /api/admin/products/:id/images/:imageId/cover → setProductImageCover
```
- Kiểm tra ảnh thuộc product — `404` nếu không
- Atomic transaction: bỏ `isCover` tất cả ảnh → set `isCover = true` cho ảnh được chọn
- Trả về danh sách ảnh mới của product

---

### 4.9 Quản lý Variant (Admin)

#### Thêm variant
```
POST /api/admin/products/:id/variants → [validate] → addVariant
```
- Tìm product — `404` nếu không tồn tại
- Kiểm tra SKU unique
- Tạo variant; `stock` mặc định `0`, `isActive` mặc định `true`
- Trả về `201` + variant mới

#### Cập nhật variant
```
PUT /api/admin/products/:id/variants/:variantId → updateVariant
```
- Kiểm tra variant tồn tại và thuộc product — `404` nếu không
- Partial update từng trường được gửi
- Nếu sửa `sku` → kiểm tra unique (bỏ qua chính nó)
- Nếu thay đổi `salePrice`, `stock`, hoặc `isActive` → bust cache (vì ảnh hưởng listing/detail)

#### Xóa variant
```
DELETE /api/admin/products/:id/variants/:variantId → deleteVariant
```
- Kiểm tra variant thuộc product — `404` nếu không
- Đếm tổng số variant của product
- Nếu chỉ còn **1 variant** → `409` (không được xóa)
- Xóa variant

#### Cập nhật tồn kho nhanh
```
PATCH /api/admin/products/:id/variants/:variantId/stock → patchStock
```
- Validate: `stock` là số nguyên ≥ 0
- Gọi `updateVariant` với chỉ trường `stock`
- Cache bị bust vì stock thay đổi

---

### 4.10 Báo cáo tồn kho (Admin)

```
GET /api/admin/inventory?[params] → getInventory
```

**Tham số:**

| Param | Mô tả | Default |
|---|---|---|
| `page` | Trang | 1 |
| `limit` | Số item/trang (max: 100) | 20 |
| `search` | Tìm theo tên sản phẩm (FTS) | — |
| `stockStatus` | `all` / `in_stock` / `low_stock` / `out_of_stock` | `all` |
| `lowThreshold` | Ngưỡng "sắp hết" (số nguyên ≥ 1) | 5 |
| `brandSlug` | Lọc theo thương hiệu | — |

**Response gồm:**
- `variants[]`: danh sách variant sắp theo `stock ASC` (hết hàng lên đầu), kèm thông tin sản phẩm, category, brand, ảnh bìa
- `summary`: tổng quan tồn kho (in-memory cache 60s):
  - `totalVariants`: tổng số phiên bản
  - `totalStock`: tổng tồn kho toàn hệ thống
  - `outOfStock`: số phiên bản hết hàng (`stock = 0`)
  - `lowStock`: số phiên bản sắp hết (`0 < stock ≤ lowThreshold`)
  - `inStock`: số phiên bản còn hàng (`stock > lowThreshold`)
- `pagination`: meta phân trang

**Định nghĩa trạng thái tồn kho:**

| Trạng thái | Điều kiện |
|---|---|
| `out_of_stock` | `stock = 0` |
| `low_stock` | `0 < stock ≤ lowThreshold` |
| `in_stock` | `stock > lowThreshold` |

---

## 5. Sơ đồ quan hệ dữ liệu

```
Product
  ├── category (N:1) → Category
  ├── brand (N:1) → Brand
  ├── variants (1:N) → ProductVariant  [sku unique, giá, tồn kho]
  ├── images (1:N) → ProductImage     [isCover, sortOrder]
  └── productTags (N:N) → Tag (qua ProductTag)
```

---

## 6. Bảng dữ liệu

### Bảng `Product`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `name` | string | Tên sản phẩm |
| `slug` | string | Unique URL-friendly |
| `description` | string? | Mô tả |
| `categoryId` | string | FK → Category |
| `brandId` | string | FK → Brand |
| `isActive` | boolean | Hiển thị cho khách; mặc định `true` |
| `isFeatured` | boolean | Sản phẩm nổi bật; mặc định `false` |

### Bảng `ProductVariant`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `productId` | string | FK → Product |
| `sku` | string | Unique toàn hệ thống |
| `color` | string? | Màu sắc |
| `storage` | string? | Bộ nhớ |
| `ram` | string? | RAM |
| `imageUrl` | string? | URL ảnh variant |
| `originalPrice` | Decimal | Giá gốc (≥ 0) |
| `salePrice` | Decimal | Giá bán (≤ originalPrice) |
| `stock` | int | Tồn kho (≥ 0) |
| `isActive` | boolean | Hiển thị variant; mặc định `true` |

### Bảng `ProductImage`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `productId` | string | FK → Product |
| `url` | string | URL Cloudinary |
| `publicId` | string | Public ID Cloudinary |
| `isCover` | boolean | Ảnh bìa (chỉ 1 per product) |
| `sortOrder` | int | Thứ tự hiển thị |

---

## 7. Các điểm nghiệp vụ quan trọng

| # | Điểm | Mô tả |
|---|---|---|
| 1 | Variant là đơn vị giá & tồn kho | Product không lưu giá — giá nằm trong variant |
| 2 | SKU unique toàn hệ thống | Không thể dùng cùng SKU cho 2 sản phẩm khác nhau |
| 3 | `salePrice ≤ originalPrice` | Bắt buộc, validate ở tầng API |
| 4 | Tối thiểu 1 variant | Không thể xóa variant cuối cùng của sản phẩm |
| 5 | Update tag là replace all | Gửi `tagIds` khi update → thay thế toàn bộ, không merge |
| 6 | Cache public, không cache admin | Admin luôn thấy data mới nhất |
| 7 | Ảnh cover tự promote | Xóa ảnh bìa → ảnh kế tiếp tự thành bìa |
| 8 | Full-text search GIN | Tìm kiếm dùng PostgreSQL FTS, nhanh hơn ILIKE |
| 9 | Inventory summary cache in-memory | Tính lại mỗi 60 giây, không phụ thuộc Redis |
| 10 | Upload ảnh song song | Nhiều ảnh được upload lên Cloudinary đồng thời |
