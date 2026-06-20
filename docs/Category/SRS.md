# SRS — Software Requirement Specification
## Module: Category
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19 | **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Phạm vi

Module Category cung cấp CRUD danh mục với 2 nhóm route:
- **Public** (`/api/categories`): Không cần đăng nhập
- **Admin** (`/api/admin/categories`): Yêu cầu STAFF hoặc ADMIN

---

## 2. Yêu cầu chức năng

### FR-01: Danh sách danh mục (Public)

| | |
|---|---|
| **Endpoint** | `GET /api/categories` |
| **Auth** | ❌ Public |

**Xử lý:** `getCategories(includeInactive=false)` → `WHERE isActive=true ORDER BY sortOrder ASC, name ASC`

**Response:** `200` + `{ categories: Category[] }`

> Trả danh sách phẳng — client tự xây dựng cây nếu cần (dùng `parentId`).

---

### FR-02: Chi tiết danh mục theo slug (Public)

| | |
|---|---|
| **Endpoint** | `GET /api/categories/:slug` |
| **Auth** | ❌ Public |

**Xử lý:** `getCategoryBySlug(slug)` → `findUnique` với `include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } }`

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Slug không tồn tại | 404 | `Danh mục không tồn tại` |

> Danh mục con (`children`) được lọc theo `isActive = true` và sắp xếp theo `sortOrder`.

---

### FR-03: Danh sách danh mục (Admin)

| | |
|---|---|
| **Endpoint** | `GET /api/admin/categories` |
| **Auth** | STAFF+ |

**Xử lý:** `getCategories(includeInactive=true)` → tất cả, có cả inactive

---

### FR-04: Tạo danh mục

| | |
|---|---|
| **Endpoint** | `POST /api/admin/categories` |
| **Auth** | STAFF+ |
| **Content-Type** | `multipart/form-data` |

**Body:**

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | ✅ | ≥ 2 ký tự sau trim |
| `slug` | string | ❌ | Tự sinh từ `name` nếu không gửi |
| `description` | string | ❌ | |
| `parentId` | string | ❌ | Phải là category tồn tại; không thể là chính mình |
| `sortOrder` | number | ❌ | Default `0`; ép kiểu `Number(sortOrder)` |
| `isActive` | boolean/string | ❌ | Default `true`; parse: `String(value) !== 'false'` |
| `image` | file | ❌ | JPEG/PNG/WebP ≤ 5MB; field name `image` |

**Xử lý:**
1. Validate `name` ≥ 2 ký tự
2. Nếu có `parentId` → `assertParentExists(parentId)` — `400` nếu không tồn tại
3. `generateUniqueSlug(slug || name, slugTaken)` — không truyền `excludeId` khi tạo
4. Nếu có file `image` → `uploadEntityImage(buffer, 'categories')`
5. `prisma.category.create(...)`

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `name` < 2 ký tự / thiếu | 400 | `Tên danh mục phải có ít nhất 2 ký tự` |
| `parentId` không tồn tại | 400 | `Danh mục cha không tồn tại` |

---

### FR-05: Cập nhật danh mục

| | |
|---|---|
| **Endpoint** | `PUT /api/admin/categories/:id` |
| **Auth** | STAFF+ |
| **Content-Type** | `multipart/form-data` |

**Body:** Giống FR-04, tất cả optional

**Xử lý:**
1. `findCategoryOrThrow(id)` — `404` nếu không tồn tại
2. Nếu `parentId !== undefined && parentId !== null` → `assertParentExists(parentId, id)` — kiểm tra cả circular (không thể là cha của chính mình)
3. Build `data` object chỉ từ các trường được gửi
4. Nếu có `slug` → `generateUniqueSlug(slug, slugTaken(findBySlug, id))` — truyền `id` để exclude chính mình
5. Nếu có file mới → upload → ghi `imageUrl/imagePublicId` mới → destroy cũ nền

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không tồn tại | 404 | `Danh mục không tồn tại` |
| `parentId = chính id` | 400 | `Danh mục không thể là cha của chính nó` |
| `parentId` không tồn tại | 400 | `Danh mục cha không tồn tại` |
| `name` được gửi nhưng < 2 ký tự | 400 | `Tên danh mục phải có ít nhất 2 ký tự` |

---

### FR-06: Xóa danh mục

| | |
|---|---|
| **Endpoint** | `DELETE /api/admin/categories/:id` |
| **Auth** | STAFF+ |

**Xử lý:**
1. `findCategoryOrThrow(id)` — `404` nếu không tồn tại
2. Song song: `Promise.all([category.count({ parentId: id }), product.count({ categoryId: id })])`
3. `childCount > 0` → `409`
4. `productCount > 0` → `409`
5. `prisma.category.delete(id)`
6. Destroy ảnh Cloudinary nền

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không tồn tại | 404 | `Danh mục không tồn tại` |
| Còn danh mục con | 409 | `Không thể xóa: danh mục còn chứa danh mục con` |
| Còn sản phẩm | 409 | `Không thể xóa: danh mục còn chứa sản phẩm` |

> **Ưu tiên lỗi:** `childCount` được check trước `productCount` trong code.

---

### FR-07: Toggle trạng thái

| | |
|---|---|
| **Endpoint** | `PATCH /api/admin/categories/:id/status` |
| **Auth** | STAFF+ |

**Xử lý:** Đảo `isActive`

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không tồn tại | 404 | `Danh mục không tồn tại` |

---

## 3. Cơ chế Slug

Giống Brand — dùng chung `generateUniqueSlug` + `slugTaken`:
- Sinh từ `name` nếu không gửi `slug`
- Thêm `-1`, `-2`... nếu trùng
- Khi update: `slugTaken(findBySlug, id)` — exclude chính mình

---

## 4. Cơ chế `sortOrder`

- **Mặc định:** `0` khi tạo (nếu không gửi)
- **Sắp xếp:** `sortOrder ASC` → `name ASC` (trong cùng `sortOrder`, sắp A→Z)
- **Kiểu dữ liệu:** `Number(sortOrder)` — ép kiểu từ string form-data

---

## 5. Quản lý ảnh

| Hành động | Xử lý |
|---|---|
| Tạo có ảnh | `uploadEntityImage(buffer, 'categories')` → `imageUrl + imagePublicId` |
| Tạo không ảnh | `imageUrl = null`, `imagePublicId = null` |
| Update không đổi ảnh | Giữ nguyên cũ |
| Update có ảnh mới | Upload mới → destroy cũ nền |
| Xóa category | Destroy ảnh nền (nếu có) |

---

## 6. Yêu cầu phi chức năng

| | |
|---|---|
| **Hiệu năng** | Danh sách: < 100ms |
| **Tên không cần unique** | Khác Brand — hai category cùng tên OK, chỉ slug unique |
| **Circular check** | App-level: `parentId === selfId` → 400 (không phải DB constraint) |
| **Image cleanup** | Background — không chặn response |

---

## 7. Schema dữ liệu

### Bảng `Category`

| Trường | Kiểu | Nullable | Ghi chú |
|---|---|---|---|
| `id` | string (uuid) | No | PK |
| `name` | string | No | Không unique (khác Brand) |
| `slug` | string | No | Unique |
| `description` | string | Yes | |
| `imageUrl` | string | Yes | Cloudinary URL |
| `imagePublicId` | string | Yes | Dùng để xóa ảnh |
| `parentId` | string | Yes | FK → Category (self-referential) |
| `sortOrder` | int | No | Default 0 |
| `isActive` | boolean | No | Default true |
| `createdAt` | DateTime | No | Auto |
| `updatedAt` | DateTime | No | Auto |
