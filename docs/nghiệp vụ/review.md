# Nghiệp vụ Review (Đánh giá sản phẩm) — Mobivexa

> **Phạm vi:** `src/services/review.service.ts`, `src/controllers/review.controller.ts`, `src/routes/review.route.ts`, `src/validators/review.validator.ts`, `src/types/review.type.ts`
>
> **Cập nhật:** 2026-06-19
>
> **Xem thêm:** [order.md](./order.md) — Chỉ đơn hàng `DELIVERED` mới được đánh giá.

---

## 1. Tổng quan

Module Review cho phép khách hàng **đánh giá sản phẩm sau khi đơn hàng được giao thành công**. Mỗi `OrderItem` chỉ được đánh giá đúng **1 lần** và được ràng buộc trực tiếp vào `OrderItem` cụ thể thay vì vào sản phẩm chung — đảm bảo chỉ người đã mua mới được viết đánh giá.

**4 nhóm route:**
- **Public** — không cần đăng nhập: xem đánh giá & tóm tắt theo sản phẩm
- **User (me)** — đăng nhập: xem danh sách đánh giá cá nhân + chờ đánh giá
- **User (action)** — đăng nhập: tạo, sửa, xóa, đánh dấu helpful
- **Admin** — STAFF+: quản trị toàn bộ đánh giá, phản hồi, xóa

---

