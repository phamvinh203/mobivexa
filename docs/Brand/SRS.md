# SRS — Software Requirement Specification
## Module: Brand
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19 | **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Phạm vi

Module Brand cung cấp CRUD thương hiệu với 2 nhóm route:
- **Public** (`/api/brands`): Không cần đăng nhập
- **Admin** (`/api/admin/brands`): Yêu cầu STAFF hoặc ADMIN

---

## 2. Yêu cầu chức năng

### FR-01: Danh sách thương hiệu (Public)

| | |
|---|---|
| **Endpoint** | `GET /api/brands` |
| **Auth** | ❌ Public |

**Xử lý:** `getBrands(includeInactive=false)` → `WHERE isActive=true ORDER BY name ASC`

**Response:** `200` + `{ brands: Brand[] }`

---

### FR-02: Chi tiết thương hiệu theo slug (Public)

| | |
|---|---|
| **Endpoint** | `GET /api/brands/:slug` |
| **Auth** | ❌ Public |

**Xử lý:** `getBrandBySlug(slug)` → `findUnique WHERE slug=?`

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Slug không tồn tại | 404 | `Thương hiệu không tồn tại` |

---

### FR-03: Danh sách thương hiệu (Admin)

| | |
|---|---|
| **Endpoint** | `GET /api/admin/brands` |
| **Auth** | STAFF+ |

**Xử lý:** `getBrands(includeInactive=true)` → tất cả brand không lọc `isActive`

**Response:** `200` + `{ brands: Brand[] }` — kể cả brand inactive

---

### FR-04: Tạo thương hiệu

| | |
|---|---|
| **Endpoint** | `POST /api/admin/brands` |
| **Auth** | STAFF+ |
| **Content-Type** | `multipart/form-data` |

**Body:**

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | ✅ | ≥ 2 ký tự sau trim; unique |
| `slug` | string | ❌ | Tự sinh từ `name` nếu không gửi |
| `description` | string | ❌ | Không giới hạn |
| `isActive` | boolean/string | ❌ | Default `true` |
| `logo` | file | ❌ | JPEG/PNG/WebP, ≤ 5MB; field name `logo` |

**Xử lý:**
1. Validate `name` ≥ 2 ký tự
2. `assertNameAvailable(trimmedName)` — unique check
3. `generateUniqueSlug(slug || name, slugTaken)` — tự thêm `-1`, `-2`... nếu trùng
4. Nếu có file `logo` → `uploadEntityImage(buffer, 'brands')`
5. `prisma.brand.create(...)`

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `name` < 2 ký tự / thiếu | 400 | `Tên thương hiệu phải có ít nhất 2 ký tự` |
| `name` đã tồn tại | 409 | `Tên thương hiệu đã tồn tại` |

---

### FR-05: Cập nhật thương hiệu

| | |
|---|---|
| **Endpoint** | `PUT /api/admin/brands/:id` |
| **Auth** | STAFF+ |
| **Content-Type** | `multipart/form-data` |

**Body:** Tất cả giống FR-04 nhưng đều optional (partial update)

**Xử lý:**
1. Tìm brand — `404` nếu không tồn tại
2. Nếu có `name` → unique check (loại trừ chính brand này)
3. Nếu có `slug` → generate unique slug (loại trừ chính brand này)
4. Nếu có file mới → upload → lưu URL mới → xóa logo cũ ở nền
5. `prisma.brand.update(data)`

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không tồn tại | 404 | `Thương hiệu không tồn tại` |
| `name` mới đã tồn tại ở brand khác | 409 | `Tên thương hiệu đã tồn tại` |
| `name` được gửi nhưng < 2 ký tự | 400 | `Tên thương hiệu phải có ít nhất 2 ký tự` |

---

### FR-06: Xóa thương hiệu

| | |
|---|---|
| **Endpoint** | `DELETE /api/admin/brands/:id` |
| **Auth** | STAFF+ |

**Xử lý:**
1. Tìm brand — `404` nếu không tồn tại
2. `prisma.product.count({ where: { brandId: id } })`
3. Nếu count > 0 → `409`
4. `prisma.brand.delete(id)`
5. Xóa logo khỏi Cloudinary ở nền (nếu có)

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không tồn tại | 404 | `Thương hiệu không tồn tại` |
| Brand còn sản phẩm | 409 | `Không thể xóa: thương hiệu còn chứa sản phẩm` |

---

### FR-07: Toggle trạng thái

| | |
|---|---|
| **Endpoint** | `PATCH /api/admin/brands/:id/status` |
| **Auth** | STAFF+ |

**Xử lý:** Đảo ngược `isActive` (`true → false` hoặc `false → true`)

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không tồn tại | 404 | `Thương hiệu không tồn tại` |

---

## 3. Cơ chế Slug

### Sinh slug từ tên
```
"Apple Inc" → slugify → "apple-inc"
```

**`slugify()` làm:**
1. Normalize NFD (tách tổ hợp Unicode)
2. Bỏ dấu thanh (combining diacritics)
3. Đổi `đ/Đ` → `d/D`
4. Lowercase + trim
5. Bỏ ký tự đặc biệt (giữ `a-z0-9 -`)
6. Gộp khoảng trắng → `-`
7. Bỏ `-` thừa đầu/cuối

**Xử lý trùng slug:**
```
"apple-inc" → tồn tại → "apple-inc-1" → tồn tại → "apple-inc-2" → OK
```

**Khi update slug:** `excludeId` đảm bảo slug của chính brand không bị coi là trùng.

---

## 4. Quản lý ảnh Logo

| Hành động | Xử lý |
|---|---|
| Tạo brand có logo | `uploadEntityImage(buffer, 'brands')` → lưu `logoUrl` + `logoPublicId` |
| Tạo brand không có logo | `logoUrl = null`, `logoPublicId = null` |
| Cập nhật không đổi logo | Giữ nguyên `logoUrl` + `logoPublicId` cũ |
| Cập nhật có logo mới | Upload mới → lưu URL mới → `destroyImage(oldPublicId)` ở nền |
| Xóa brand | `destroyImage(logoPublicId)` ở nền |

---

## 5. Yêu cầu phi chức năng

| | |
|---|---|
| **Hiệu năng** | Danh sách brand: < 100ms (không pagination — flat list) |
| **Unique name** | Case-insensitive sau trim: "Apple" và "apple " cùng trả 409 |
| **Logo cleanup** | Background task — không chặn response; lỗi xóa Cloudinary không ảnh hưởng business |

---

## 6. Schema dữ liệu

### Bảng `Brand`

| Trường | Kiểu | Nullable | Ghi chú |
|---|---|---|---|
| `id` | string (cuid) | No | PK |
| `name` | string | No | Unique |
| `slug` | string | No | Unique; URL-safe |
| `description` | string | Yes | Mô tả tự do |
| `logoUrl` | string | Yes | Cloudinary secure URL |
| `logoPublicId` | string | Yes | Dùng để xóa ảnh |
| `isActive` | boolean | No | Default true |
| `createdAt` | DateTime | No | Auto |
| `updatedAt` | DateTime | No | Auto |
