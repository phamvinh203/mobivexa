# BRD — Business Requirement Document
## Module: Brand (Thương hiệu)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## 1. Bối cảnh kinh doanh

Mobivexa bán thiết bị di động và phụ kiện của nhiều thương hiệu (Apple, Samsung, Xiaomi…). Module Brand quản lý danh sách thương hiệu dùng để:
- Phân loại sản phẩm theo nhãn hiệu
- Hiển thị bộ lọc thương hiệu cho khách trên trang danh sách sản phẩm
- Trang chi tiết thương hiệu (truy cập bằng slug)

Module Brand là **danh mục phẳng** — không có cấp cha-con. Đây là điểm khác biệt chính so với Category (có cây phân cấp).

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường |
|---|---|---|
| BG-01 | Phân loại sản phẩm theo thương hiệu giúp khách tìm hàng nhanh hơn | Tỷ lệ chuyển đổi từ bộ lọc brand |
| BG-02 | Logo thương hiệu tăng nhận diện và tin tưởng | Brand trang có logo được click nhiều hơn |
| BG-03 | Admin quản lý thương hiệu độc lập, không phụ thuộc dev | 0 yêu cầu thêm/sửa brand phải qua dev |
| BG-04 | Ngăn xóa thương hiệu còn sản phẩm — bảo toàn dữ liệu | 0 lần sản phẩm mồ côi không có brand |

---

## 3. Các bên liên quan

| Stakeholder | Kỳ vọng |
|---|---|
| **Khách hàng** | Lọc sản phẩm theo thương hiệu yêu thích; xem trang brand |
| **Staff / Admin** | Tạo, sửa, ẩn/hiện thương hiệu; upload logo |
| **Dev team** | Slug tự sinh, unique, dùng được trong URL |

---

## 4. Yêu cầu kinh doanh

### BR-01: Danh sách thương hiệu công khai
> Khách hàng xem được danh sách thương hiệu đang hoạt động.
- Chỉ trả thương hiệu `isActive = true`
- Sắp xếp theo tên A→Z

### BR-02: Xem chi tiết thương hiệu theo slug
> Khách hàng truy cập trang thương hiệu qua URL `/brands/:slug`.
- Slug thân thiện với SEO, tự sinh từ tên
- Trả `404` nếu slug không tồn tại

### BR-03: Tạo thương hiệu mới
> Staff/Admin tạo thương hiệu với tên, logo, mô tả.
- Tên phải unique toàn hệ thống (không phân biệt hoa thường sau trim)
- Slug tự sinh từ tên nếu không cung cấp; tự thêm hậu tố `-1`, `-2`... nếu trùng
- Logo tùy chọn — upload lên Cloudinary

### BR-04: Cập nhật thương hiệu
> Staff/Admin sửa thông tin thương hiệu.
- Tất cả trường đều optional (partial update)
- Khi đổi logo: upload mới → xóa logo cũ ở nền

### BR-05: Xóa thương hiệu
> Staff/Admin xóa thương hiệu không còn dùng.
- **Bị chặn** nếu còn sản phẩm thuộc thương hiệu này
- Sau khi xóa: logo bị xóa khỏi Cloudinary

### BR-06: Ẩn/Hiện thương hiệu
> Staff/Admin tạm ẩn thương hiệu mà không xóa.
- Toggle `isActive` — hiện thì ẩn, ẩn thì hiện
- Thương hiệu ẩn không xuất hiện ở public API

---

## 5. Quy tắc kinh doanh

| ID | Quy tắc |
|---|---|
| BRU-01 | Tên thương hiệu unique toàn hệ thống — trùng tên trả `409` |
| BRU-02 | Slug unique toàn hệ thống — tự thêm hậu tố số nếu trùng |
| BRU-03 | Không thể xóa brand còn chứa sản phẩm — trả `409` |
| BRU-04 | Logo cũ bị xóa khỏi Cloudinary khi cập nhật logo mới (background) |
| BRU-05 | Public API chỉ trả brand `isActive = true`; Admin API trả tất cả |
| BRU-06 | `isActive` mặc định `true` khi tạo mới |
| BRU-07 | Tên brand được trim trước khi lưu và kiểm tra unique |

---

## 6. Giả định & Ràng buộc

- Cloudinary đã được cấu hình; upload lỗi → tạo brand thất bại
- Không có giới hạn số lượng thương hiệu
- Không có thư mục con / phân cấp brand (flat list)
- Logo không bắt buộc (brand có thể tồn tại không có logo)

---

## 7. Tiêu chí chấp nhận

| ID | Tiêu chí |
|---|---|
| AC-01 | `GET /brands` chỉ trả brand active, sắp A→Z |
| AC-02 | `GET /brands/:slug` trả `404` với slug không tồn tại |
| AC-03 | Tạo brand trùng tên → `409` ngay cả khi khác hoa thường sau trim |
| AC-04 | Slug tự sinh: "Apple Inc" → `apple-inc`; nếu trùng → `apple-inc-1` |
| AC-05 | Xóa brand còn sản phẩm → `409` với thông báo rõ ràng |
| AC-06 | Toggle status: brand active → inactive và ngược lại |
| AC-07 | Admin list trả tất cả brand kể cả inactive |
