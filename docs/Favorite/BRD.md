# BRD — Business Requirements Document
## Module: Favorite (Sản phẩm yêu thích)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## 1. Mục tiêu kinh doanh

Module Favorite cho phép khách hàng đánh dấu sản phẩm yêu thích để theo dõi và mua lại sau. Tính năng này tăng tỷ lệ quay lại và hỗ trợ cá nhân hóa trải nghiệm mua sắm.

---

## 2. Bối cảnh & Vấn đề

| Vấn đề | Tác động |
|---|---|
| Không lưu được sản phẩm quan tâm | Khách phải tìm lại từ đầu mỗi lần vào |
| Không có danh sách wishlist | Mất cơ hội tạo push notification khi giảm giá |
| Card sản phẩm không biết đã thích chưa | UX kém, phải click vào trang yêu thích để kiểm tra |

---

## 3. Yêu cầu kinh doanh

### BR-01: Đánh dấu yêu thích
- Khách đăng nhập bấm tim trên card sản phẩm để thêm vào danh sách yêu thích
- Gắn ở mức **Product** (không phải variant) — khách chọn sản phẩm, chưa chọn màu/dung lượng
- Thao tác phải idempotent: bấm tim 2 lần không gây lỗi

### BR-02: Bỏ yêu thích
- Khách bấm tim lần nữa để bỏ
- Thao tác phải idempotent: bỏ món chưa từng thích cũng không gây lỗi

### BR-03: Xem danh sách yêu thích
- Hiển thị đầy đủ thông tin card sản phẩm (khớp với trang listing)
- Sản phẩm admin ẩn thì không hiển thị nhưng **bản ghi vẫn giữ** trong DB
- Khi admin bật lại → khách thấy lại ngay, không cần thích lại

### BR-04: Tô trạng thái tim trên mọi card
- FE cần biết toàn bộ danh sách sản phẩm đã thích để tô tim đúng trên mọi card ngoài trang listing
- Cần API trả mảng `productId[]` đầy đủ (không phân trang)

---

## 4. Người dùng

| Actor | Vai trò |
|---|---|
| **Customer** (đăng nhập) | Toàn bộ thao tác yêu thích |
| **Guest** | Không có quyền truy cập |
| **Admin / Staff** | Không có quản lý yêu thích |

---

## 5. Ngoài phạm vi

- Admin xem danh sách yêu thích của khách
- Chia sẻ wishlist với người khác
- Thông báo khi sản phẩm yêu thích giảm giá
- Gắn yêu thích theo variant (màu/dung lượng cụ thể)

---

## 6. Định nghĩa thành công

| KPI | Mục tiêu |
|---|---|
| Tỷ lệ khách dùng tính năng | ≥ 30% khách đăng nhập |
| Tỷ lệ quay lại mua từ wishlist | ≥ 10% |
| Lỗi UX (tim sai trạng thái) | 0 |