## 2. Danh sách endpoint

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/api/products/:slug/reviews/summary` | Tóm tắt đánh giá (avg, breakdown, photo count) | ❌ Public |
| `GET` | `/api/products/:slug/reviews` | Danh sách đánh giá đã duyệt của sản phẩm | ❌ Public |
| `GET` | `/api/users/me/reviews/pending` | Danh sách sản phẩm chờ đánh giá của user | ✅ User |
| `GET` | `/api/users/me/reviews` | Danh sách đánh giá đã viết của user | ✅ User |
| `POST` | `/api/order-items/:orderItemId/review` | Tạo đánh giá cho 1 order item | ✅ User |
| `PUT` | `/api/reviews/:id` | Sửa đánh giá (trong vòng 30 ngày) | ✅ User (chủ sở hữu) |
| `DELETE` | `/api/reviews/:id` | Xóa đánh giá | ✅ User (chủ sở hữu) |
| `POST` | `/api/reviews/:id/helpful` | Toggle "Đánh giá hữu ích" | ✅ User |
| `GET` | `/api/admin/reviews` | Lọc/tìm đánh giá (admin) | ✅ STAFF+ |
| `POST` | `/api/admin/reviews/:id/reply` | Phản hồi đánh giá | ✅ STAFF+ |
| `DELETE` | `/api/admin/reviews/:id` | Xóa đánh giá (admin) | ✅ STAFF+ |

---

## 3. Chính sách & Ràng buộc nghiệp vụ

### 3.1 Điều kiện được phép viết đánh giá

| Điều kiện | Quy tắc |
|---|---|
| Đơn hàng phải ở trạng thái | `DELIVERED` |
| Chủ đơn hàng | `order.userId === userId` đang đăng nhập |
| Mỗi `OrderItem` | Chỉ được đánh giá **1 lần duy nhất** |

> Không có whitelist sản phẩm hay hạn thời gian sau giao hàng — chỉ cần đơn `DELIVERED` và chưa có đánh giá.

### 3.2 Nội dung đánh giá

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| `rating` | ✅ | Số nguyên từ **1 đến 5** |
| `content` | ✅ | Chuỗi ký tự, min **10 ký tự**, max **2000 ký tự** (sau trim) |
| `photos` | ❌ | Tối đa **5 ảnh**; JPG/PNG/WebP, max 5MB mỗi ảnh |

### 3.3 Thời hạn chỉnh sửa

- User có thể sửa đánh giá trong vòng **30 ngày** kể từ ngày tạo
- Sau 30 ngày → `400` `Đã quá 30 ngày, không thể chỉnh sửa đánh giá`

### 3.4 Trạng thái đánh giá (`ReviewStatus`)

| Giá trị | Mô tả |
|---|---|
| `APPROVED` | Hiển thị công khai — **tất cả đánh giá mới tạo và sau khi sửa đều tự động `APPROVED`** |
| `PENDING` | Chờ duyệt — hiện không được set qua luồng thông thường (có trong enum nhưng không có endpoint set) |
| `REJECTED` | Bị từ chối — tương tự PENDING |

> **Thiết kế hiện tại:** Không có bước kiểm duyệt — mọi đánh giá tạo mới và cập nhật đều ngay lập tức `APPROVED`. Enum `PENDING`/`REJECTED` tồn tại trong schema nhưng chưa được dùng trong luồng nghiệp vụ.

### 3.5 Ảnh đánh giá

| Quy tắc | Giá trị |
|---|---|
| Tối đa | 5 ảnh / đánh giá |
| Lưu trữ | Cloudinary, folder `reviews` |
| Khi **tạo** | Upload song song với resolve `productId`; nếu upload thành công nhưng DB lỗi → ảnh mồ côi (không có rollback như Banner) |
| Khi **sửa** | Upload ảnh mới → **xóa toàn bộ ảnh cũ** ở nền → thay thế bằng ảnh mới; không merge |
| Khi **xóa review** | Xóa DB → xóa tất cả ảnh ở nền |
| Thứ tự | Theo `sortOrder` (index thứ tự upload) |

### 3.6 "Helpful" (Hữu ích)

- Mỗi user vote **1 lần** cho 1 đánh giá (unique constraint `(userId, reviewId)`)
- Gọi lại endpoint → **toggle**: nếu đã vote thì bỏ vote, chưa vote thì thêm
- Chỉ vote được đánh giá có `status = APPROVED`
- Response trả `{ helpful: boolean, count: number }` — `helpful: true` = vừa vote, `false` = vừa bỏ vote

### 3.7 Phản hồi admin (`replyContent`)

- Chỉ có 1 phản hồi duy nhất per review (không phải thread)
- Phản hồi mới sẽ ghi đè phản hồi cũ
- `content`: min 1 ký tự, max 1000 ký tự
- Lưu `replyContent` + `repliedAt = new Date()`

---

## 4. Luồng nghiệp vụ chi tiết

### 4.1 Xem tóm tắt đánh giá sản phẩm (Public)

```
GET /api/products/:slug/reviews/summary → getReviewSummary → DB (3 query song song) → Response
```

Chạy 3 aggregation song song:
1. `aggregate` → `averageRating` (làm tròn 1 chữ số thập phân) + `totalCount`
2. `groupBy rating` → `breakdown` (số đánh giá theo từng mức sao 1–5)
3. `count(reviewPhoto)` → `withPhotoCount`

**Response mẫu:**
```json
{
  "averageRating": 4.3,
  "totalCount": 127,
  "breakdown": { "1": 3, "2": 5, "3": 12, "4": 40, "5": 67 },
  "withPhotoCount": 45
}
```

> Chỉ tính đánh giá có `status = APPROVED`.

---

### 4.2 Lấy danh sách đánh giá (Public)

```
GET /api/products/:slug/reviews?rating=&hasPhoto=&sort=&page=&limit=
```

| Query param | Giá trị hợp lệ | Mặc định |
|---|---|---|
| `rating` | `1` – `5` | Không lọc |
| `hasPhoto` | `'true'` | Không lọc |
| `sort` | `'helpful'` / `'newest'` | `'newest'` (mặc định) |
| `page` | Số nguyên ≥ 1 | `1` |
| `limit` | Số nguyên | Theo `LIMITS.PRODUCT` |

Sắp xếp:
- `sort=helpful` → theo số lượng vote helpful giảm dần
- mặc định → theo `createdAt DESC` (mới nhất trước)

Chỉ trả đánh giá `APPROVED`.

**Response bao gồm:**
- `rating`, `content`, `replyContent`, `repliedAt`, `createdAt`
- `user`: `{ id, fullName, avatarUrl }`
- `orderItem`: `{ color, storage, ram, sku }` — biết user mua phiên bản nào
- `photos[]`: `{ id, url }`
- `_count.helpful`: số lượt "Hữu ích"

---

### 4.3 Lấy sản phẩm chờ đánh giá (User)

```
GET /api/users/me/reviews/pending → getPendingReviews(userId)
```

Trả danh sách `OrderItem` thỏa mãn:
- `order.userId === userId` (đơn của chính user)
- `order.status === DELIVERED` (đã giao)
- `review IS NULL` (chưa có đánh giá)

Mỗi item gồm: tên sản phẩm, SKU, màu, bộ nhớ, RAM, giá, số lượng + thông tin đơn hàng + ảnh bìa sản phẩm. Sắp theo `order.updatedAt DESC` (đơn giao gần nhất trước).

---

### 4.4 Tạo đánh giá

```
POST /api/order-items/:orderItemId/review
  → [authenticate]
  → [uploadImage.array('photos', 5)]
  → [validateCreateReview]
  → createReview → Cloudinary + DB → Response 201
