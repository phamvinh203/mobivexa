# Use Case Document
## Module: Review
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## UC-01: Xem summary đánh giá sản phẩm

**Actor:** Guest / Customer  
**Trigger:** Mở trang chi tiết sản phẩm  
**Flow:**
1. GET `/api/products/:slug/reviews/summary`
2. Hệ thống tìm product theo slug
3. Chạy 3 query song song (aggregate, groupBy rating, count photos)
4. Trả về average, total, breakdown 1–5, withPhotoCount

**Exception:** Slug không tồn tại → 404

---

## UC-02: Xem danh sách đánh giá

**Actor:** Guest / Customer  
**Trigger:** Scroll đến section review hoặc lọc đánh giá  
**Flow:**
1. GET `/api/products/:slug/reviews?rating=5&hasPhoto=true&sort=helpful`
2. Hệ thống lọc chỉ APPROVED, áp filter, sort, phân trang
3. Trả danh sách kèm user (id, fullName, avatarUrl), photos, helpful count, thông tin variant đã mua

---

## UC-03: Xem danh sách chờ đánh giá

**Actor:** Customer (đã đăng nhập)  
**Trigger:** Vào trang "Đánh giá của tôi"  
**Flow:**
1. GET `/api/users/me/reviews/pending`
2. Hệ thống tìm OrderItem thuộc đơn DELIVERED, chưa có review
3. Trả danh sách kèm thông tin đơn hàng, ảnh sản phẩm

---

## UC-04: Tạo đánh giá

**Actor:** Customer  
**Precondition:** Đơn hàng đã DELIVERED; OrderItem chưa có review  
**Flow:**
1. POST `/api/order-items/:orderItemId/review` (multipart/form-data)
2. Validate orderItemId hợp lệ, thuộc user
3. Validate rating 1–5, content ≥ 10 ký tự
4. Upload ảnh lên Cloudinary (tối đa 5) song song với resolve productId
5. Tạo Review với status=APPROVED
6. Trả review mới

**Exception:**
- OrderItem không hợp lệ → 404
- Đã có review → 409

---

## UC-05: Sửa đánh giá

**Actor:** Customer (chủ review)  
**Precondition:** Review tồn tại, chưa quá 30 ngày  
**Flow:**
1. PUT `/api/reviews/:id` (multipart/form-data)
2. Validate ownership và edit window
3. Nếu có ảnh mới: xóa ảnh cũ Cloudinary async, upload ảnh mới
4. Cập nhật rating/content; reset status=APPROVED

**Exception:** Quá 30 ngày → 400

---

## UC-06: Xóa đánh giá

**Actor:** Customer (chủ review)  
**Flow:**
1. DELETE `/api/reviews/:id`
2. Xóa DB record
3. Xóa ảnh Cloudinary async

---

## UC-07: Đánh dấu helpful

**Actor:** Customer  
**Flow:**
1. POST `/api/reviews/:id/helpful`
2. Kiểm tra review tồn tại và APPROVED
3. Toggle: đã helpful → bỏ; chưa helpful → thêm
4. Trả `{ helpful, count }`

---

## UC-08: Admin xem tất cả review

**Actor:** Staff / Admin  
**Flow:**
1. GET `/api/admin/reviews?status=APPROVED&productId=...&rating=5`
2. Trả danh sách kèm thông tin user, product, ảnh, helpful count

---

## UC-09: Admin reply đánh giá

**Actor:** Staff / Admin  
**Flow:**
1. POST `/api/admin/reviews/:id/reply` với `{ content }`
2. Validate content 1–1000 ký tự
3. Ghi replyContent + repliedAt
4. Trả full review để FE replace in-place

**Exception:** Review không tồn tại → 404

---

## UC-10: Admin xóa đánh giá

**Actor:** Staff / Admin  
**Flow:**
1. DELETE `/api/admin/reviews/:id`
2. Xóa DB record + ảnh Cloudinary async

**Exception:** Review không tồn tại → 404
