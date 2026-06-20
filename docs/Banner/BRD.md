# BRD — Business Requirement Document
## Module: Banner (Quảng cáo / Banner trang chủ)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## 1. Bối cảnh kinh doanh

Banner là ảnh quảng cáo hiển thị trên giao diện website, dùng để:
- Quảng bá chương trình khuyến mãi, sản phẩm mới
- Điều hướng khách đến trang đích (`href`)
- Trang trí giao diện theo vị trí bố cục (hero, sidebar, horizontal)

Khác với Category/Brand (dữ liệu danh mục), Banner là **nội dung marketing** — thay đổi thường xuyên theo chiến dịch.

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường |
|---|---|---|
| BG-01 | Quảng bá khuyến mãi qua banner trang chủ | CTR (click-through rate) banner |
| BG-02 | Admin tự cập nhật banner không qua dev | 0 yêu cầu thay ảnh phải qua dev |
| BG-03 | Hiển thị đúng banner theo vị trí bố cục trang | Client lọc đúng theo `position` |
| BG-04 | Kiểm soát thứ tự hiển thị banner tại cùng vị trí | `sortOrder` xác định banner nào lên trước |

---

## 3. Các bên liên quan

| Stakeholder | Kỳ vọng |
|---|---|
| **Khách hàng** | Xem banner đúng vị trí, click vào link đích |
| **Staff / Admin** | Upload ảnh mới, đặt vị trí, bật/tắt, sắp thứ tự |
| **Frontend Dev** | Endpoint lọc banner theo `position`, lấy danh sách vị trí hợp lệ |

---

## 4. Yêu cầu kinh doanh

### BR-01: Danh sách banner (Public)
> Khách hàng và frontend xem banner đang active.
- Chỉ trả `isActive = true`
- Hỗ trợ lọc theo `position` qua query param
- Sắp xếp `sortOrder ASC, createdAt DESC`

### BR-02: Danh sách vị trí banner
> Frontend cần biết các vị trí hợp lệ để render đúng slot.
- Trả danh sách enum `BannerPosition` kèm nhãn tiếng Việt
- Endpoint dùng chung Public và Admin

### BR-03: Tạo banner
> Staff/Admin upload banner mới vào vị trí chỉ định.
- **Ảnh bắt buộc** (khác Brand/Category — ảnh optional)
- **Vị trí bắt buộc** (`position`: HERO | LEFT | RIGHT | HORIZONTAL)
- **Alt text bắt buộc** (≥ 2 ký tự — phục vụ SEO và accessibility)
- `href` tùy chọn — mặc định `/products` nếu không gửi
- Nếu DB lỗi sau khi đã upload ảnh → tự động xóa ảnh khỏi Cloudinary (rollback)

### BR-04: Cập nhật banner
> Staff/Admin sửa thông tin hoặc đổi ảnh.
- Partial update — tất cả trường optional
- Đổi ảnh → upload mới → xóa ảnh cũ nền

### BR-05: Xóa banner
> Staff/Admin xóa banner không còn dùng.
- Xóa ảnh khỏi Cloudinary ngay sau khi xóa DB

### BR-06: Ẩn/Hiện banner
> Staff/Admin tạm ẩn banner mà không xóa.
- Toggle `isActive`

---

## 5. Quy tắc kinh doanh

| ID | Quy tắc |
|---|---|
| BRU-01 | **Ảnh bắt buộc khi tạo** — `400` nếu không có file |
| BRU-02 | **`position` bắt buộc khi tạo** — phải là một trong 4 giá trị enum |
| BRU-03 | **`alt` bắt buộc** — ≥ 2 ký tự (SEO + accessibility) |
| BRU-04 | `href` mặc định `/products` nếu không gửi hoặc gửi rỗng |
| BRU-05 | Rollback Cloudinary nếu DB create thất bại — tránh ảnh mồ côi |
| BRU-06 | Ảnh cũ xóa nền sau khi upload ảnh mới thành công |
| BRU-07 | Public API chỉ trả `isActive = true`; Admin trả tất cả |
| BRU-08 | Sắp xếp: `sortOrder ASC → createdAt DESC` |
| BRU-09 | Không có giới hạn số banner tại mỗi vị trí |
| BRU-10 | Không có slug — banner không có URL riêng, truy cập qua ID |

---

## 6. Vị trí Banner (BannerPosition enum)

| Giá trị | Nhãn | Mô tả |
|---|---|---|
| `HERO` | Banner chính (full-width đầu trang) | Slider / hero banner lớn nhất |
| `LEFT` | Banner bên trái | Sidebar trái |
| `RIGHT` | Banner bên phải | Sidebar phải |
| `HORIZONTAL` | Banner ngang dài | Dải ngang giữa trang |

---

## 7. Tiêu chí chấp nhận

| ID | Tiêu chí |
|---|---|
| AC-01 | `GET /banners?position=HERO` trả đúng banner HERO active |
| AC-02 | `GET /banners/positions` trả 4 vị trí kèm nhãn tiếng Việt |
| AC-03 | Tạo không có file ảnh → `400` |
| AC-04 | Tạo không có `position` → `400` |
| AC-05 | `position` sai enum → `400` |
| AC-06 | `href` không gửi → mặc định `/products` |
| AC-07 | DB fail sau upload ảnh → ảnh bị xóa Cloudinary (rollback) |
| AC-08 | `sortOrder` 0 hiển thị trước `sortOrder` 1 cùng vị trí |
