# Use Case Document
## Module: Product (Sản phẩm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [BRD.md](./BRD.md) | [SRS.md](./SRS.md)

---

## 1. Actors

| Actor | Mô tả | Role |
|---|---|---|
| **Guest** | Khách hàng chưa đăng nhập | — |
| **Customer** | Khách hàng đã đăng nhập | `CUSTOMER` |
| **Staff** | Nhân viên đã đăng nhập | `STAFF` |
| **Admin** | Quản trị viên đã đăng nhập | `ADMIN` |
| **Cloudinary** | Hệ thống lưu trữ ảnh | Hệ thống ngoài |
| **Redis** | Hệ thống cache | Hệ thống nội bộ |

---

## 2. Danh sách Use Case

| ID | Tên Use Case | Actor chính | Độ ưu tiên |
|---|---|---|---|
| UC-01 | Xem danh sách sản phẩm | Guest / Customer | Cao |
| UC-02 | Xem chi tiết sản phẩm | Guest / Customer | Cao |
| UC-03 | Xem sản phẩm nổi bật | Guest / Customer | Trung bình |
| UC-04 | Tìm kiếm & filter sản phẩm | Guest / Customer | Cao |
| UC-05 | Admin xem danh sách tất cả sản phẩm | Staff / Admin | Cao |
| UC-06 | Admin xem chi tiết sản phẩm (theo ID) | Staff / Admin | Cao |
| UC-07 | Tạo sản phẩm mới | Staff / Admin | Cao |
| UC-08 | Cập nhật sản phẩm | Staff / Admin | Cao |
| UC-09 | Xóa sản phẩm | Staff / Admin | Trung bình |
| UC-10 | Bật/tắt hiển thị sản phẩm | Staff / Admin | Trung bình |
| UC-11 | Bật/tắt nổi bật sản phẩm | Staff / Admin | Trung bình |
| UC-12 | Thêm ảnh vào sản phẩm | Staff / Admin | Trung bình |
| UC-13 | Xóa ảnh khỏi sản phẩm | Staff / Admin | Trung bình |
| UC-14 | Đặt ảnh bìa | Staff / Admin | Trung bình |
| UC-15 | Thêm variant vào sản phẩm | Staff / Admin | Cao |
| UC-16 | Cập nhật variant | Staff / Admin | Cao |
| UC-17 | Xóa variant | Staff / Admin | Trung bình |
| UC-18 | Cập nhật tồn kho nhanh | Staff / Admin | Cao |
| UC-19 | Xem báo cáo tồn kho | Staff / Admin | Cao |

---

## 3. Chi tiết Use Case

---

### UC-01: Xem danh sách sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Guest / Customer |
| **Mục tiêu** | Xem danh sách sản phẩm có phân trang, filter, sort |
| **Tiền điều kiện** | Không có |
| **Hậu điều kiện** | Danh sách sản phẩm được hiển thị |
| **Trigger** | Guest/Customer truy cập trang sản phẩm |

**Luồng chính (Happy Path):**

1. Guest/Customer gọi `GET /api/products` với các query params (page, limit, filter, sort)
2. Hệ thống kiểm tra Redis cache
3. Nếu cache miss:
   - Build `where` clause theo filter
   - Query DB với pagination, sort
   - Chỉ lấy `isActive = true`
   - Include variants active và ảnh bìa
   - Cache result (5 phút TTL)
4. Hệ thống trả về `200` + danh sách sản phẩm + pagination meta

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Cache hit | Trả về cache luôn — không query DB |
| 3 | Filter sai format | Trả `400` — message lỗi cụ thể |
| 3 | limit > 50 | Trả `400` — `Số item/trang tối đa là 50` |

---

### UC-02: Xem chi tiết sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Guest / Customer |
| **Mục tiêu** | Xem chi tiết sản phẩm theo slug |
| **Tiền điều kiện** | Sản phẩm tồn tại và đang active |
| **Hậu điều kiện** | Thông tin đầy đủ được hiển thị |
| **Trigger** | Guest/Customer click vào sản phẩm từ danh sách |

