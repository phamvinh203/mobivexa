# Nghiệp vụ Brand (Thương hiệu) — Mobivexa

> **Phạm vi:** `src/services/brand.service.ts`, `src/controllers/brand.controller.ts`, `src/routes/brand.route.ts`, `src/validators/brand.validator.ts`
>
> **Cập nhật:** 2026-06-19

---

## 1. Tổng quan

Module Brand quản lý **danh sách thương hiệu sản phẩm**. Cấu trúc tương tự Category nhưng là danh sách phẳng (không có quan hệ cha–con). Có 2 nhóm route:

- **Public** (`/api/brands`): Không cần đăng nhập — khách hàng lọc sản phẩm theo thương hiệu
- **Admin** (`/api/admin/brands`): Yêu cầu `ADMIN` hoặc `STAFF` — quản trị thương hiệu

---

## 2. Danh sách endpoint

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/api/brands` | Lấy danh sách thương hiệu đang active | ❌ Public |
| `GET` | `/api/brands/:slug` | Xem chi tiết thương hiệu | ❌ Public |
| `GET` | `/api/admin/brands` | Lấy toàn bộ thương hiệu (gồm cả inactive) | ✅ STAFF+ |
| `POST` | `/api/admin/brands` | Tạo thương hiệu mới | ✅ STAFF+ |
| `PUT` | `/api/admin/brands/:id` | Cập nhật thương hiệu | ✅ STAFF+ |
| `DELETE` | `/api/admin/brands/:id` | Xóa thương hiệu | ✅ STAFF+ |
| `PATCH` | `/api/admin/brands/:id/status` | Bật / tắt trạng thái | ✅ STAFF+ |

---

## 3. Chính sách & Ràng buộc nghiệp vụ

### 3.1 Dữ liệu đầu vào

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| `name` | ✅ Tạo mới | Tối thiểu 2 ký tự (sau trim); **unique** trong toàn hệ thống; optional khi cập nhật |
| `slug` | ❌ | Tự sinh từ `name` nếu không gửi; phải duy nhất |
| `description` | ❌ | Mô tả tùy chọn |
| `isActive` | ❌ | Mặc định `true` khi tạo mới |
| `logo` | ❌ | File ảnh logo (multipart); JPG/PNG/WebP, tối đa 5MB |

### 3.2 Quy tắc Tên (Name)

- `name` phải **unique toàn hệ thống** (khác với Category chỉ cần tên không trùng slug)
- So sánh sau khi `trim()` — `"Apple"` và `"  Apple  "` bị coi là trùng
- Khi cập nhật: tên của chính bản ghi đang sửa không bị coi là trùng

### 3.3 Quy tắc Slug

- Tự động sinh từ `name` nếu không truyền `slug`
- Hỗ trợ tiếng Việt: `"Điện thoại Samsung"` → `"dien-thoai-samsung"`
- Nếu slug trùng → tự thêm hậu tố: `samsung-1`, `samsung-2`, ...
- Khi cập nhật: slug của bản ghi đang sửa không bị coi là trùng

### 3.4 Quy tắc Xóa

- **Không thể xóa** nếu còn sản phẩm thuộc thương hiệu đó (`productCount > 0`)
- Sau khi xóa DB → xóa logo trên Cloudinary ở nền (không chặn response)

### 3.5 Logo

| Quy tắc | Giá trị |
|---|---|
| Định dạng | JPG, JPEG, PNG, WebP |
| Kích thước tối đa | 5 MB |
| Lưu trữ | Cloudinary, folder `brands` |
| `public_id` | Do Cloudinary tự sinh |
| Khi cập nhật logo | Upload mới → lưu DB → xóa logo cũ ở nền (async, bỏ qua lỗi) |

### 3.6 Sắp xếp

- Danh sách sắp xếp theo `name ASC` (cả public lẫn admin)

---

## 4. Luồng nghiệp vụ chi tiết

### 4.1 Lấy danh sách (Public)

```
GET /api/brands → getBrands(includeInactive=false) → DB → Response
```

Chỉ trả về thương hiệu `isActive = true`, sắp theo `name ASC`.

---

### 4.2 Xem chi tiết theo slug (Public)

```
GET /api/brands/:slug → getBrandBySlug → DB → Response
```

Trả về toàn bộ thông tin thương hiệu. Nếu slug không tồn tại → `404`.

---

### 4.3 Tạo thương hiệu (Admin)

```
POST /api/admin/brands
  → [authenticate] → [authorize STAFF+]
  → [uploadImage.single('logo')] → [validate]
  → createBrand → DB + Cloudinary → Response
