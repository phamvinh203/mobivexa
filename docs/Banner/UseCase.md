# Use Case Document
## Module: Banner
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Guest / Client** | Frontend lấy banner để render, không cần đăng nhập |
| **Staff / Admin** | Quản lý banner (STAFF hoặc ADMIN role) |
| **Cloudinary** | Lưu ảnh banner; xóa ảnh cũ / ảnh mồ côi |

---

## 2. Danh sách Use Case

| ID | Tên | Actor | Ưu tiên |
|---|---|---|---|
| UC-01 | Xem danh sách banner theo vị trí | Guest/Client | Cao |
| UC-02 | Xem danh sách vị trí hợp lệ | Guest/Client | Trung bình |
| UC-03 | Xem danh sách banner (Admin — có cả inactive) | Staff/Admin | Cao |
| UC-04 | Tạo banner mới | Staff/Admin | Cao |
| UC-05 | Cập nhật banner | Staff/Admin | Cao |
| UC-06 | Xóa banner | Staff/Admin | Trung bình |
| UC-07 | Bật / Tắt banner | Staff/Admin | Trung bình |

---

## 3. Chi tiết Use Case

---

### UC-01: Xem danh sách banner (Public)

| | |
|---|---|
| **Actor** | Guest / Client |
| **Mục tiêu** | Frontend render banner đúng vị trí trên trang |
| **Tiền điều kiện** | Không cần đăng nhập |

**Luồng chính:**
1. `GET /api/banners` hoặc `GET /api/banners?position=HERO`
2. Query banner `isActive=true`, lọc theo `position` nếu có
3. Sắp xếp `sortOrder ASC, createdAt DESC`
4. `200`

---

### UC-02: Xem danh sách vị trí hợp lệ

| | |
|---|---|
| **Actor** | Guest / Client và Staff/Admin |
| **Mục tiêu** | Frontend biết vị trí hợp lệ để render slot; admin chọn vị trí khi tạo |

**Luồng chính:**
1. `GET /api/banners/positions`
2. Trả 4 vị trí kèm nhãn tiếng Việt (static — từ enum, không query DB)

---

### UC-03: Xem danh sách banner (Admin)

| | |
|---|---|
| **Actor** | Staff / Admin |

**Luồng chính:**
1. `GET /api/admin/banners` hoặc `?position=HERO`
2. Query tất cả banner kể cả `isActive=false`

---

### UC-04: Tạo banner mới

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Upload banner mới cho chiến dịch quảng cáo |
| **Tiền điều kiện** | STAFF+; có file ảnh sẵn sàng |
| **Hậu điều kiện** | Banner lưu DB; ảnh lên Cloudinary |

**Luồng chính:**
1. `POST /api/admin/banners` multipart với `image`, `alt`, `position`, tùy chọn `href/description/isActive/sortOrder`
2. Validate: file tồn tại, `alt` ≥ 2 ký tự, `position` hợp lệ
3. Upload ảnh lên Cloudinary folder `banners`
4. `prisma.banner.create(data)`
5. `201`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Không có file | `400 Ảnh banner là bắt buộc` |
| 2 | `alt` < 2 ký tự | `400` |
| 2 | `position` thiếu hoặc sai | `400` |
| 4 | DB fail sau upload | `catch` → destroy ảnh Cloudinary → `500` |

---

### UC-05: Cập nhật banner

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Thay ảnh hoặc sửa thông tin banner |
| **Tiền điều kiện** | Banner tồn tại |

**Luồng chính:**
1. `PUT /api/admin/banners/:id` multipart (partial)
2. Tìm banner — `404` nếu không tồn tại
3. Validate `alt`, `position` nếu gửi
4. Nếu có file ảnh mới → upload → ghi URL mới → xóa ảnh cũ nền
5. Update `data` với các trường được gửi

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `id` không tồn tại | `404` |
| 3 | `alt` gửi < 2 ký tự | `400` |
| 3 | `position` gửi sai enum | `400` |

---

### UC-06: Xóa banner

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xóa banner hết hạn chiến dịch |
| **Tiền điều kiện** | Banner tồn tại |
| **Hậu điều kiện** | Banner xóa DB; ảnh xóa Cloudinary |

**Luồng chính:**
1. `DELETE /api/admin/banners/:id`
2. Tìm banner — `404` nếu không tồn tại
3. `prisma.banner.delete(id)`
4. `destroyImage(banner.imagePublicId)` nền

> Không có guard — banner không liên kết với bảng khác.

---

### UC-07: Bật / Tắt banner

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Ẩn tạm banner không phù hợp thời điểm |

**Luồng chính:**
1. `PATCH /api/admin/banners/:id/status`
2. Đảo `isActive`
3. `200`

---

## 4. Quan hệ Use Cases

```
UC-04 Tạo ──► Banner active trong DB ──► UC-01 hiển thị theo position

UC-07 Toggle inactive ──► UC-01 ẩn banner này
UC-07 Toggle active   ──► UC-01 hiển thị lại

UC-05 Đổi ảnh ──► upload mới ──► destroy ảnh cũ (background)
UC-04 DB fail ──► destroy ảnh vừa upload (rollback trong catch)

UC-06 Xóa ──► destroy ảnh (background)
```