**Luồng chính (Happy Path):**

1. Guest/Customer gọi `GET /api/products/:slug`
2. Hệ thống kiểm tra Redis cache
3. Nếu cache miss:
   - Find product by slug
   - Validate `isActive = true`
   - Include category, brand, tags, tất cả variants active, tất cả ảnh
   - Sort variants by price, images by sortOrder
   - Cache result (5 phút TTL)
4. Hệ thống trả về `200` + product object (full detail)

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 3 | Slug không tồn tại hoặc inactive | Trả `404` — `Sản phẩm không tồn tại` |

---

### UC-03: Xem sản phẩm nổi bật

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Guest / Customer |
| **Mục tiêu** | Xem danh sách sản phẩm nổi bật cho trang chủ |
| **Tiền điều kiện** | Không có |
| **Hậu điều kiện** | Danh sách featured products được hiển thị |
| **Trigger** | Guest/Customer truy cập trang chủ |

**Luồng chính (Happy Path):**

1. Guest/Customer gọi `GET /api/products/featured?limit=8`
2. Hệ thống kiểm tra Redis cache (10 phút TTL)
3. Nếu cache miss:
   - Query: `isActive = true AND isFeatured = true`
   - Sort by `createdAt DESC`
   - Take limit products
   - Include ảnh bìa và variants active
4. Hệ thống trả về `200` + array products

---

### UC-04: Tìm kiếm & filter sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Guest / Customer |
| **Mục tiêu** | Tìm kiếm, filter sản phẩm theo nhiều tiêu chí |
| **Tiền điều kiện** | Không có |
| **Hậu điều kiện** | Danh sách lọc được hiển thị |
| **Trigger** | Guest/Customer nhập search hoặc chọn filter |

**Luồng chính (Happy Path):**

1. Guest/Customer gọi `GET /api/products` với:
   - `search`: từ khóa tìm kiếm (Full-text search)
   - `category`: slug danh mục
   - `brand`: slug thương hiệu
   - `tag`: slug tag
   - `minPrice`, `maxPrice`: khoảng giá
   - `sort`: `newest` / `oldest` / `name_asc` / `name_desc`
2. Hệ thống build query theo filter
3. Hệ thống thực thi query với GIN index (nếu search)
4. Hệ thống trả về `200` + danh sách lọc được

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 3 | Không có kết quả | Trả `200` + empty array (không phải 404) |
| 3 | Filter sai format | Trả `400` — message lỗi |

---

### UC-05: Admin xem danh sách tất cả sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xem tất cả sản phẩm (kể cả ẩn) |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+ |
| **Hậu điều kiện** | Danh sách đầy đủ được hiển thị |
| **Trigger** | Admin truy cập trang quản lý sản phẩm |

**Luồng chính (Happy Path):**

1. Admin gửi request với JWT token
2. Middleware `authenticate` verify token
3. Middleware `authorize` check role STAFF+
4. Admin gọi `GET /api/admin/products` với filter
5. Hệ thống query DB (không cache)
6. Trả về tất cả products (kể cả inactive) + tất cả variants
7. Hệ thống trả về `200` + danh sách

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Token invalid/expired | `401` — `Token không hợp lệ hoặc đã hết hạn` |
| 3 | Role không đủ (CUSTOMER) | `403` — `Bạn không có quyền thực hiện thao tác này` |

---

### UC-06: Admin xem chi tiết sản phẩm (theo ID)

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xem chi tiết sản phẩm theo ID |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+ |
| **Hậu điều kiện** | Thông tin đầy đủ được hiển thị |
| **Trigger** | Admin click vào sản phẩm từ danh sách admin |

**Luồng chính (Happy Path):**

