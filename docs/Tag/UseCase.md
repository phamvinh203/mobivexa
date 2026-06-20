# Use Case Document
## Module: Tag
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Guest / Customer** | Xem danh sách tag, không cần đăng nhập |
| **Staff / Admin** | Tạo và xóa tag (STAFF hoặc ADMIN role) |
| **PostgreSQL** | Tự động cascade xóa `ProductTag` khi Tag bị xóa |

---

## 2. Danh sách Use Case

| ID | Tên | Actor | Ưu tiên |
|---|---|---|---|
| UC-01 | Xem danh sách tag | Guest/Customer | Cao |
| UC-02 | Tạo tag mới | Staff/Admin | Cao |
| UC-03 | Xóa tag | Staff/Admin | Trung bình |

> **Không có:** UC update tag, toggle status, upload ảnh.

---

## 3. Chi tiết Use Case

---

### UC-01: Xem danh sách tag

| | |
|---|---|
| **Actor** | Guest / Customer (và cả Admin) |
| **Mục tiêu** | Hiển thị bộ lọc tag / danh sách tag trên UI |
| **Tiền điều kiện** | Không cần đăng nhập |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. Client gọi `GET /api/tags` (public) hoặc `GET /api/admin/tags` (admin)
2. Hệ thống query tất cả tag, sắp A→Z, kèm `_count.productTags`
3. Trả về danh sách

**Đặc điểm:**
- Không lọc active/inactive — tất cả tag đều trả về
- Kèm số sản phẩm đang dùng mỗi tag
- Public và Admin dùng cùng controller `listTags`

---

### UC-02: Tạo tag mới

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Thêm tag để có thể gắn vào sản phẩm |
| **Tiền điều kiện** | Đã đăng nhập STAFF+ |
| **Hậu điều kiện** | Tag mới tạo trong DB |

**Luồng chính:**
1. `POST /api/admin/tags` với `{ name, slug? }`
2. Validate `name` ≥ 1 ký tự
3. Trim name → kiểm tra unique
4. Sinh slug unique từ `slug` (nếu gửi) hoặc `name`
5. Tạo tag → `201`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `name` rỗng hoặc thiếu | `400` `Tên tag phải có ít nhất 1 ký tự` |
| 3 | `name` đã tồn tại | `409` `Tag đã tồn tại` |

---

### UC-03: Xóa tag

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Xóa tag không còn cần thiết |
| **Tiền điều kiện** | Tag tồn tại |
| **Hậu điều kiện** | Tag xóa khỏi DB; tất cả liên kết `ProductTag` bị cascade xóa |

**Luồng chính:**
1. `DELETE /api/admin/tags/:id`
2. Tìm tag — `404` nếu không tồn tại
3. `prisma.tag.delete(id)` → DB cascade xóa `ProductTag`
4. `200`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `id` không tồn tại | `404` `Tag không tồn tại` |

> **Không bị chặn bởi sản phẩm:** Admin có thể xóa tag dù đang được gắn vào nhiều sản phẩm. `onDelete: Cascade` đảm bảo sản phẩm không bị ảnh hưởng — chỉ mất liên kết với tag đó.

---

## 4. Quan hệ Use Cases

```
UC-02 Tạo tag ──► Tag trong DB ──► UC-01 hiển thị

Tag N:M Product (qua ProductTag)

UC-03 Xóa tag ──► DB CASCADE ──► ProductTag records bị xóa
              └──► Sản phẩm vẫn tồn tại, chỉ mất tag đó

UC-01 List ──► _count.productTags cho thấy tag nào đang được dùng
          └──► Admin đọc trước khi quyết định UC-03
```

---

## 5. So sánh với Brand và Category

| Tiêu chí | Tag | Brand | Category |
|---|---|---|---|
| Có update | ❌ | ✅ (PUT) | ✅ (PUT) |
| Có toggle status | ❌ | ✅ | ✅ |
| Có ảnh | ❌ | ✅ (logo) | ✅ (image) |
| Guard khi xóa | ❌ (Cascade) | ✅ (product count) | ✅ (child + product) |
| Public endpoint | GET list | GET list + GET slug | GET list + GET slug |
| Tên unique | ✅ | ✅ | ❌ |
| Có `isActive` | ❌ | ✅ | ✅ |
| Có `createdAt` | ❌ | ✅ | ✅ |
