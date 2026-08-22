# Business Requirements Document
## Module: Product
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Mục tiêu nghiệp vụ

Cung cấp catalog sản phẩm với đầy đủ thông tin để khách hàng tìm kiếm, lọc và xem chi tiết; đồng thời cung cấp bộ công cụ quản trị đầy đủ cho STAFF/ADMIN: tạo/sửa/xóa sản phẩm, quản lý phiên bản (variant), ảnh, thông số kỹ thuật, và báo cáo tồn kho.

---

## 2. Actors

| Actor | Mô tả |
|---|---|
| **Guest / Customer** | Xem danh sách, tìm kiếm, xem chi tiết, sản phẩm nổi bật |
| **Staff / Admin** | Toàn quyền CRUD sản phẩm, variant, ảnh, specs, tồn kho |

---

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-01 | Public chỉ thấy sản phẩm `isActive = true`; admin thấy tất cả |
| BR-02 | Public chỉ thấy variant `isActive = true`; admin thấy tất cả variant |
| BR-03 | Slug phải unique toàn hệ thống; có thể tự sinh từ `name` nếu không truyền |
| BR-04 | Slug rỗng trong `updateProduct` → sinh lại từ `name` |
| BR-05 | SKU phải unique toàn hệ thống (không trùng trong payload lẫn trong DB) |
| BR-06 | `originalPrice > 0` (integer); `salePrice >= 0` (integer); `salePrice <= originalPrice` |
| BR-07 | Giá phải là số nguyên (VND không có đơn vị nhỏ hơn đồng) — số lẻ gây lỗi VietQR |
| BR-08 | Sản phẩm phải có ít nhất 1 variant khi tạo; không thể xóa variant cuối cùng |
| BR-09 | Ảnh đầu tiên khi tạo sản phẩm → `isCover = true` |
| BR-10 | Xóa ảnh cover → tự động set ảnh đầu tiên còn lại làm cover |
| BR-11 | `updateVariantStock` có `expectedStock`: nếu tồn kho đã thay đổi → 409 (optimistic lock) |
| BR-12 | `replaceProductSpecs`: thay TOÀN BỘ mảng thông số trong 1 transaction; mảng rỗng = xóa sạch |
| BR-13 | Tìm kiếm dùng PostgreSQL GIN full-text search (`to_tsvector / to_tsquery`) trên cột `name` |
| BR-14 | Lọc giá: `minPrice > maxPrice` → 400; `minPrice`/`maxPrice` không phải số → 400 |
| BR-15 | `description` chứa HTML từ RichTextEditor — không trả trong listing, chỉ trả ở detail |
| BR-16 | Inventory summary cache in-memory 60 giây, phân biệt theo `lowThreshold` |
| BR-17 | `deleteProduct`: lấy publicId ảnh TRƯỚC khi xóa; xóa Cloudinary async (fire-and-forget) |
| BR-18 | Ảnh upload qua Multer (multipart/form-data); tối đa 10 file/request |
| BR-19 | Admin listing dùng `omit: { description }` để tránh payload MB |
| BR-20 | Category hỗ trợ cây phân cấp self-referencing (`parentId`) |

---

## 4. Sort options (public)

| Giá trị `sort` | Hành vi |
|---|---|
| *(default / newest)* | `createdAt DESC` |
| `oldest` | `createdAt ASC` |
| `name_asc` | `name ASC` |
| `name_desc` | `name DESC` |

---

## 5. Inventory thresholds

| Trạng thái | Điều kiện |
|---|---|
| `out_of_stock` | `stock = 0` |
| `low_stock` | `0 < stock <= lowThreshold` (default 5) |
| `in_stock` | `stock > lowThreshold` |

---

## 6. Phạm vi module

**Trong phạm vi:**
- Listing + tìm kiếm + lọc sản phẩm (public)
- Chi tiết sản phẩm, sản phẩm nổi bật (public)
- CRUD sản phẩm, variant, ảnh, specs (admin)
- Toggle `isActive` / `isFeatured` (admin)
- Báo cáo tồn kho (admin)

**Ngoài phạm vi:**
- Review / đánh giá → module Review
- Giỏ hàng → module Cart
- Yêu thích (`Favorite`) → chưa có routes
