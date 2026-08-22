# Test Case Document
## Module: Review
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| Summary | 3 |
| List reviews (public) | 4 |
| Pending reviews | 2 |
| Tạo review | 6 |
| Sửa review | 5 |
| Xóa review | 2 |
| Helpful | 4 |
| Admin list | 3 |
| Admin reply | 4 |
| Admin delete | 2 |
| **Tổng** | **35** |

---

## TC-SUMMARY: Xem summary

### TC-SUMMARY-01: Trả đủ 4 trường

**Input:** `GET /api/products/iphone-15-pro/reviews/summary`  
**Expected:** `averageRating` (number), `totalCount` (number), `breakdown` ({1–5}), `withPhotoCount` (number)

---

### TC-SUMMARY-02: Chỉ đếm review APPROVED

**Precondition:** Có 3 APPROVED và 2 PENDING cho sản phẩm  
**Expected:** `totalCount === 3`

---

### TC-SUMMARY-03: Slug không tồn tại → 404

**Input:** `GET /api/products/san-pham-ao/reviews/summary`  
**Expected:** `404`

---

## TC-LIST: Danh sách review (public)

### TC-LIST-01: Chỉ trả APPROVED

**Precondition:** Có review PENDING trong DB  
**Expected:** Response không chứa review có `status !== APPROVED`

---

### TC-LIST-02: Lọc rating

**Input:** `?rating=5`  
**Expected:** Tất cả review có `rating === 5`

---

### TC-LIST-03: Lọc hasPhoto=true

**Input:** `?hasPhoto=true`  
**Expected:** Tất cả review có `photos.length > 0`

---

### TC-LIST-04: Sort helpful

**Input:** `?sort=helpful`  
**Expected:** Review đầu tiên có `_count.helpful` >= review thứ hai

---

## TC-PENDING: Danh sách chờ review

### TC-PENDING-01: Chỉ trả OrderItem chưa có review

**Precondition:** 2 OrderItem từ đơn DELIVERED; 1 đã review, 1 chưa  
**Expected:** Response chỉ chứa item chưa review

---

### TC-PENDING-02: Đơn chưa DELIVERED không xuất hiện

**Precondition:** OrderItem từ đơn `PROCESSING`  
**Expected:** Không có trong danh sách pending

---

## TC-CREATE: Tạo review

### TC-CREATE-01: Tạo thành công → status APPROVED

**Input:** POST với rating=5, content="Sản phẩm rất tốt, đáng mua"  
**Expected:** `201`, response.status === 'APPROVED'

---

### TC-CREATE-02: OrderItem không thuộc user → 404

**Input:** orderItemId của user khác  
**Expected:** `404`

---

### TC-CREATE-03: Đơn chưa DELIVERED → 404

**Expected:** `404`

---

### TC-CREATE-04: Đã có review → 409

**Precondition:** OrderItem đã được review rồi  
**Expected:** `409`

---

### TC-CREATE-05: content < 10 ký tự → 400

**Input:** content = "Tốt"  
**Expected:** `400`

---

### TC-CREATE-06: rating ngoài 1-5 → 400

**Input:** rating = 6  
**Expected:** `400`

---

## TC-UPDATE: Sửa review

### TC-UPDATE-01: Sửa trong 30 ngày thành công

**Precondition:** Review tạo 1 ngày trước  
**Input:** PUT với content mới  
**Expected:** `200`, content đã thay đổi, status = APPROVED

---

### TC-UPDATE-02: Quá 30 ngày → 400

**Precondition:** Review tạo 31 ngày trước  
**Expected:** `400 Đã quá 30 ngày, không thể chỉnh sửa đánh giá`

---

### TC-UPDATE-03: Review không phải của user → 404

**Input:** reviewId của user khác  
**Expected:** `404`

---

### TC-UPDATE-04: Không có field nào → 400

**Input:** body rỗng  
**Expected:** `400 Không có gì để cập nhật`

---

### TC-UPDATE-05: Có ảnh mới → ảnh cũ bị thay

**Precondition:** Review có 2 ảnh cũ  
**Input:** 1 ảnh mới  
**Expected:** Response có đúng 1 ảnh (ảnh cũ đã xóa)

---

## TC-DELETE: Xóa review

### TC-DELETE-01: Xóa review của mình thành công

**Expected:** `200`; review không còn trong DB

---

### TC-DELETE-02: Xóa review của người khác → 404

**Expected:** `404`

---

## TC-HELPFUL: Helpful toggle

### TC-HELPFUL-01: Toggle lần đầu → helpful=true

**Expected:** `{ helpful: true, count: 1 }`

---

### TC-HELPFUL-02: Toggle lần hai → helpful=false (bỏ)

**Action:** Gọi 2 lần liên tiếp  
**Expected lần 2:** `{ helpful: false, count: 0 }`

---

### TC-HELPFUL-03: Review không tồn tại → 404

**Expected:** `404`

---

### TC-HELPFUL-04: Review PENDING → 404

**Precondition:** Review có status=PENDING (chỉnh DB tay)  
**Expected:** `404`

---

## TC-ADMIN-LIST: Admin xem review

### TC-ADMIN-LIST-01: CUSTOMER không có quyền → 403

**Expected:** `403`

---

### TC-ADMIN-LIST-02: Lọc status=PENDING

**Expected:** Tất cả review trong response có `status === 'PENDING'`

---

### TC-ADMIN-LIST-03: Trả include user, product, photos, _count.helpful

**Expected:** Response chứa `user.email`, `product.slug`, `photos`, `_count.helpful`

---

## TC-ADMIN-REPLY: Admin reply

### TC-ADMIN-REPLY-01: Reply thành công

**Input:** POST `/admin/reviews/:id/reply` với content 1-1000 ký tự  
**Expected:** `200`, response.replyContent === content, response.repliedAt != null

---

### TC-ADMIN-REPLY-02: Review không tồn tại → 404

**Expected:** `404`

---

### TC-ADMIN-REPLY-03: content rỗng → 400

**Input:** content = ""  
**Expected:** `400`

---

### TC-ADMIN-REPLY-04: content > 1000 ký tự → 400

**Expected:** `400`

---

## TC-ADMIN-DELETE: Admin xóa review

### TC-ADMIN-DELETE-01: Xóa thành công

**Expected:** `200`; review không còn trong DB

---

### TC-ADMIN-DELETE-02: Review không tồn tại → 404

**Expected:** `404`

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Status APPROVED khi tạo | TC-CREATE-01 |
| Chỉ DELIVERED mới review được | TC-CREATE-03, TC-PENDING-02 |
| 1 review / OrderItem | TC-CREATE-04 |
| Edit window 30 ngày | TC-UPDATE-01, TC-UPDATE-02 |
| Ảnh mới thay toàn bộ ảnh cũ | TC-UPDATE-05 |
| Helpful idempotent | TC-HELPFUL-02 |
| Helpful chỉ cho APPROVED | TC-HELPFUL-04 |
| Admin không có status toggle | (route không tồn tại) |
| Admin reply trả full entity | TC-ADMIN-REPLY-01 |