1. Admin gọi `GET /api/admin/products/:id` với JWT token
2. Hệ thống authenticate + authorize
3. Hệ thống find product by ID
4. Hệ thống trả về `200` + product object (full detail, kể cả inactive)

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 3 | ID không tồn tại | Trả `404` — `Sản phẩm không tồn tại` |
| 2 | Token invalid hoặc role không đủ | `401` / `403` |

---

### UC-07: Tạo sản phẩm mới

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Tạo sản phẩm mới với ảnh và variants |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+ |
| **Hậu điều kiện** | Sản phẩm được tạo, variants được tạo, ảnh được upload |
| **Trigger** | Admin điền form và submit |

**Luồng chính (Happy Path):**

1. Admin gọi `POST /api/admin/products` với JWT token
2. Hệ thống authenticate + authorize
3. Admin gửi form-data: name, categoryId, brandId, description, tagIds (JSON), variants (JSON), images (files)
4. Hệ thống parse JSON từ `tagIds` và `variants`
5. Hệ thống validate:
   - `name` ≥ 2 ký tự
   - `categoryId` và `brandId` tồn tại
   - `variants` ≥ 1 phần tử
   - Mỗi variant: `sku` unique, `salePrice ≤ originalPrice`
6. Hệ thống check song song: category tồn tại, brand tồn tại, tags tồn tại, SKUs unique
7. Hệ thống sinh slug duy nhất
8. Hệ thống upload tất cả ảnh song song lên Cloudinary
9. Hệ thống tạo Product + Variants + Tags + Images trong 1 transaction
10. Hệ thống bust toàn bộ cache
11. Hệ thống trả về `201` + product object

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 5 | Validation fail | Trả `400` + message lỗi |
| 6 | Category/Brand/Tag không tồn tại | Trả `400` + message |
| 6 | SKU trùng (payload hoặc DB) | Trả `409` + `SKU đã tồn tại` |
| 8 | Upload Cloudinary fail | Trả `500` + `Không thể upload ảnh` |

---

### UC-08: Cập nhật sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Cập nhật thông tin sản phẩm |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, sản phẩm tồn tại |
| **Hậu điều kiện** | Sản phẩm được cập nhật, cache bị bust |
| **Trigger** | Admin sửa thông tin và save |

**Luồng chính (Happy Path):**

1. Admin gọi `PUT /api/admin/products/:id` với JWT token
2. Hệ thống authenticate + authorize
3. Hệ thống find product — `404` nếu không tồn tại
4. Admin gửi form-data với các field cần update
5. Hệ thống validate FK (category, brand, tags)
6. Hệ thống partial update các field được gửi
7. Nếu có ảnh mới:
   - Upload song song lên Cloudinary
   - Thêm vào sau ảnh hiện có
8. Nếu có `tagIds`:
   - Transaction: xóa hết tag cũ → tạo lại tag mới
9. Hệ thống bust cache
10. Hệ thống trả về `200` + product object

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 3 | ID không tồn tại | Trả `404` |
| 5 | Category/Brand/Tag không tồn tại | Trả `400` |
| 7 | Upload fail | Trả `500` |

---

### UC-09: Xóa sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xóa sản phẩm khỏi hệ thống |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, sản phẩm tồn tại |
| **Hậu điều kiện** | Sản phẩm, variants, images, tags bị xóa, cache bị bust |
| **Trigger** | Admin click nút xóa và confirm |

**Luồng chính (Happy Path):**

1. Admin gọi `DELETE /api/admin/products/:id` với JWT token
2. Hệ thống authenticate + authorize
3. Hệ thống song song:
   - Lấy tất cả images (để lấy `publicId`)
   - Lấy slug (để bust cache)
4. Hệ thống xóa product khỏi DB (cascade: variants, images, productTags)
5. Hệ thống xóa tất cả ảnh trên Cloudinary ở nền (fire-and-forget)
6. Hệ thống bust cache
7. Hệ thống trả về `200` + message

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Token invalid hoặc role không đủ | `401` / `403` |

---