```

**Happy Path:**
1. Validate `name` ≥ 2 ký tự
2. Trim `name`, kiểm tra unique trong DB
3. Sinh slug duy nhất từ `slug || name`
4. Nếu có file logo → upload lên Cloudinary (`folder: brands`)
5. Tạo bản ghi Brand trong DB
6. Trả về `201` + brand mới

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `name` < 2 ký tự | 400 | `Tên thương hiệu phải có ít nhất 2 ký tự` |
| `name` đã tồn tại | 409 | `Tên thương hiệu đã tồn tại` |
| Sai role | 403 | `Bạn không có quyền thực hiện thao tác này` |

---

### 4.4 Cập nhật thương hiệu (Admin)

```
PUT /api/admin/brands/:id
  → [authenticate] → [authorize STAFF+]
  → [uploadImage.single('logo')] → [validate]
  → updateBrand → DB + Cloudinary → Response
```

**Happy Path:**
1. Tìm brand theo `id` — `404` nếu không tồn tại
2. Nếu có `name` → trim, kiểm tra unique (bỏ qua chính nó)
3. Cập nhật từng trường được gửi lên (partial update)
4. Nếu có file logo mới → upload → lưu URL mới → xóa logo cũ ở nền
5. Trả về `200` + brand đã cập nhật

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `id` không tồn tại | 404 | `Thương hiệu không tồn tại` |
| `name` đã dùng bởi brand khác | 409 | `Tên thương hiệu đã tồn tại` |

---

### 4.5 Xóa thương hiệu (Admin)

```
DELETE /api/admin/brands/:id
  → [authenticate] → [authorize STAFF+]
  → deleteBrand → DB + Cloudinary → Response
```

**Happy Path:**
1. Tìm brand — `404` nếu không tồn tại
2. Đếm sản phẩm thuộc thương hiệu
3. Nếu còn sản phẩm → `409`
4. Xóa khỏi DB
5. Xóa logo trên Cloudinary ở nền
6. Trả về `200`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `id` không tồn tại | 404 | `Thương hiệu không tồn tại` |
| Còn sản phẩm | 409 | `Không thể xóa: thương hiệu còn chứa sản phẩm` |

---

### 4.6 Bật / Tắt trạng thái (Admin)

```
PATCH /api/admin/brands/:id/status
  → [authenticate] → [authorize STAFF+]
  → toggleBrandStatus → DB → Response
```

1. Tìm brand — `404` nếu không tồn tại
2. Đảo ngược `isActive`
3. Trả về `200` + brand với trạng thái mới

> Khi tắt (`isActive = false`): thương hiệu bị ẩn khỏi API public nhưng sản phẩm thuộc thương hiệu không bị ảnh hưởng.

---

## 5. Bảng dữ liệu

### Bảng `Brand`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `name` | string | Unique — tên thương hiệu |
| `slug` | string | Unique — dùng cho URL |
| `description` | string? | Mô tả |
| `isActive` | boolean | Hiển thị cho khách hàng |
| `logoUrl` | string? | URL logo trên Cloudinary |
| `logoPublicId` | string? | Public ID trên Cloudinary (dùng để xóa logo cũ) |

---

## 6. So sánh Brand vs Category

| Tiêu chí | Brand | Category |
|---|---|---|
| Cấu trúc | Phẳng (flat list) | Cây (parent–child) |
| Ràng buộc tên | `name` unique toàn DB | Không yêu cầu unique tên |
| Ràng buộc xóa | Có sản phẩm → chặn | Có con HOẶC có sản phẩm → chặn |
| Ảnh | Logo (Cloudinary, public_id tự sinh) | Image (Cloudinary, public_id tự sinh) |
| Sắp xếp | `name ASC` | `sortOrder ASC` → `name ASC` |
| Có `sortOrder` | ❌ | ✅ |
| Có quan hệ con | ❌ | ✅ (`children`) |
