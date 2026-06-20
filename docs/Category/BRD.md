# BRD — Business Requirement Document
## Module: Category (Danh mục sản phẩm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## 1. Bối cảnh kinh doanh

Mobivexa tổ chức sản phẩm theo danh mục phân cấp (cha–con). Ví dụ:
- **Điện thoại** → iPhone, Samsung Galaxy, Xiaomi
- **Phụ kiện** → Ốp lưng, Sạc, Tai nghe

Module Category quản lý cây danh mục dùng để:
- Điều hướng duyệt hàng (breadcrumb, menu điều hướng)
- Bộ lọc sản phẩm theo danh mục
- SEO URL thân thiện theo slug

Khác với Brand (danh sách phẳng), Category hỗ trợ **cấu trúc cây 2 cấp** (cha → con), có thứ tự hiển thị (`sortOrder`) và ảnh đại diện.

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường |
|---|---|---|
| BG-01 | Khách hàng tìm sản phẩm theo danh mục phân cấp | Tỷ lệ điều hướng từ menu danh mục |
| BG-02 | Admin tự quản lý danh mục, kiểm soát thứ tự hiển thị | 0 yêu cầu sắp xếp danh mục phải qua dev |
| BG-03 | Bảo toàn dữ liệu: không xóa danh mục còn con hoặc sản phẩm | 0 sản phẩm mồ côi không có danh mục |
| BG-04 | SEO tốt qua slug tiếng Việt, tự sinh, unique | Slug ổn định sau khi tạo |

---

## 3. Các bên liên quan

| Stakeholder | Kỳ vọng |
|---|---|
| **Khách hàng** | Duyệt sản phẩm qua menu/bộ lọc; xem trang danh mục (có cả sub-categories) |
| **Staff / Admin** | Tạo cây danh mục, sắp xếp thứ tự, upload ảnh, ẩn/hiện |
| **Dev team** | Slug tự sinh từ tên VN; không vi phạm circular reference |

---

## 4. Yêu cầu kinh doanh

### BR-01: Danh sách danh mục công khai
> Khách hàng xem danh sách danh mục đang hoạt động.
- Chỉ trả `isActive = true`
- Sắp xếp theo `sortOrder ASC, name ASC`

### BR-02: Xem chi tiết danh mục theo slug
> Khách hàng truy cập trang danh mục qua URL `/categories/:slug`.
- Trả cả danh mục con (`children`) đang active
- `404` nếu slug không tồn tại

### BR-03: Tạo danh mục mới
> Staff/Admin thêm danh mục.
- Slug tự sinh từ tên; unique với hậu tố `-1`, `-2`...
- `parentId` tùy chọn — nếu có phải là category hợp lệ
- Không thể chỉ định chính mình làm cha
- Ảnh tùy chọn

### BR-04: Cập nhật danh mục
> Staff/Admin sửa thông tin.
- Partial update — tất cả trường optional
- Không thể đặt cha thành chính mình
- Đổi ảnh → upload mới → xóa cũ nền

### BR-05: Xóa danh mục
> Staff/Admin xóa danh mục không dùng.
- Bị chặn nếu còn **danh mục con**
- Bị chặn nếu còn **sản phẩm**
- Hai điều kiện kiểm tra song song (`Promise.all`)

### BR-06: Ẩn/Hiện danh mục
> Staff/Admin tạm ẩn danh mục.
- Toggle `isActive`; danh mục ẩn không xuất hiện ở public API

---

## 5. Quy tắc kinh doanh

| ID | Quy tắc |
|---|---|
| BRU-01 | Slug unique toàn hệ thống; tự thêm hậu tố nếu trùng |
| BRU-02 | `parentId` phải là category tồn tại — `400` nếu không |
| BRU-03 | Category không thể là cha của chính nó — `400` |
| BRU-04 | Không thể xóa category còn con → `409` |
| BRU-05 | Không thể xóa category còn sản phẩm → `409` |
| BRU-06 | Ảnh cũ xóa Cloudinary nền khi upload ảnh mới |
| BRU-07 | Public API chỉ trả `isActive = true`; Admin API trả tất cả |
| BRU-08 | Sắp xếp: `sortOrder ASC` → `name ASC`; `sortOrder` mặc định `0` |
| BRU-09 | Tên category **không** yêu cầu unique (khác Brand) — nhiều category cùng tên được |

---

## 6. Giả định & Ràng buộc

- Chỉ hỗ trợ 2 cấp (cha và con) — không có cháu
- Không có `onDelete: Cascade` ở DB — kiểm tra thủ công trước khi xóa
- Ảnh không bắt buộc (category có thể không có ảnh)
- Tên không cần unique — hai danh mục có thể có cùng tên nhưng slug khác nhau

---

## 7. Tiêu chí chấp nhận

| ID | Tiêu chí |
|---|---|
| AC-01 | `GET /categories` chỉ trả active, sắp xếp đúng `sortOrder` |
| AC-02 | `GET /categories/:slug` trả cả `children` active |
| AC-03 | Tạo category với `parentId` không tồn tại → `400` |
| AC-04 | Tạo category với `parentId = chính mình` → `400` |
| AC-05 | Xóa category còn con → `409` |
| AC-06 | Xóa category còn sản phẩm → `409` |
| AC-07 | `sortOrder` mặc định `0` khi không gửi |
| AC-08 | Slug "Điện thoại" → `dien-thoai`; trùng → `dien-thoai-1` |