### UC-10: Bật/tắt hiển thị sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Toggle `isActive` của sản phẩm |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, sản phẩm tồn tại |
| **Hậu điều kiện** | `isActive` được cập nhật, cache bị bust |
| **Trigger** | Admin click toggle switch |

**Luồng chính (Happy Path):**

1. Admin gọi `PATCH /api/admin/products/:id/status` với `{ isActive: true/false }`
2. Hệ thống authenticate + authorize
3. Hệ thống find product — `404` nếu không tồn tại
4. Hệ thống update `isActive`
5. Hệ thống bust cache
6. Hệ thống trả về `200` + product object

---

### UC-11: Bật/tắt nổi bật sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Toggle `isFeatured` của sản phẩm |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, sản phẩm tồn tại |
| **Hậu điều kiện** | `isFeatured` được cập nhật, cache featured bị bust |
| **Trigger** | Admin click toggle switch |

**Luồng chính (Happy Path):**

1. Admin gọi `PATCH /api/admin/products/:id/featured` với `{ isFeatured: true/false }`
2. Hệ thống authenticate + authorize
3. Hệ thống find product — `404` nếu không tồn tại
4. Hệ thống update `isFeatured`
5. Hệ thống bust cache featured
6. Hệ thống trả về `200` + product object

---

### UC-12: Thêm ảnh vào sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Upload thêm ảnh vào sản phẩm |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, sản phẩm tồn tại |
| **Hậu điều kiện** | Ảnh được upload, `sortOrder` được cập nhật, cache bị bust |
| **Trigger** | Admin click "Thêm ảnh" và chọn files |

**Luồng chính (Happy Path):**

1. Admin gọi `POST /api/admin/products/:id/images` với JWT token + files
2. Hệ thống authenticate + authorize
3. Hệ thống find product — `404` nếu không tồn tại
4. Hệ thống upload song song tất cả ảnh lên Cloudinary
5. Hệ thống tạo ProductImage records:
   - `sortOrder` = `existingCount + i`
   - `isCover = true` chỉ nếu product chưa có ảnh nào
6. Hệ thống bust cache
7. Hệ thống trả về `201` + images array

---

### UC-13: Xóa ảnh khỏi sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xóa ảnh khỏi sản phẩm |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, ảnh tồn tại và thuộc product |
| **Hậu điều kiện** | Ảnh bị xóa khỏi DB + Cloudinary, cache bị bust |
| **Trigger** | Admin click nút xóa ảnh |

**Luồng chính (Happy Path):**

1. Admin gọi `DELETE /api/admin/products/:id/images/:imageId` với JWT token
2. Hệ thống authenticate + authorize
3. Hệ thống kiểm tra ảnh thuộc product — `404` nếu không
4. Hệ thống xóa DB
5. Hệ thống xóa Cloudinary ở nền
6. Nếu ảnh bị xóa là `isCover`:
   - Tìm ảnh kế tiếp (`sortOrder ASC`)
   - Set làm bìa mới
7. Hệ thống bust cache
8. Hệ thống trả về `200` + message

---

### UC-14: Đặt ảnh bìa

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Đặt một ảnh làm ảnh bìa |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, ảnh tồn tại và thuộc product |
| **Hậu điều kiện** | Ảnh được set làm bìa, ảnh cũ bị unset, cache bị bust |
| **Trigger** | Admin click "Đặt làm ảnh bìa" |

**Luồng chính (Happy Path):**

1. Admin gọi `PATCH /api/admin/products/:id/images/:imageId/cover` với JWT token
2. Hệ thống authenticate + authorize
3. Hệ thống kiểm tra ảnh thuộc product — `404` nếu không
4. Hệ thống atomic transaction:
   - Bỏ `isCover` tất cả ảnh của product
   - Set `isCover = true` cho ảnh được chọn
5. Hệ thống bust cache
6. Hệ thống trả về `200` + images array

---

### UC-15: Thêm variant vào sản phẩm

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Thêm variant mới vào sản phẩm |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, sản phẩm tồn tại |
| **Hậu điều kiện** | Variant được tạo, cache bị bust |
| **Trigger** | Admin điền form variant và submit |

