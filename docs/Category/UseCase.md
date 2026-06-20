# Use Case Document
## Module: Category
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Guest / Customer** | Duyệt danh mục, không cần đăng nhập |
| **Staff / Admin** | Quản trị cây danh mục (STAFF hoặc ADMIN role) |
| **Cloudinary** | Lưu trữ ảnh đại diện danh mục |

---

## 2. Danh sách Use Case

| ID | Tên | Actor | Ưu tiên |
|---|---|---|---|
| UC-01 | Xem danh sách danh mục | Guest/Customer | Cao |
| UC-02 | Xem chi tiết danh mục (có sub-categories) | Guest/Customer | Cao |
| UC-03 | Xem danh sách danh mục (Admin) | Staff/Admin | Cao |
| UC-04 | Tạo danh mục mới | Staff/Admin | Cao |
| UC-05 | Cập nhật danh mục | Staff/Admin | Cao |
| UC-06 | Xóa danh mục | Staff/Admin | Trung bình |
| UC-07 | Bật / Tắt danh mục | Staff/Admin | Trung bình |

---

## 3. Chi tiết Use Case

---

### UC-01: Xem danh sách danh mục (Public)

| | |
|---|---|
| **Actor** | Guest / Customer |
| **Mục tiêu** | Hiển thị menu/bộ lọc danh mục |
| **Tiền điều kiện** | Không cần đăng nhập |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. Client gọi `GET /api/categories`
2. Hệ thống query `WHERE isActive=true ORDER BY sortOrder ASC, name ASC`
3. Trả về danh sách phẳng (flat list, client tự build tree nếu cần)

---

### UC-02: Xem chi tiết danh mục theo slug (Public)

| | |
|---|---|
| **Actor** | Guest / Customer |
| **Mục tiêu** | Trang danh mục hiển thị thông tin + sub-categories |
| **Tiền điều kiện** | Không cần đăng nhập |

**Luồng chính:**
1. `GET /api/categories/:slug`
2. Tìm category theo slug
3. Bao gồm `children` (active, sắp theo `sortOrder`)
4. Trả category + children

**Luồng thay thế:**
- Slug không tồn tại → `404` `Danh mục không tồn tại`

---

### UC-03: Xem danh sách danh mục (Admin)

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Quản lý toàn bộ danh mục kể cả inactive |

**Luồng chính:**
1. `GET /api/admin/categories`
2. Query tất cả, không lọc `isActive`
3. Sắp xếp `sortOrder ASC, name ASC`

---

### UC-04: Tạo danh mục mới

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Thêm danh mục vào cây |
| **Tiền điều kiện** | Đăng nhập STAFF+ |
| **Hậu điều kiện** | Danh mục mới tạo trong DB; ảnh (nếu có) lên Cloudinary |

**Luồng chính:**
1. Gửi `POST` với `name`, tùy chọn `slug`, `description`, `parentId`, `sortOrder`, `isActive`, file `image`
2. Validate `name` ≥ 2 ký tự
3. Nếu có `parentId` → kiểm tra tồn tại
4. Sinh slug unique từ `slug` (nếu gửi) hoặc `name`
5. Upload ảnh lên Cloudinary (nếu có)
6. Tạo category → `201`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `name` < 2 ký tự | `400` |
| 3 | `parentId` không tồn tại | `400` `Danh mục cha không tồn tại` |

---

### UC-05: Cập nhật danh mục

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Sửa thông tin danh mục |
| **Tiền điều kiện** | Category tồn tại; STAFF+ |
| **Hậu điều kiện** | Category cập nhật; ảnh cũ xóa nếu đổi ảnh |

**Luồng chính:**
1. `PUT /api/admin/categories/:id` với các trường cần sửa
2. Tìm category — `404` nếu không tồn tại
3. Nếu `parentId` gửi và không null → kiểm tra parent hợp lệ (không phải chính mình)
4. Nếu gửi `slug` → sinh slug unique (loại trừ chính mình)
5. Nếu có file ảnh mới → upload → destroy ảnh cũ nền
6. `prisma.category.update(data)`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `id` không tồn tại | `404` |
| 3 | `parentId = chính id` | `400` `Danh mục không thể là cha của chính nó` |
| 3 | `parentId` không tồn tại | `400` `Danh mục cha không tồn tại` |

---

### UC-06: Xóa danh mục

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xóa danh mục không còn dùng |
| **Tiền điều kiện** | Category tồn tại; không có con; không có sản phẩm |
| **Hậu điều kiện** | Category xóa khỏi DB; ảnh xóa Cloudinary |

**Luồng chính:**
1. `DELETE /api/admin/categories/:id`
2. Tìm category — `404` nếu không tồn tại
3. Đếm song song: con + sản phẩm
4. Con > 0 → `409`; Sản phẩm > 0 → `409`
5. Xóa category
6. Destroy ảnh nền

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `id` không tồn tại | `404` |
| 4 | Còn danh mục con | `409` `Không thể xóa: danh mục còn chứa danh mục con` |
| 4 | Còn sản phẩm | `409` `Không thể xóa: danh mục còn chứa sản phẩm` |

> **Lưu ý:** Phải xóa tất cả danh mục con và chuyển toàn bộ sản phẩm sang danh mục khác trước khi xóa.

---

### UC-07: Bật / Tắt danh mục

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Tạm ẩn danh mục mà không xóa |
| **Tiền điều kiện** | Category tồn tại |

**Luồng chính:**
1. `PATCH /api/admin/categories/:id/status`
2. `isActive = !isActive`
3. `200` + category mới

---

## 4. Quan hệ Use Cases

```
UC-01 List (public) ──── chỉ trả active, sort by sortOrder
UC-03 List (admin) ───── trả tất cả

UC-04 Tạo ──► Category trong DB ──► UC-01/02/03 thấy

UC-04 Tạo con ──► parentId phải valid ──► assertParentExists
UC-05 Đổi parent ──► không thể circular ──► assertParentExists(parentId, selfId)

UC-07 Toggle ──► inactive ──► UC-01 ẩn; UC-02 vẫn trả (findUnique không lọc isActive)
             └──► active  ──► UC-01 hiển thị lại

UC-06 Xóa ──► Bị chặn bởi: con (UC-04 tạo con) hoặc sản phẩm (Product module)
         └──► Thành công ──► ảnh xóa Cloudinary
```
