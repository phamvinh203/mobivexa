# Use Case Document
## Module: Brand
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Guest / Customer** | Người dùng chưa đăng nhập hoặc đã đăng nhập — xem danh sách brand |
| **Staff / Admin** | Quản trị thương hiệu (STAFF hoặc ADMIN role) |
| **Cloudinary** | Hệ thống lưu trữ logo bên ngoài |

---

## 2. Danh sách Use Case

| ID | Tên | Actor | Ưu tiên |
|---|---|---|---|
| UC-01 | Xem danh sách thương hiệu | Guest/Customer | Cao |
| UC-02 | Xem chi tiết thương hiệu | Guest/Customer | Cao |
| UC-03 | Xem danh sách thương hiệu (Admin) | Staff/Admin | Cao |
| UC-04 | Tạo thương hiệu mới | Staff/Admin | Cao |
| UC-05 | Cập nhật thương hiệu | Staff/Admin | Cao |
| UC-06 | Xóa thương hiệu | Staff/Admin | Trung bình |
| UC-07 | Bật / Tắt thương hiệu | Staff/Admin | Trung bình |

---

## 3. Chi tiết Use Case

---

### UC-01: Xem danh sách thương hiệu (Public)

| | |
|---|---|
| **Actor** | Guest / Customer |
| **Mục tiêu** | Hiển thị bộ lọc thương hiệu / trang danh sách brand |
| **Tiền điều kiện** | Không cần đăng nhập |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. Client gọi `GET /api/brands`
2. Hệ thống query brand với `isActive = true`, sắp A→Z
3. Trả về danh sách brand

---

### UC-02: Xem chi tiết thương hiệu theo slug (Public)

| | |
|---|---|
| **Actor** | Guest / Customer |
| **Mục tiêu** | Xem thông tin brand và có thể lọc sản phẩm theo brand |
| **Tiền điều kiện** | Không cần đăng nhập |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. Client gọi `GET /api/brands/:slug`
2. Hệ thống tìm brand theo slug
3. Tìm thấy → trả về brand detail

**Luồng thay thế:**
- Slug không tồn tại → `404` `Thương hiệu không tồn tại`

---

### UC-03: Xem danh sách thương hiệu (Admin)

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Quản trị toàn bộ brand kể cả inactive |
| **Tiền điều kiện** | Đã đăng nhập, role STAFF hoặc ADMIN |

**Luồng chính:**
1. `GET /api/admin/brands`
2. Query tất cả brand (không lọc `isActive`), sắp A→Z
3. Trả về danh sách đầy đủ

---

### UC-04: Tạo thương hiệu mới

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Thêm thương hiệu mới vào hệ thống |
| **Tiền điều kiện** | Đã đăng nhập STAFF+ |
| **Hậu điều kiện** | Brand mới được tạo trong DB; logo (nếu có) lên Cloudinary |

**Luồng chính:**
1. Staff nhập `name`, tùy chọn `slug`, `description`, `isActive`, file `logo`
2. Validate: `name` ≥ 2 ký tự
3. Kiểm tra `name` unique (sau trim)
4. Sinh slug: dùng `slug` nếu gửi, không thì dùng `name` → slugify → thêm hậu tố nếu trùng
5. Nếu có file logo → upload lên Cloudinary folder `brands`
6. Tạo brand trong DB
7. Trả `201` + brand mới

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `name` < 2 ký tự hoặc thiếu | `400` |
| 3 | `name` đã tồn tại | `409` `Tên thương hiệu đã tồn tại` |
| 4 | Slug do user nhập bị trùng | Tự thêm hậu tố `-1`, `-2`... không báo lỗi |

---

### UC-05: Cập nhật thương hiệu

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Sửa thông tin brand |
| **Tiền điều kiện** | Brand tồn tại; đã đăng nhập STAFF+ |
| **Hậu điều kiện** | Brand được cập nhật; logo cũ bị xóa nếu upload logo mới |

**Luồng chính:**
1. `PUT /api/admin/brands/:id` với các trường muốn cập nhật
2. Tìm brand — `404` nếu không tồn tại
3. Nếu gửi `name` → validate + unique check (loại trừ brand này)
4. Nếu gửi `slug` → generate unique (loại trừ brand này)
5. Nếu có file logo mới:
   - Upload lên Cloudinary
   - Ghi `logoUrl` + `logoPublicId` mới vào `data`
   - Xóa logo cũ ở nền (không chặn response)
6. `prisma.brand.update(data)` — chỉ trường được gửi

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `id` không tồn tại | `404` |
| 3 | `name` mới trùng brand khác | `409` |
| 3 | `name` gửi < 2 ký tự | `400` |

---

### UC-06: Xóa thương hiệu

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xóa brand không còn dùng |
| **Tiền điều kiện** | Brand tồn tại; không còn sản phẩm nào thuộc brand này |
| **Hậu điều kiện** | Brand bị xóa khỏi DB; logo bị xóa khỏi Cloudinary |

**Luồng chính:**
1. `DELETE /api/admin/brands/:id`
2. Tìm brand — `404` nếu không tồn tại
3. Đếm sản phẩm thuộc brand — nếu > 0 → `409`
4. Xóa brand trong DB
5. Xóa logo Cloudinary ở nền

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `id` không tồn tại | `404` |
| 3 | Brand còn sản phẩm | `409` `Không thể xóa: thương hiệu còn chứa sản phẩm` |

> **Thiết kế:** Phải xóa hoặc chuyển brand cho tất cả sản phẩm trước khi xóa brand.

---

### UC-07: Bật / Tắt thương hiệu

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Tạm ẩn brand mà không xóa |
| **Tiền điều kiện** | Brand tồn tại |
| **Hậu điều kiện** | `isActive` đảo ngược |

**Luồng chính:**
1. `PATCH /api/admin/brands/:id/status`
2. Tìm brand — `404` nếu không tồn tại
3. `isActive = !isActive`
4. Trả `200` + brand mới

---

## 4. Quan hệ Use Cases

```
UC-01 Xem list (public) ──────────── chỉ trả brand active
UC-03 Xem list (admin) ────────────── trả tất cả

UC-04 Tạo ──► Brand tồn tại trong DB ──► UC-01/02/03 hiển thị

UC-07 Toggle ──► isActive=false ──► UC-01 bỏ qua brand này
              └► isActive=true  ──► UC-01 hiển thị lại

UC-06 Xóa ──► Bị chặn nếu brand có Product (kiểm tra ở Product module)
         └──► Thành công ──► Logo xóa khỏi Cloudinary
```
