# Software Requirements Specification
## Module: Review
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Kiến trúc routes

Module Review có **5 router** gắn ở các path khác nhau:

| Router | Base path | Auth |
|---|---|---|
| `reviewPublicRoutes` | `/api/products/:slug/reviews` | Public |
| `reviewUserRoutes` | `/api/users/me/reviews` | Customer+ |
| `reviewOrderItemRoutes` | `/api/order-items/:orderItemId/review` | Customer+ |
| `reviewRoutes` | `/api/reviews` | Customer+ |
| `reviewAdminRoutes` | `/api/admin/reviews` | STAFF+ |

---

## 2. Functional Requirements

### FR-01: GET /products/:slug/reviews/summary
- Tìm product theo slug (404 nếu không tồn tại)
- 3 query song song: `aggregate` (avg + count), `groupBy rating` (breakdown 1–5), `count reviewPhotos`
- Chỉ tính review có `status = APPROVED`
- Trả: `averageRating` (1 chữ số thập phân), `totalCount`, `breakdown {1:N, 2:N, 3:N, 4:N, 5:N}`, `withPhotoCount`

### FR-02: GET /products/:slug/reviews
- Query: `rating` (1–5), `hasPhoto` ('true'), `sort` ('helpful' | default 'createdAt DESC'), `page`, `limit`
- `sort=helpful` → `orderBy: { helpful: { _count: 'desc' } }`
- Chỉ trả APPROVED; phân trang

### FR-03: GET /users/me/reviews/pending
- Danh sách `OrderItem` thuộc đơn DELIVERED của user, chưa có review (`review: { is: null }`)
- Kèm `order.orderCode`, ảnh cover sản phẩm
- Không phân trang; sort theo `order.updatedAt DESC`

### FR-04: GET /users/me/reviews
- Danh sách review của user (mọi status)
- Kèm tên sản phẩm, ảnh cover, màu/storage/ram từ orderItem
- Phân trang

### FR-05: POST /order-items/:orderItemId/review
- Validate: `orderItemId` phải thuộc đơn DELIVERED của user; chưa có review (409 nếu đã có)
- Upload tối đa 5 ảnh (multipart `photos[]`) lên Cloudinary song song với resolve productId
- `content` trim; `content.length` >= 10; `rating` 1–5
- `status = APPROVED` (hardcoded)
- `variantId` từ orderItem; nếu null → fallback tra theo SKU → theo tên sản phẩm

### FR-06: PUT /reviews/:id
- Chỉ sửa được review của chính mình (404 nếu không phải)
- Hạn 30 ngày (`EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000`)
- `rating` và `content` đều optional (cần ít nhất 1)
- Nếu có ảnh mới: xóa ảnh cũ Cloudinary async, upload ảnh mới, `deleteMany` + `create` trong transaction
- `status` reset về `APPROVED` khi update

### FR-07: DELETE /reviews/:id
- Chỉ xóa review của chính mình
- Xóa ảnh Cloudinary async sau khi xóa DB record

### FR-08: POST /reviews/:id/helpful
- Kiểm tra review tồn tại và `status = APPROVED` (404 nếu không)
- Toggle: nếu đã helpful → xóa; chưa helpful → thêm
- Trả: `{ helpful: boolean, count: number }`

### FR-09: GET /admin/reviews
- Query: `status` (PENDING|APPROVED), `productId`, `rating`, `page`, `limit`
- Include `REVIEW_ADMIN_INCLUDE`: user (id, fullName, email), product (id, name, slug), photos, `_count.helpful`
- Sort: `createdAt DESC`

### FR-10: POST /admin/reviews/:id/reply
- `content` 1–1000 ký tự
- Ghi `replyContent = content.trim()`, `repliedAt = now()`
- P2025 → 404
- Trả full review (cùng `REVIEW_ADMIN_INCLUDE`) để FE replace in-place

### FR-11: DELETE /admin/reviews/:id
- Tìm review kèm photos; 404 nếu không tồn tại
- Xóa DB, xóa Cloudinary async

---

## 3. Validation

| Validator | Điều kiện |
|---|---|
| `validateCreateReview` | `rating` int 1–5 (từ form-data string); `content` required, 10–2000 ký tự |
| `validateUpdateReview` | Ít nhất 1 field; `rating` 1–5; `content` 10–2000 |
| `validateReplyReview` | `content` required, 1–1000 ký tự |

---

## 4. Constants

| Hằng | Giá trị |
|---|---|
| `EDIT_WINDOW_MS` | `30 * 24 * 60 * 60 * 1000` (30 ngày) |
| `MAX_PHOTOS` | `5` |
| Upload folder | `'reviews'` (Cloudinary) |
| Content min (review) | 10 ký tự |
| Content max (review) | 2000 ký tự |
| Content min (reply) | 1 ký tự |
| Content max (reply) | 1000 ký tự |
