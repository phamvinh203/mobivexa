# Nghiệp vụ Category (Danh mục) — Mobivexa

> **Phạm vi:** `src/services/category.service.ts`, `src/controllers/category.controller.ts`, `src/routes/category.route.ts`, `src/validators/category.validator.ts`
>
> **Cập nhật:** 2026-06-19

---

## 1. Tổng quan

Module Category quản lý **cây danh mục sản phẩm** (hỗ trợ đa cấp cha–con). Có 2 nhóm route tách biệt:

- **Public** (`/api/categories`): Không cần đăng nhập — dành cho khách hàng xem danh mục
- **Admin** (`/api/admin/categories`): Yêu cầu `ADMIN` hoặc `STAFF` — quản trị danh mục

---

## 2. Danh sách endpoint

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/api/categories` | Lấy danh sách danh mục đang active | ❌ Public |
| `GET` | `/api/categories/:slug` | Xem chi tiết danh mục (kèm danh mục con active) | ❌ Public |
| `GET` | `/api/admin/categories` | Lấy toàn bộ danh mục (gồm cả inactive) | ✅ STAFF+ |
| `POST` | `/api/admin/categories` | Tạo danh mục mới | ✅ STAFF+ |
| `PUT` | `/api/admin/categories/:id` | Cập nhật danh mục | ✅ STAFF+ |
| `DELETE` | `/api/admin/categories/:id` | Xóa danh mục | ✅ STAFF+ |
| `PATCH` | `/api/admin/categories/:id/status` | Bật / tắt trạng thái danh mục | ✅ STAFF+ |

---

## 3. Chính sách & Ràng buộc nghiệp vụ

### 3.1 Dữ liệu đầu vào

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| `name` | ✅ Tạo mới | Tối thiểu 2 ký tự (sau trim); optional khi cập nhật |
| `slug` | ❌ | Nếu không gửi → tự sinh từ `name`; phải duy nhất |
| `description` | ❌ | Mô tả tùy chọn |
| `parentId` | ❌ | ID danh mục cha; phải tồn tại trong DB; không được là chính nó |
| `sortOrder` | ❌ | Số nguyên, mặc định `0`; dùng để sắp xếp hiển thị |
| `isActive` | ❌ | `true` / `false`; mặc định `true` khi tạo mới |
| `image` | ❌ | File ảnh upload (multipart); JPG/PNG/WebP, tối đa 5MB |

### 3.2 Quy tắc Slug

- Tự động sinh từ `name` nếu không truyền `slug`
- Hỗ trợ tiếng Việt có dấu: `"Điện thoại"` → `"dien-thoai"`
- Nếu slug đã tồn tại → tự động thêm hậu tố: `dien-thoai-1`, `dien-thoai-2`, ...
- Khi cập nhật: slug của chính bản ghi đang sửa không bị coi là trùng

### 3.3 Quy tắc Cây danh mục (Parent–Child)

- Hỗ trợ đa cấp (category con có thể có category con tiếp theo)
- `parentId` phải là ID của category đang tồn tại trong DB
- Không thể đặt chính nó làm danh mục cha (`parentId === selfId`)
- API public `GET /:slug` trả về danh mục kèm `children` (chỉ lấy các con đang `isActive`)

### 3.4 Quy tắc Xóa

- **Không thể xóa** nếu còn danh mục con (`childCount > 0`)
- **Không thể xóa** nếu còn sản phẩm thuộc danh mục đó (`productCount > 0`)
- Kiểm tra song song (parallel) cả 2 điều kiện trên trước khi xóa
- Sau khi xóa DB → xóa ảnh trên Cloudinary ở nền (không chặn response)

### 3.5 Ảnh (Image)

| Quy tắc | Giá trị |
|---|---|
| Định dạng | JPG, JPEG, PNG, WebP |
| Kích thước tối đa | 5 MB |
| Lưu trữ | Cloudinary, folder `categories` |
| `public_id` | Do Cloudinary tự sinh (khác với avatar user) |
| Khi cập nhật ảnh | Upload ảnh mới → lưu DB → xóa ảnh cũ ở nền (async, bỏ qua lỗi) |

### 3.6 Sắp xếp hiển thị

- Public list sắp xếp: `sortOrder ASC` → `name ASC`
- Admin list: cùng thứ tự
- Danh mục con trong `getCategoryBySlug`: sắp theo `sortOrder ASC`

---

## 4. Luồng nghiệp vụ chi tiết

### 4.1 Lấy danh sách (Public)

```
GET /api/categories → getCategories(includeInactive=false) → DB → Response
```

Chỉ trả về các danh mục có `isActive = true`, sắp theo `sortOrder` rồi `name`.

---

### 4.2 Xem chi tiết theo slug (Public)

```
GET /api/categories/:slug → getCategoryBySlug → DB → Response
```

Trả về danh mục kèm `children[]` — chỉ bao gồm con đang active, sắp theo `sortOrder`.
Nếu slug không tồn tại → `404`.

---

### 4.3 Tạo danh mục (Admin)

```
POST /api/admin/categories
  → [authenticate] → [authorize STAFF+]
  → [uploadImage.single('image')] → [validate]
  → createCategory → DB + Cloudinary → Response
