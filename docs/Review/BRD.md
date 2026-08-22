# Business Requirements Document
## Module: Review
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Mục tiêu nghiệp vụ

Cho phép khách hàng đánh giá sản phẩm đã mua, tương tác với đánh giá của người khác, và cung cấp công cụ cho Staff quản lý nội dung đánh giá.

---

## 2. Actors

| Actor | Mô tả |
|---|---|
| **Guest** | Xem summary và danh sách đánh giá (chỉ APPROVED) |
| **Customer** | Đánh giá sau khi đơn DELIVERED; sửa/xóa trong 30 ngày; đánh dấu helpful |
| **Staff / Admin** | Xem tất cả review (mọi status); reply; xóa |

---

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-01 | Chỉ đánh giá được `OrderItem` thuộc đơn có `status = DELIVERED` |
| BR-02 | Mỗi `OrderItem` chỉ có **1** đánh giá (`orderItemId UNIQUE`) |
| BR-03 | Review mới được tạo với `status = APPROVED` ngay lập tức (không qua duyệt thủ công) |
| BR-04 | Chỉ đánh giá có `status = APPROVED` hiển thị trên trang công khai và summary |
| BR-05 | Edit window: **30 ngày** kể từ `createdAt`; quá hạn → 400 |
| BR-06 | Khi update có ảnh mới → xóa toàn bộ ảnh cũ, thay bằng ảnh mới (tối đa 5) |
| BR-07 | `toggleHelpful` idempotent: gọi lần 2 bỏ helpful; trả về trạng thái hiện tại |
| BR-08 | `getPendingReviews`: danh sách `OrderItem` DELIVERED chưa có review |
| BR-09 | Ảnh upload lên Cloudinary folder `reviews`; xóa review → xóa ảnh Cloudinary async (fire-and-forget) |
| BR-10 | Admin chỉ có reply và delete; **không** có approve/reject route |

---

## 4. Phạm vi module

**Trong phạm vi:**
- Xem summary + danh sách review theo slug sản phẩm (public)
- Tạo / sửa / xóa review của chính mình + upload ảnh
- Helpful toggle
- Danh sách chờ đánh giá (pending reviews)
- Admin: list all, reply, delete

**Ngoài phạm vi:**
- Admin approve/reject (status tự động APPROVED khi tạo)
- Notification khi có reply
- Export danh sách review
