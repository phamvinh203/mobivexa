# BRD — Business Requirement Document
## Module: Tag (Nhãn sản phẩm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## 1. Bối cảnh kinh doanh

Tag là nhãn tự do gắn lên sản phẩm để hỗ trợ tìm kiếm và phân nhóm linh hoạt. Khác với Category (phân cấp chặt) hay Brand (một sản phẩm thuộc một thương hiệu), một sản phẩm có thể có **nhiều tag** và một tag có thể xuất hiện trên **nhiều sản phẩm** (quan hệ N:M).

Ví dụ tag: `mới nhất`, `hot`, `khuyến mãi`, `5G`, `gaming`, `pin-khủng`

Module Tag cung cấp:
- Danh sách tag để client hiển thị bộ lọc / label
- Công cụ quản lý tag đơn giản cho admin

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường |
|---|---|---|
| BG-01 | Tag giúp khách tìm sản phẩm theo đặc tính vượt qua ranh giới category/brand | Tỷ lệ sử dụng bộ lọc tag |
| BG-02 | Admin quản lý tag nhanh, không tốn công lớn | Tag tạo/xóa trong < 30 giây |
| BG-03 | Biết số sản phẩm dùng tag trước khi xóa | `_count.productTags` hiển thị trong danh sách |

---

## 3. Các bên liên quan

| Stakeholder | Kỳ vọng |
|---|---|
| **Khách hàng** | Xem tag, lọc sản phẩm theo tag |
| **Staff / Admin** | Tạo và xóa tag; xem tag nào đang được dùng nhiều |
| **Dev / System** | Xóa tag tự động gỡ khỏi sản phẩm (Cascade) — không để sản phẩm có tag lơ lửng |

---

## 4. Yêu cầu kinh doanh

### BR-01: Danh sách tag (Public & Admin)
> Tất cả đều xem được danh sách tag — không phân biệt active/inactive.
- Sắp xếp A→Z theo tên
- Trả kèm số sản phẩm đang dùng mỗi tag (`_count.productTags`)

### BR-02: Tạo tag
> Staff/Admin thêm tag mới.
- Tên unique toàn hệ thống (sau trim)
- Slug tự sinh từ tên, unique với hậu tố `-1`, `-2`...
- Tên tối thiểu 1 ký tự (khác Brand/Category tối thiểu 2)

### BR-03: Xóa tag
> Staff/Admin xóa tag không còn dùng.
- Xóa tag tự động gỡ tag khỏi tất cả sản phẩm (`onDelete: Cascade` trên `ProductTag`)
- Không có guard — không cần kiểm tra sản phẩm dùng tag trước khi xóa

---

## 5. Quy tắc kinh doanh

| ID | Quy tắc |
|---|---|
| BRU-01 | Tên tag unique toàn hệ thống (case-sensitive sau trim) → `409` nếu trùng |
| BRU-02 | Slug unique toàn hệ thống; tự thêm hậu tố nếu trùng |
| BRU-03 | Xóa tag → `ProductTag` cascade xóa theo → sản phẩm không còn tag đó |
| BRU-04 | Không có `isActive` — tag luôn hiển thị cho tất cả |
| BRU-05 | Không có chức năng update — chỉ create và delete |
| BRU-06 | Tag cực kỳ đơn giản: chỉ có `name` và `slug`, không có ảnh, mô tả, sortOrder |

---

## 6. Giả định & Ràng buộc

- Tag không phân cấp, không có cha-con
- Không có `isActive` — không thể ẩn tag (xóa thẳng nếu không cần)
- Không có endpoint update — nếu sai tên thì xóa rồi tạo lại
- Không có `createdAt`/`updatedAt` trong DB schema
- Quan hệ N:M với Product qua bảng trung gian `ProductTag`

---

## 7. Tiêu chí chấp nhận

| ID | Tiêu chí |
|---|---|
| AC-01 | `GET /tags` trả tất cả tag (không lọc active) kèm `_count.productTags` |
| AC-02 | Tạo tag trùng tên → `409` |
| AC-03 | Tên 1 ký tự được chấp nhận (min = 1) |
| AC-04 | Xóa tag → tự động gỡ khỏi tất cả sản phẩm liên kết |
| AC-05 | Slug sinh từ tên tiếng Việt: "Pin khủng" → `pin-khung` |
| AC-06 | Public và Admin dùng cùng controller `listTags` |