**Luồng chính (Happy Path):**

1. Admin gọi `POST /api/admin/products/:id/variants` với JWT token + variant data
2. Hệ thống authenticate + authorize
3. Hệ thống find product — `404` nếu không tồn tại
4. Hệ thống validate:
   - `sku` không rỗng, unique
   - `salePrice ≤ originalPrice`
   - Giá không âm
5. Hệ thống tạo variant với `isActive = true`, `stock = 0` (nếu không gửi)
6. Hệ thống bust cache
7. Hệ thống trả về `201` + variant object

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 4 | SKU đã tồn tại | Trả `409` — `SKU đã tồn tại` |
| 4 | `salePrice > originalPrice` | Trả `400` — `Giá bán không được lớn hơn giá gốc` |

---

### UC-16: Cập nhật variant

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Cập nhật thông tin variant |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, variant tồn tại và thuộc product |
| **Hậu điều kiện** | Variant được cập nhật, cache bị bust (nếu thay đổi giá/stock/isActive) |
| **Trigger** | Admin sửa thông tin variant và save |

**Luồng chính (Happy Path):**

1. Admin gọi `PUT /api/admin/products/:id/variants/:variantId` với JWT token + variant data
2. Hệ thống authenticate + authorize
3. Hệ thống kiểm tra variant thuộc product — `404` nếu không
4. Hệ thống validate:
   - Nếu sửa `sku` → check unique (bỏ qua chính nó)
   - `salePrice ≤ originalPrice`
   - Giá không âm
5. Hệ thống partial update các field được gửi
6. Nếu thay đổi `salePrice`, `stock`, hoặc `isActive`:
   - Hệ thống bust cache
7. Hệ thống trả về `200` + variant object

---

### UC-17: Xóa variant

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xóa variant khỏi sản phẩm |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, variant tồn tại và thuộc product |
| **Hậu điều kiện** | Variant bị xóa, cache bị bust |
| **Trigger** | Admin click nút xóa variant và confirm |

**Luồng chính (Happy Path):**

1. Admin gọi `DELETE /api/admin/products/:id/variants/:variantId` với JWT token
2. Hệ thống authenticate + authorize
3. Hệ thống kiểm tra variant thuộc product — `404` nếu không
4. Hệ thống đếm tổng số variant của product
5. Hệ thống validate: phải còn ít nhất 2 variants
6. Hệ thống xóa variant
7. Hệ thống bust cache
8. Hệ thống trả về `200` + message

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 5 | Chỉ còn 1 variant | Trả `409` — `Không thể xóa phiên bản cuối cùng của sản phẩm` |

---

### UC-18: Cập nhật tồn kho nhanh

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Patch stock nhanh cho variant |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+, variant tồn tại |
| **Hậu điều kiện** | Stock được cập nhật, cache bị bust |
| **Trigger** | Admin nhập số lượng stock và save |

**Luồng chính (Happy Path):**

1. Admin gọi `PATCH /api/admin/products/:id/variants/:variantId/stock` với `{ stock: number }`
2. Hệ thống authenticate + authorize
3. Hệ thống validate: `stock` là số nguyên ≥ 0
4. Hệ thống update chỉ trường `stock`
5. Hệ thống bust cache (vì stock thay đổi)
6. Hệ thống trả về `200` + variant object

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 3 | `stock` < 0 hoặc không phải số nguyên | Trả `400` — `Tồn kho phải là số nguyên không âm` |

---

### UC-19: Xem báo cáo tồn kho

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xem báo cáo tồn kho tổng quan và chi tiết |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF+ |
| **Hậu điều kiện** | Báo cáo được hiển thị |
| **Trigger** | Admin truy cập trang tồn kho |

**Luồng chính (Happy Path):**

1. Admin gọi `GET /api/admin/inventory` với JWT token + query params
2. Hệ thống authenticate + authorize
3. Hệ thống get summary (in-memory cache, 60s TTL):
   - `totalVariants`, `totalStock`, `outOfStock`, `lowStock`, `inStock`