```

**Happy Path:**
1. Tìm `OrderItem` theo `id` + `order.userId` + `order.status=DELIVERED` → `404` nếu không thỏa
2. Kiểm tra chưa có đánh giá → `409` nếu đã có
3. **Song song:**
   - Resolve `productId` (từ `variantId` → DB, hoặc fallback theo `sku` → `productName`)
   - Upload tối đa 5 ảnh lên Cloudinary
4. Tạo `Review` trong DB với `status = APPROVED`
5. Trả về `201` + review mới (kèm ảnh)

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `orderItemId` không tồn tại / không thuộc user / đơn chưa DELIVERED | 404 | `Không tìm thấy sản phẩm trong đơn hàng đã giao` |
| Đã có đánh giá cho orderItem này | 409 | `Bạn đã đánh giá sản phẩm này rồi` |
| `rating` < 1 hoặc > 5 hoặc không nguyên | 400 | `Đánh giá phải từ 1 đến 5 sao` |
| Thiếu `content` | 400 | `Nội dung phải có ít nhất 10 ký tự` |
| `content` < 10 ký tự | 400 | `Nội dung phải có ít nhất 10 ký tự` |
| `content` > 2000 ký tự | 400 | `Nội dung không được quá 2000 ký tự` |

---

### 4.5 Sửa đánh giá

```
PUT /api/reviews/:id
  → [authenticate]
  → [uploadImage.array('photos', 5)]
  → [validateUpdateReview]
  → updateReview → DB + Cloudinary → Response
```

**Happy Path:**
1. Tìm review theo `id` + `userId` → `404` nếu không phải của user
2. Kiểm tra `createdAt + 30 ngày > now` → `400` nếu hết hạn
3. Validate: nếu gửi `rating` phải hợp lệ; nếu gửi `content` phải hợp lệ; cả hai đều optional nhưng phải gửi ít nhất một trong hai
4. Set `status = APPROVED` (reset lại nếu admin đã đổi)
5. Nếu có ảnh mới: upload tất cả → xóa toàn bộ ảnh cũ ở nền → lưu ảnh mới
6. Nếu không có ảnh mới: chỉ cập nhật text, giữ nguyên ảnh cũ
7. Trả về `200` + review đã cập nhật

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Review không tồn tại / không thuộc user | 404 | `Đánh giá không tồn tại` |
| Đã quá 30 ngày | 400 | `Đã quá 30 ngày, không thể chỉnh sửa đánh giá` |
| Không gửi `rating` lẫn `content` | 400 | `Không có gì để cập nhật` |
| `rating` không hợp lệ | 400 | `Đánh giá phải từ 1 đến 5 sao` |
| `content` < 10 ký tự | 400 | `Nội dung phải có ít nhất 10 ký tự` |

---

### 4.6 Xóa đánh giá (User)

```
DELETE /api/reviews/:id → [authenticate] → deleteMyReview → DB → Cloudinary (nền) → 204
```

1. Tìm review theo `id` + `userId` → `404` nếu không phải của user
2. Xóa review trong DB (cascade xóa `ReviewPhoto`, `ReviewHelpful`)
3. Xóa ảnh trên Cloudinary ở nền
4. Trả về `204 No Content`

---

### 4.7 Toggle "Hữu ích"

```
POST /api/reviews/:id/helpful → [authenticate] → toggleHelpful → DB → Response
```

**Happy Path:**
1. Song song: tìm review + tìm vote hiện tại của user
2. Review phải tồn tại và `status = APPROVED` → `404` nếu không
3. Nếu đã vote → xóa vote; nếu chưa vote → tạo vote
4. Đếm lại `_count.helpful`
5. Trả về `{ helpful: boolean, count: number }`

---

### 4.8 Quản trị đánh giá (Admin)

**Lấy danh sách:**
```
GET /api/admin/reviews?status=&rating=&productId=&page=&limit=
```

| Query param | Giá trị hợp lệ |
|---|---|
| `status` | `APPROVED` / `PENDING` / `REJECTED` |
| `rating` | `1` – `5` |
| `productId` | ID sản phẩm |

Trả đầy đủ thông tin gồm: `user`, `product`, `photos`, `_count.helpful`. Sắp theo `createdAt DESC`.

**Phản hồi:**
```
POST /api/admin/reviews/:id/reply
  Body: { content: string }  // 1–1000 ký tự