```

**Happy Path:**
1. Validate `name` ≥ 2 ký tự
2. Nếu có `parentId` → kiểm tra parent tồn tại và không phải chính nó
3. Sinh slug duy nhất từ `slug || name`
4. Nếu có file ảnh → upload lên Cloudinary (`folder: categories`)
5. Tạo bản ghi Category trong DB
6. Trả về `201` + category mới

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `name` < 2 ký tự | 400 | `Tên danh mục phải có ít nhất 2 ký tự` |
| `parentId` không tồn tại | 400 | `Danh mục cha không tồn tại` |
| `parentId` là chính nó | 400 | `Danh mục không thể là cha của chính nó` |
| Sai role | 403 | `Bạn không có quyền thực hiện thao tác này` |

---

### 4.4 Cập nhật danh mục (Admin)

```
PUT /api/admin/categories/:id
  → [authenticate] → [authorize STAFF+]
  → [uploadImage.single('image')] → [validate]
  → updateCategory → DB + Cloudinary → Response
```

**Happy Path:**
1. Tìm category theo `id` — `404` nếu không tồn tại
2. Validate `name` nếu được gửi (optional khi update)
3. Nếu có `parentId` → kiểm tra parent và không phải chính nó
4. Cập nhật từng trường được gửi lên (partial update)
5. Nếu có file ảnh mới → upload → lưu URL mới → xóa ảnh cũ ở nền
6. Trả về `200` + category đã cập nhật

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `id` không tồn tại | 404 | `Danh mục không tồn tại` |
| `parentId` không tồn tại | 400 | `Danh mục cha không tồn tại` |
| `parentId` là chính nó | 400 | `Danh mục không thể là cha của chính nó` |

---

### 4.5 Xóa danh mục (Admin)

```
DELETE /api/admin/categories/:id
  → [authenticate] → [authorize STAFF+]
  → deleteCategory → DB + Cloudinary → Response
```

**Happy Path:**
1. Tìm category — `404` nếu không tồn tại
2. Đếm song song: số danh mục con + số sản phẩm thuộc danh mục
3. Nếu có con hoặc có sản phẩm → `409`
4. Xóa khỏi DB
5. Xóa ảnh trên Cloudinary ở nền
6. Trả về `200`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `id` không tồn tại | 404 | `Danh mục không tồn tại` |
| Còn danh mục con | 409 | `Không thể xóa: danh mục còn chứa danh mục con` |
| Còn sản phẩm | 409 | `Không thể xóa: danh mục còn chứa sản phẩm` |

---

### 4.6 Bật / Tắt trạng thái (Admin)

```
PATCH /api/admin/categories/:id/status
  → [authenticate] → [authorize STAFF+]
  → toggleCategoryStatus → DB → Response
```

**Happy Path:**
1. Tìm category — `404` nếu không tồn tại
2. Đảo ngược `isActive` (`true` → `false`, `false` → `true`)
3. Trả về `200` + category với trạng thái mới

> Khi tắt (`isActive = false`): danh mục bị ẩn khỏi API public nhưng **không** cascade ẩn danh mục con hay sản phẩm.

---

## 5. Bảng dữ liệu

### Bảng `Category`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `name` | string | Tên danh mục |
| `slug` | string | Unique, dùng cho URL |
| `description` | string? | Mô tả |
| `parentId` | string? | FK → Category (tự tham chiếu) |
| `sortOrder` | int | Thứ tự sắp xếp, mặc định `0` |
| `isActive` | boolean | Hiển thị cho khách hàng |
| `imageUrl` | string? | URL ảnh trên Cloudinary |
| `imagePublicId` | string? | Public ID trên Cloudinary (dùng để xóa ảnh cũ) |
| `children` | Category[] | Relation: danh mục con |

---

## 6. Điểm khác biệt Public vs Admin

| Hành vi | Public | Admin |
|---|---|---|
| Lọc `isActive` | Chỉ lấy `isActive = true` | Lấy tất cả |
| Trả về danh mục con | ✅ Có (trong `getCategoryBySlug`) | ❌ Không (chỉ flat list) |
| Xác thực | Không cần | Cần `ADMIN` hoặc `STAFF` |