4. Hệ thống query variants theo filter:
   - `stockStatus`: `all` / `in_stock` / `low_stock` / `out_of_stock`
   - `lowThreshold`: default 5
   - `search`: Full-text search tên sản phẩm
   - `brandSlug`: lọc theo thương hiệu
   - Sort by `stock ASC` (hết hàng lên đầu)
5. Hệ thống trả về `200` + `{ variants, summary, pagination }`

---

## 4. Mối quan hệ giữa Use Cases

```
UC-01 (Danh sách) ──────────────────────► Filter/Sort/Search
                                              │
                                              ▼
UC-02 (Chi tiết) ◄───────────────────── Click từ danh sách
     │
     ├─────────────────────────────► UC-15~17 (Quản lý variant - Admin)
     ├─────────────────────────────► UC-12~14 (Quản lý ảnh - Admin)
     └─────────────────────────────► UC-07~11 (CRUD Product - Admin)

UC-03 (Featured) ──────────────────────► Trang chủ
                                              │
                                              ▼
UC-04 (Search/Filter) ──────────────────► UC-01 (Danh sách lọc)

UC-05~06 (Admin view) ──────────────────► Admin panel
                                              │
                                              ▼
UC-07 (Tạo product) ────────────────────► UC-12 (Thêm ảnh)
                                          UC-15 (Thêm variant)
                                              │
                                              ▼
UC-08 (Update product) ─────────────────► UC-12~14 (Quản lý ảnh)
                                          UC-15~17 (Quản lý variant)

UC-09 (Delete product) ─────────────────► Cascade delete variants/images

UC-18 (Patch stock) ────────────────────► UC-19 (Inventory report)
```

---

## 5. Use Case Matrix

| Use Case | Guest | Customer | Staff | Admin | Frequency | Complexity |
|---|---|---|---|---|---|---|
| UC-01: Danh sách sản phẩm | ✅ | ✅ | — | — | Cao | Thấp |
| UC-02: Chi tiết sản phẩm | ✅ | ✅ | — | — | Cao | Thấp |
| UC-03: Sản phẩm nổi bật | ✅ | ✅ | — | — | Cao | Thấp |
| UC-04: Tìm kiếm & filter | ✅ | ✅ | — | — | Cao | Trung bình |
| UC-05: Admin danh sách | — | — | ✅ | ✅ | Cao | Thấp |
| UC-06: Admin chi tiết | — | — | ✅ | ✅ | Cao | Thấp |
| UC-07: Tạo sản phẩm | — | — | ✅ | ✅ | Trung bình | Cao |
| UC-08: Cập nhật sản phẩm | — | — | ✅ | ✅ | Trung bình | Cao |
| UC-09: Xóa sản phẩm | — | — | ✅ | ✅ | Thấp | Trung bình |
| UC-10: Toggle hiển thị | — | — | ✅ | ✅ | Trung bình | Thấp |
| UC-11: Toggle nổi bật | — | — | ✅ | ✅ | Trung bình | Thấp |
| UC-12: Thêm ảnh | — | — | ✅ | ✅ | Trung bình | Trung bình |
| UC-13: Xóa ảnh | — | — | ✅ | ✅ | Thấp | Thấp |
| UC-14: Đặt ảnh bìa | — | — | ✅ | ✅ | Thấp | Thấp |
| UC-15: Thêm variant | — | — | ✅ | ✅ | Cao | Trung bình |
| UC-16: Cập nhật variant | — | — | ✅ | ✅ | Cao | Trung bình |
| UC-17: Xóa variant | — | — | ✅ | ✅ | Thấp | Trung bình |
| UC-18: Patch stock | — | — | ✅ | ✅ | Cao | Thấp |
| UC-19: Báo cáo tồn kho | — | — | ✅ | ✅ | Cao | Trung bình |

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Next Review:** After implementation complete