```

- Ghi đè `replyContent` nếu đã có phản hồi trước
- Trả về full review (cùng include với danh sách admin)

**Xóa:**
```
DELETE /api/admin/reviews/:id → deleteReview → DB → Cloudinary (nền) → 204
```

Xóa được cả những đánh giá không phải của mình (không check `userId`).

---

## 5. Sơ đồ điều kiện tạo đánh giá

```
Đơn hàng DELIVERED?  ── No ──► (không xuất hiện trong /pending)
        │ Yes
        │
Chưa có review?  ── No ──► 409 "Bạn đã đánh giá sản phẩm này rồi"
        │ Yes
        │
orderItem thuộc userId?  ── No ──► 404
        │ Yes
        │
Validate rating (1–5) + content (10–2000 ký tự)
        │
Song song: resolve productId + upload photos
        │
prisma.review.create(status: APPROVED)
        │
201 + review
```

---

## 6. Bảng dữ liệu

### Bảng `Review`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `orderItemId` | string | FK → OrderItem (unique — 1 review per item) |
| `userId` | string | FK → User |
| `productId` | string | FK → Product |
| `variantId` | string? | FK → ProductVariant (nullable nếu variant bị xóa) |
| `rating` | int | 1–5 |
| `content` | string | Nội dung đánh giá (10–2000 ký tự) |
| `status` | ReviewStatus | `APPROVED` / `PENDING` / `REJECTED` |
| `replyContent` | string? | Phản hồi của shop |
| `repliedAt` | DateTime? | Thời điểm phản hồi |
| `createdAt` | DateTime | Dùng kiểm tra cửa sổ 30 ngày |

### Bảng `ReviewPhoto`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `reviewId` | string | FK → Review |
| `url` | string | URL Cloudinary |
| `publicId` | string | Public ID Cloudinary (dùng để xóa) |
| `sortOrder` | int | Thứ tự hiển thị (index trong mảng upload) |

### Bảng `ReviewHelpful`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `userId` | string | FK → User |
| `reviewId` | string | FK → Review |

**Unique constraint:** `(userId, reviewId)` — mỗi user chỉ vote 1 lần.

---

## 7. Thiết kế đáng chú ý

| # | Thiết kế | Lý do |
|---|---|---|
| 1 | **Review gắn với `OrderItem`** thay vì sản phẩm | Đảm bảo chỉ người đã mua đúng phiên bản đó mới được đánh giá |
| 2 | **Tự động `APPROVED`** khi tạo/sửa | Không có quy trình duyệt — đơn giản hóa vận hành |
| 3 | **Cửa sổ 30 ngày** cho phép sửa | Cho phép khách chỉnh sau khi trải nghiệm đủ, nhưng tránh sửa vô hạn |
| 4 | **Thay thế ảnh toàn bộ** khi sửa | Đơn giản hơn merge — tránh state phức tạp khi có vừa ảnh cũ vừa mới |
| 5 | **Toggle helpful** (không phải up/down vote) | Giao diện đơn giản, không cần hai nút riêng |
| 6 | **1 phản hồi** per review | Shop chỉ cần 1 câu trả lời chính thức — tránh thread dài |
| 7 | **`orderItem` trong response public** | Frontend hiển thị "user này mua màu X, 128GB" bên cạnh đánh giá |
| 8 | **Resolve `productId` từ snapshot** | `OrderItem` lưu `sku` + `productName` — tìm được `productId` dù variant bị xóa sau |
