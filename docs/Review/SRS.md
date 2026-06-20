# SRS — Software Requirement Specification
## Module: Review (Đánh giá sản phẩm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-20  
> **Tham chiếu:** [Order/SRS.md](../Order/SRS.md), [Product/SRS.md](../Product/SRS.md)

---

## 1. Phạm vi hệ thống

Module Review cung cấp các chức năng:
- **Public**: Xem tổng hợp đánh giá, danh sách đánh giá có phân trang
- **User**: Xem đơn chờ đánh giá, tạo đánh giá (có ảnh), xem/sửa/xóa đánh giá của mình, vote helpful
- **Admin**: Quản lý tất cả đánh giá, phản hồi đánh giá, xóa đánh giá

**Ngoài phạm vi:** Export đánh giá, báo cáo thống kê chi tiết, hệ thống gợi ý sản phẩm dựa trên đánh giá.

---

## 2. Yêu cầu chức năng (Functional Requirements)

### FR-01: Lấy tổng hợp đánh giá (Public)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-01 |
| **Tên** | Lấy tổng hợp đánh giá của sản phẩm |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/products/:slug/reviews/summary` |
| **Auth** | Public |

**Đầu vào:**
- `slug` (string, required): Slug của sản phẩm (path parameter)

**Xử lý:**
1. Query Product theo `slug`, validate tồn tại
2. **Parallel Aggregation** (3 queries song song):
   - `aggregate`: Tính trung bình rating + tổng số đánh giá với `status = APPROVED`
   - `groupBy`: Đếm số lượng đánh giá theo từng mức rating (1-5 sao)
   - `reviewPhoto.count`: Đếm số đánh giá có ảnh
3. Tính toán `breakdown` object (5 ratings) từ groupBy result
4. Format `averageRating` làm tròn 1 chữ số thập phân
5. Trả về `200` + `{ averageRating, totalCount, breakdown, withPhotoCount }`

**Đầu ra thành công:** `200` + summary object

```json
{
  "averageRating": 4.5,
  "totalCount": 10,
  "breakdown": {
    "1": 0,
    "2": 0,
    "3": 1,
    "4": 3,
    "5": 6
  },
  "withPhotoCount": 5
}
```

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Sản phẩm không tồn tại | 404 | `Sản phẩm không tồn tại` |

---

### FR-02: Liệt kê đánh giá (Public)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-02 |
| **Tên** | Liệt kê đánh giá của sản phẩm với bộ lọc |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/products/:slug/reviews` |
| **Auth** | Public |

**Đầu vào:**
- `slug` (string, required): Slug sản phẩm (path parameter)
- `rating` (string, optional): Lọc theo số sao ('1' | '2' | '3' | '4' | '5')
- `hasPhoto` (string, optional): Chỉ hiện đánh giá có ảnh ('true')
- `sort` (string, optional): Sắp xếp ('newest' | 'helpful'), default 'newest'
- `page` (string, optional): Trang hiện tại, default '1'
- `limit` (string, optional): Số item/trang, default '10'

**Xử lý:**
1. Query Product theo `slug`, validate tồn tại
2. Parse pagination (`page`, `limit`)
3. Build `where` clause:
   - `productId` từ product
   - `status = APPROVED`
   - Nếu `rating` provided → thêm filter `rating = Number(rating)`
   - Nếu `hasPhoto == 'true'` → thêm filter `photos: { some: {} }`
4. Build `orderBy`:
   - `sort == 'helpful'` → `{ helpful: { _count: 'desc' } }`
   - `sort == 'newest'` hoặc default → `{ createdAt: 'desc' }`
5. **Parallel Query**:
   - `findMany`: Lấy danh sách đánh giá với pagination
   - `count`: Đếm tổng số đánh giá match filter
6. Trả về `200` + `{ reviews, pagination }`

**Đầu ra thành công:** `200` + reviews list object

```json
{
  "reviews": [
    {
      "id": "review-1",
      "rating": 5,
      "content": "Sản phẩm rất tốt",
      "replyContent": "Cảm ơn bạn!",
      "repliedAt": "2024-06-20T10:00:00Z",
      "createdAt": "2024-06-18T15:30:00Z",
      "orderItem": {
        "color": "Đen",
        "storage": "128GB",
        "ram": "8GB",
        "sku": "IP15-128-BLK"
      },
      "user": {
        "id": "user-1",
        "fullName": "Nguyễn Văn A",
        "avatarUrl": "https://cdn.avatar.jpg"
      },
      "photos": [
        { "id": "photo-1", "url": "https://cdn.review1.jpg" }
      ],
      "_count": {
        "helpful": 5
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Sản phẩm không tồn tại | 404 | `Sản phẩm không tồn tại` |
| rating không hợp lệ | 400 | `Đánh giá phải từ 1 đến 5 sao` |

---

### FR-03: Lấy đơn chờ đánh giá (User)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-03 |
| **Tên** | Lấy danh sách đơn hàng đã giao chưa đánh giá |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/users/me/reviews/pending` |
| **Auth** | CUSTOMER+ |

**Đầu vào:** Không có (truyền JWT token)

**Xử lý:**
1. Lấy `userId` từ JWT token
2. Query OrderItems với điều kiện:
   - `order.userId == userId`
   - `order.status == DELIVERED`
   - `review == null` (chưa đánh giá)
3. Include:
   - Order (`id`, `orderCode`, `updatedAt`)
   - Variant → Product (`slug`, cover image)
4. Sort by `order.updatedAt DESC`
5. Trả về `200` + orderItems list

**Đầu ra thành công:** `200` + pending orderItems

```json
[
  {
    "id": "item-1",
    "productName": "iPhone 15 Pro",
    "sku": "IP15-256-BLK",
    "color": "Đen",
    "storage": "256GB",
    "ram": "8GB",
    "unitPrice": 25000000,
    "quantity": 1,
    "order": {
      "id": "order-1",
      "orderCode": "ORD-20240620-A1B2C3",
      "updatedAt": "2024-06-18T10:00:00Z"
    },
    "variant": {
      "product": {
        "slug": "iphone-15-pro",
        "images": [
          { "url": "https://cdn.cover.jpg" }
        ]
      }
    }
  }
]
```

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có token JWT | 401 | `Unauthorized` |

---

### FR-04: Tạo đánh giá (User)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-04 |
| **Tên** | Tạo đánh giá sản phẩm (có thể kèm ảnh) |
| **Ưu tiên** | Cao |
| **Endpoint** | `POST /api/order-items/:orderItemId/review` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `orderItemId` (string, required): ID order item (path parameter)
- `rating` (number, required): Số sao từ 1-5
- `content` (string, required): Nội dung đánh giá, 10-2000 ký tự
- `photos` (file[], optional): Array ảnh (max 5 ảnh, mỗi ảnh ≤ 5MB)

**Xử lý:**
1. **Ownership & Status Check**:
   - Query OrderItem theo `orderItemId` + `order.userId`
   - Validate `order.status == DELIVERED`
   - Validate `review == null` (chưa đánh giá)
2. **Resolve Product ID**:
   - Nếu `variantId` tồn tại → query ProductVariant → lấy `productId`
   - Nếu không → fallback query Product theo `productName` hoặc `sku`
3. **Upload Photos** (song song với resolve product):
   - Nếu có `files` → upload lên Cloudinary (folder `reviews`)
   - Max 5 files, slice `files.slice(0, 5)`
   - Return `{ url, publicId }` cho mỗi ảnh
4. **Create Review**:
   - `rating`, `content` từ request body
   - `status = APPROVED` (auto-approve)
   - `photos`: tạo ReviewPhoto records với `sortOrder`
5. Trả về `201` + review object

**Đầu ra thành công:** `201` + review object

```json
{
  "id": "review-1",
  "rating": 5,
  "content": "Sản phẩm rất tốt, giao hàng nhanh",
  "status": "APPROVED",
  "createdAt": "2024-06-20T15:30:00Z",
  "photos": [
    { "id": "photo-1", "url": "https://cdn.review1.jpg" },
    { "id": "photo-2", "url": "https://cdn.review2.jpg" }
  ]
}
```

**Validation Rules:**

| Trường | Ràng buộc |
|---|---|
| `rating` | Số nguyên, 1 ≤ rating ≤ 5 |
| `content` | String, 10 ≤ length ≤ 2000 ký tự |
| `photos` | Max 5 files, mỗi file ≤ 5MB, chỉ accepts image/* |

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có token JWT | 401 | `Unauthorized` |
| Order item không thuộc đơn DELIVERED | 404 | `Không tìm thấy sản phẩm trong đơn hàng đã giao` |
| Đã đánh giá rồi | 409 | `Bạn đã đánh giá sản phẩm này rồi` |
| Thiếu rating | 400 | `Đánh giá phải từ 1 đến 5 sao` |
| Thiếu content | 400 | `Nội dung phải có ít nhất 10 ký tự` |
| Content quá ngái | 400 | `Nội dung phải có ít nhất 10 ký tự` |
| Content quá dài | 400 | `Nội dung không được quá 2000 ký tự` |
| Cloudinary upload fail | 500 | `Lỗi khi tải ảnh lên, vui lòng thử lại` |

---

### FR-05: Xem đánh giá của tôi (User)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-05 |
| **Tên** | Lấy danh sách đánh giá của user đang đăng nhập |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `GET /api/users/me/reviews` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `page` (string, optional): Trang hiện tại, default '1'
- `limit` (string, optional): Số item/trang, default '10'

**Xử lý:**
1. Lấy `userId` từ JWT token
2. Parse pagination (`page`, `limit`)
3. Query Reviews với `userId`
4. Include:
   - Product (`name`, `slug`, cover image)
   - OrderItem (`color`, `storage`, `ram`)
   - Photos (sort by `sortOrder`)
5. Sort by `createdAt DESC`
6. Trả về `200` + `{ reviews, pagination }`

**Đầu ra thành công:** `200` + my reviews list

```json
{
  "reviews": [
    {
      "id": "review-1",
      "rating": 5,
      "content": "Sản phẩm rất tốt",
      "status": "APPROVED",
      "createdAt": "2024-06-18T15:30:00Z",
      "updatedAt": "2024-06-19T10:00:00Z",
      "photos": [
        { "id": "photo-1", "url": "https://cdn.review1.jpg" }
      ],
      "product": {
        "name": "iPhone 15 Pro",
        "slug": "iphone-15-pro",
        "images": [
          { "url": "https://cdn.cover.jpg" }
        ]
      },
      "orderItem": {
        "color": "Đen",
        "storage": "256GB",
        "ram": "8GB"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có token JWT | 401 | `Unauthorized` |

---

### FR-06: Cập nhật đánh giá (User)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-06 |
| **Tên** | Chỉnh sửa đánh giá (trong 30 ngày) |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `PUT /api/reviews/:id` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `id` (string, required): ID đánh giá (path parameter)
- `rating` (number, optional): Số sao mới (1-5)
- `content` (string, optional): Nội dung mới (10-2000 ký tự)
- `photos` (file[], optional): Array ảnh mới (max 5)

**Xử lý:**
1. Lấy `userId` từ JWT token
2. **Ownership Check**: Query Review theo `reviewId` + `userId`
3. **Edit Window Check**:
   - Tính `elapsedMs = Date.now() - review.createdAt.getTime()`
   - Validate `elapsedMs ≤ EDIT_WINDOW_MS` (30 ngày)
   - Nếu quá hạn → throw error
4. **Validation**:
   - Ít nhất 1 trong 2: `rating` hoặc `content` phải có
   - Nếu có `rating` → validate 1-5
   - Nếu có `content` → validate 10-2000 ký tự
5. **Handle Photos**:
   - Nếu có `files` mới:
     - Upload ảnh mới lên Cloudinary (song song)
     - **Fire-and-forget delete** ảnh cũ (không await)
     - Delete all old ReviewPhoto records
     - Create new ReviewPhoto với `sortOrder`
6. **Update Review**:
   - Set `status = APPROVED` (re-auto-approve)
   - Update `rating` và/hoặc `content`
7. Trả về `200` + updated review

**Edit Window:**
- **30 ngày** kể từ ngày tạo đánh giá
- Config constant: `EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000`

**Đầu ra thành công:** `200` + updated review object

```json
{
  "id": "review-1",
  "rating": 4,
  "content": "Đã cập nhật: Sản phẩm tốt nhưng pin hơi yếu",
  "status": "APPROVED",
  "updatedAt": "2024-06-20T15:30:00Z",
  "photos": [
    { "id": "photo-3", "url": "https://cdn.new-review.jpg" }
  ]
}
```

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có token JWT | 401 | `Unauthorized` |
| Đánh giá không tồn tại/không thuộc user | 404 | `Đánh giá không tồn tại` |
| Quá 30 ngày | 400 | `Đã quá 30 ngày, không thể chỉnh sửa đánh giá` |
| Không có field nào để update | 400 | `Không có gì để cập nhật` |
| Rating không hợp lệ | 400 | `Đánh giá phải từ 1 đến 5 sao` |
| Content quá ngái | 400 | `Nội dung phải có ít nhất 10 ký tự` |
| Content quá dài | 400 | `Nội dung không được quá 2000 ký tự` |

---

### FR-07: Xóa đánh giá của tôi (User)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-07 |
| **Tên** | Xóa đánh giá của chính mình |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `DELETE /api/reviews/:id` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `id` (string, required): ID đánh giá (path parameter)

**Xử lý:**
1. Lấy `userId` từ JWT token
2. **Ownership Check**: Query Review theo `reviewId` + `userId` + include photos
3. **Cascade Delete**:
   - Delete Review record (DB cascade delete ReviewHelpful, ReviewPhoto)
   - **Fire-and-forget delete** ảnh trên Cloudinary (không await)
4. Trả về `204` (No Content)

**Đầu ra thành công:** `204` (no body)

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có token JWT | 401 | `Unauthorized` |
| Đánh giá không tồn tại/không thuộc user | 404 | `Đánh giá không tồn tại` |

---

### FR-08: Toggle Helpful (User)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-08 |
| **Tên** | Đánh giá là "hữu ích" hoặc bỏ đánh giá |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `POST /api/reviews/:id/helpful` |
| **Auth** | CUSTOMER+ |

**Đầu vào:**
- `id` (string, required): ID đánh giá (path parameter)

**Xử lý:**
1. Lấy `userId` từ JWT token
2. **Existence Check**: Query Review theo `reviewId`, validate `status == APPROVED`
3. **Check Existing Vote**: Query ReviewHelpful theo composite key `(userId, reviewId)`
4. **Toggle Logic**:
   - **Chưa vote** → Create ReviewHelpful record → `helpful = true`
   - **Đã vote** → Delete ReviewHelpful record → `helpful = false`
5. **Get Updated Count**: Query lại `_count.helpful` từ review
6. Trả về `200` + `{ helpful, count }`

**Đầu ra thành công:** `200` + helpful toggle result

```json
{
  "helpful": true,
  "count": 5
}
```

hoặc

```json
{
  "helpful": false,
  "count": 4
}
```

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có token JWT | 401 | `Unauthorized` |
| Đánh giá không tồn tại | 404 | `Đánh giá không tồn tại` |
| Đánh giá chưa được duyệt | 404 | `Đánh giá không tồn tại` |

---

### FR-09: Admin liệt kê đánh giá

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-09 |
| **Tên** | Admin xem tất cả đánh giá với bộ lọc |
| **Ưu tiên** | Cao |
| **Endpoint** | `GET /api/admin/reviews` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `status` (string, optional): Lọc theo status ('APPROVED' | 'PENDING' | 'REJECTED')
- `rating` (string, optional): Lọc theo số sao ('1' | '2' | '3' | '4' | '5')
- `productId` (string, optional): Lọc theo sản phẩm
- `page` (string, optional): Trang hiện tại, default '1'
- `limit` (string, optional): Số item/trang, default '10'

**Xử lý:**
1. Parse pagination (`page`, `limit`)
2. Build `where` clause:
   - Nếu `status` provided → filter by status
   - Nếu `rating` provided → filter by rating
   - Nếu `productId` provided → filter by product
3. Query Reviews với admin include:
   - User (`id`, `fullName`, `email`)
   - Product (`id`, `name`, `slug`)
   - Photos (sort by `sortOrder`)
   - `_count.helpful`
4. Sort by `createdAt DESC`
5. **Parallel Count** để pagination
6. Trả về `200` + `{ reviews, pagination }`

**Đầu ra thành công:** `200` + admin reviews list

```json
{
  "reviews": [
    {
      "id": "review-1",
      "rating": 5,
      "content": "Sản phẩm rất tốt",
      "status": "APPROVED",
      "replyContent": null,
      "repliedAt": null,
      "createdAt": "2024-06-18T15:30:00Z",
      "user": {
        "id": "user-1",
        "fullName": "Nguyễn Văn A",
        "email": "user@test.com"
      },
      "product": {
        "id": "prod-1",
        "name": "iPhone 15 Pro",
        "slug": "iphone-15-pro"
      },
      "photos": [
        { "id": "photo-1", "url": "https://cdn.review1.jpg" }
      ],
      "_count": {
        "helpful": 5
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có token JWT | 401 | `Unauthorized` |
| Không phải STAFF/ADMIN | 403 | `Forbidden` |

---

### FR-10: Admin phản hồi đánh giá

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-10 |
| **Tên** | Admin viết phản hồi cho đánh giá |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `POST /api/admin/reviews/:id/reply` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `id` (string, required): ID đánh giá (path parameter)
- `content` (string, required): Nội dung phản hồi, 1-1000 ký tự

**Xử lý:**
1. Update Review với:
   - `replyContent = content.trim()`
   - `repliedAt = new Date()`
2. Return full review object với admin include
3. Trả về `200` + updated review

**Lưu ý:**
- Nếu đã có `replyContent` → **overwrite** (không append)
- Không validate review status (phản hồi cả PENDING, APPROVED, REJECTED)

**Đầu ra thành công:** `200` + updated review object

```json
{
  "id": "review-1",
  "rating": 5,
  "content": "Sản phẩm rất tốt",
  "status": "APPROVED",
  "replyContent": "Cảm ơn bạn đã đánh giá tích cực!",
  "repliedAt": "2024-06-20T10:00:00Z",
  "createdAt": "2024-06-18T15:30:00Z",
  "user": { "id": "user-1", "fullName": "Nguyễn Văn A", "email": "user@test.com" },
  "product": { "id": "prod-1", "name": "iPhone 15 Pro", "slug": "iphone-15-pro" },
  "photos": [],
  "_count": { "helpful": 5 }
}
```

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có token JWT | 401 | `Unauthorized` |
| Không phải STAFF/ADMIN | 403 | `Forbidden` |
| Thiếu content | 400 | `Nội dung phải có ít nhất 1 ký tự` |
| Content quá dài | 400 | `Nội dung không được quá 1000 ký tự` |
| Đánh giá không tồn tại | 404 | `Đánh giá không tồn tại` |

---

### FR-11: Admin xóa đánh giá

| Thuộc tính | Giá trị |
|---|---|
| **ID** | FR-11 |
| **Tên** | Admin xóa bất kỳ đánh giá nào |
| **Ưu tiên** | Trung bình |
| **Endpoint** | `DELETE /api/admin/reviews/:id` |
| **Auth** | STAFF+ |

**Đầu vào:**
- `id` (string, required): ID đánh giá (path parameter)

**Xử lý:**
1. Query Review theo `reviewId` + include photos
2. Validate review tồn tại
3. **Cascade Delete**:
   - Delete Review (DB cascade delete ReviewHelpful, ReviewPhoto)
   - **Fire-and-forget delete** ảnh trên Cloudinary (không await)
4. Trả về `204` (No Content)

**Lưu ý:**
- Admin **không** cần ownership check
- Không cần validate review status

**Đầu ra thành công:** `204` (no body)

**Điều kiện lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Không có token JWT | 401 | `Unauthorized` |
| Không phải STAFF/ADMIN | 403 | `Forbidden` |
| Đánh giá không tồn tại | 404 | `Đánh giá không tồn tại` |

---

## 3. Yêu cầu phi chức năng (Non-Functional Requirements)

### NFR-01: Hiệu năng

| Chỉ tiêu | Giá trị |
|---|---|
| Lấy tổng hợp đánh giá | < 300ms (p95) |
| Liệt kê đánh giá (public) | < 200ms (p95) |
| Tạo đánh giá (có upload ảnh) | < 2s (p95) |
| Toggle helpful | < 100ms (p95) |
| Admin liệt kê đánh giá | < 300ms (p95) |
| Admin phản hồi đánh giá | < 150ms (p95) |

**Lưu ý:**
- Summary endpoint: 3 queries song song (aggregate + groupBy + count)
- Create review: Upload ảnh song song với resolve product ID
- Delete review: Fire-and-forget delete ảnh trên Cloudinary

---

### NFR-02: Bảo mật

| Yêu cầu | Mô tả |
|---|---|
| Ownership check | User chỉ xem/sửa/xóa đánh giá của mình (check `userId`) |
| Order ownership | User chỉ đánh giá order item của đơn hàng mình (check `order.userId`) |
| Role-based access | Admin endpoints yêu cầu STAFF+ |
| Auto-approve | Mọi đánh giá mới đều `status = APPROVED` (không cần duyệt) |
| Photo validation | Chỉ chấp nhận image/*, max 5 files, mỗi file ≤ 5MB |
| SQL Injection prevention | Prisma ORM escape input |
| Cloudinary folder | Ảnh review upload vào folder `reviews` |

---

### NFR-03: Độ tin cậy

| Yêu cầu | Giá trị |
|---|---|
| Uptime | ≥ 99.9% |
| Photo cleanup | Cloudinary ảnh được xóa fire-and-forget khi review xóa |
| Upload failure handling | Nếu upload ảnh fail → throw error, không tạo review |
| Cascade delete | Xóa review → auto xóa ReviewHelpful, ReviewPhoto (DB cascade) |
| Idempotent helpful | Toggle bằng unique constraint `(userId, reviewId)` |

---

### NFR-04: Khả năng bảo trì

| Yêu cầu | Mô tả |
|---|---|
| Edit window | Config constant `EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000` |
| Max photos | Config constant `MAX_PHOTOS = 5` |
| Validation helpers | `validateRating()`, `validateContent()` functions |
| Cloudinary config | Folder name config trong code (`'reviews'`) |
| No magic numbers | Tất cả constants được define rõ ràng |

---

### NFR-05: Scalability

| Yêu cầu | Giá trị |
|---|---|
| Concurrent users | 100+ users tạo đánh giá đồng thời |
| Photo upload | Xử lý 50+ uploads đồng thời (5 files/user * 10 users) |
| Helpful votes | Xử lý 100+ toggle helpful đồng thời |
| Index coverage | Index trên `(productId, status)`, `userId`, `orderItemId` |
| Unique constraint | Unique trên `(userId, reviewId)` cho ReviewHelpful |

---

## 4. Yêu cầu dữ liệu

### 4.1 Enum ReviewStatus

```prisma
enum ReviewStatus {
  PENDING    // Chờ duyệt (không dùng trong current implementation)
  APPROVED   // Đã duyệt (default khi tạo mới)
  REJECTED   // Đã từ chối (không dùng trong current implementation)
}
```

**Lưu ý:** Current implementation auto-approve (`status = APPROVED`), không dùng PENDING/REJECTED.

---

### 4.2 Bảng Review

| Trường | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `VARCHAR` (UUID) | PK, auto-generated | ID đánh giá |
| `orderItemId` | `VARCHAR` | **unique**, FK → OrderItem.id, not null | Order item được đánh giá |
| `userId` | `VARCHAR` | FK → User.id, not null | User tạo đánh giá |
| `productId` | `VARCHAR` | FK → Product.id, not null | Sản phẩm được đánh giá |
| `variantId` | `VARCHAR` | FK → ProductVariant.id, nullable | Variant đã mua |
| `rating` | `INTEGER` | not null, 1 ≤ rating ≤ 5 | Số sao đánh giá |
| `content` | `VARCHAR` | not null, 10 ≤ length ≤ 2000 | Nội dung đánh giá |
| `status` | `ReviewStatus` | not null, default: APPROVED | Trạng thái duyệt |
| `replyContent` | `VARCHAR` | nullable, ≤ 1000 ký tự | Phản hồi từ admin |
| `repliedAt` | `TIMESTAMPTZ` | nullable | Thời gian phản hồi |
| `createdAt` | `TIMESTAMPTZ` | auto-generated | Thời gian tạo |
| `updatedAt` | `TIMESTAMPTZ` | auto-generated | Thời gian cập nhật |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (orderItemId)` — 1 order item = 1 review
- `INDEX (productId, status)` — cho public query (summary, list)
- `INDEX (userId)` — cho user query (my reviews)
- `INDEX (createdAt)` — cho sorting

**Cascade:**
- Khi xóa `OrderItem` → `Review` bị xóa theo (cascade delete)
- Khi xóa `User` → tất cả `Review` bị xóa theo (cascade delete)
- Khi xóa `Product` → tất cả `Review` bị xóa theo (cascade delete)

---

### 4.3 Bảng ReviewPhoto

| Trường | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `VARCHAR` (UUID) | PK, auto-generated | ID ảnh |
| `reviewId` | `VARCHAR` | FK → Review.id, not null | Review chứa ảnh |
| `url` | `VARCHAR` | not null | URL ảnh trên Cloudinary |
| `publicId` | `VARCHAR` | not null | Public ID để xóa trên Cloudinary |
| `sortOrder` | `INTEGER` | not null, default: 0 | Thứ tự hiển thị |

**Indexes:**
- `PRIMARY KEY (id)`
- `INDEX (reviewId)` — cho lookup ảnh của review

**Cascade:**
- Khi xóa `Review` → tất cả `ReviewPhoto` bị xóa theo (cascade delete)

**Constraints:**
- Max 5 photos/review (application-level validation)

---

### 4.4 Bảng ReviewHelpful

| Trường | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `userId` | `VARCHAR` | FK → User.id, not null | User vote |
| `reviewId` | `VARCHAR` | FK → Review.id, not null | Review được vote |

**Indexes:**
- `PRIMARY KEY (userId, reviewId)` — composite key, đảm bảo 1 user chỉ vote 1 lần

**Cascade:**
- Khi xóa `User` → tất cả `ReviewHelpful` bị xóa theo (cascade delete)
- Khi xóa `Review` → tất cả `ReviewHelpful` bị xóa theo (cascade delete)

---

## 5. Môi trường & Cấu hình

| Biến môi trường | Mô tả | Ràng buộc |
|---|---|---|
| Không có env vars đặc biệt | — | Module Review không cần env var đặc biệt (Cloudinary config shared) |

**Constants trong code:**
- `EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000` — 30 ngày edit window
- `MAX_PHOTOS = 5` — Số ảnh tối đa/review
- `MIN_CONTENT_LENGTH = 10` — Độ dài tối thiểu content
- `MAX_CONTENT_LENGTH = 2000` — Độ dài tối đa content
- `MAX_REPLY_LENGTH = 1000` — Độ dài tối đa reply content

---

## 6. Phụ thuộc

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| `@prisma/client` | latest | ORM tương tác DB |
| `express` | latest | Web framework |
| `multer` | latest | Upload middleware (photos) |
| `cloudinary` | latest | Image upload/delete |
| `helpers/app_error` | local | Custom error handling |
| `helpers/async_handler` | local | Async error wrapper |
| `helpers/response` | local | Standardized response format |
| `utils/pagination` | local | Pagination helper |
| `validators/review.validator` | local | Validation logic |

**Module Dependencies:**
- **Order module**: Để validate order status (`DELIVERED`) và ownership
- **Product module**: Để resolve product ID từ order item
- **User module**: Để get user info từ JWT token

---

## 7. Error Handling

### 7.1 HTTP Status Codes

| Code | Khi nào dùng |
|---|---|
| `200` | Thành công (GET, PUT, POST toggle helpful) |
| `201` | Tạo thành công (POST create review) |
| `204` | Xóa thành công (DELETE review) |
| `400` | Validation error (rating, content, edit window) |
| `401` | Không xác thực (thiếu JWT) |
| `403` | Không đủ quyền (customer call admin endpoint) |
| `404` | Không tìm thấy (review, product, order item) |
| `409` | Conflict (đã đánh giá rồi) |
| `500` | Server error (Cloudinary upload fail) |

### 7.2 Error Response Format

```json
{
  "message": "Đã quá 30 ngày, không thể chỉnh sửa đánh giá"
}
```

hoặc

```json
{
  "message": "Bạn đã đánh giá sản phẩm này rồi"
}
```

### 7.3 Validation Error Messages

| Trường | Error Message |
|---|---|
| `rating` missing | `Đánh giá phải từ 1 đến 5 sao` |
| `rating` invalid | `Đánh giá phải từ 1 đến 5 sao` |
| `content` missing | `Nội dung phải có ít nhất 10 ký tự` |
| `content` too short | `Nội dung phải có ít nhất 10 ký tự` |
| `content` too long | `Nội dung không được quá 2000 ký tự` |
| `replyContent` too short | `Nội dung phải có ít nhất 1 ký tự` |
| `replyContent` too long | `Nội dung không được quá 1000 ký tự` |
| `rating` + `content` both missing | `Không có gì để cập nhật` |

---

## 8. Testing Requirements

### 8.1 Unit Tests

- **Validation logic:**
  - `validateRating()`: Validate đúng rating 1-5
  - `validateContent()`: Validate đúng length bounds
  - `validateReplyContent()`: Validate đúng reply length

- **Edit window check:**
  - Tính đúng `elapsedMs` > 30 ngày → block edit
  - Tính đúng `elapsedMs` ≤ 30 ngày → allow edit

- **Ownership check:**
  - `findOwnedReview()`: Return null nếu userId không match
  - `findOwnedReview()`: Return review nếu match

- **Toggle helpful logic:**
  - Chưa vote → create record → helpful = true
  - Đã vote → delete record → helpful = false

### 8.2 Integration Tests

- **Get summary:**
  - Return đúng averageRating, totalCount, breakdown
  - Handle product không tồn tại → 404

- **List reviews (public):**
  - Filter đúng by rating, hasPhoto
  - Sort đúng by newest, helpful
  - Pagination work correctly

- **Get pending reviews:**
  - Return đúng orderItems với `order.status == DELIVERED` + `review == null`
  - Filter đúng by userId

- **Create review:**
  - Upload 5 photos thành công → tạo review với 5 photos
  - Upload fail → throw error, không tạo review
  - Đánh giá rồi → return 409
  - Order item không DELIVERED → return 404

- **Update review:**
  - Trong 30 ngày → allow edit
  - Quá 30 ngày → block edit, return 400
  - Upload ảnh mới → xóa ảnh cũ fire-and-forget

- **Delete review:**
  - Ownership check → user chỉ xóa review của mình
  - Admin delete → không cần ownership check

- **Toggle helpful:**
  - Chưa vote → create ReviewHelpful, count++
  - Đã vote → delete ReviewHelpful, count--
  - Review không APPROVED → return 404

- **Admin reply:**
  - Overwrite replyContent nếu đã có
  - Return full review object với admin include

### 8.3 E2E Tests

- **Flow public:** User view product → Get summary → List reviews → Filter by rating → Sort by helpful
- **Flow user:** User đăng nhập → Get pending reviews → Create review (with photos) → Edit review (within 30 days) → Delete review
- **Flow helpful:** User view review → Toggle helpful (count++) → Toggle again (count--)
- **Flow admin:** Admin login → List all reviews (filter by status/rating) → Reply review → Delete review
- **Flow edit window:** User tạo review → Wait 30+ days → Try edit → Block with error
- **Flow concurrent:** 10 users toggle helpful cùng lúc → Unique constraint đảm bảo không duplicate

---

## 9. Migration & Rollback

### 9.1 Database Migration

- Tạo unique constraint cho `orderItemId` trong bảng Review (1 order item = 1 review)
- Tạo composite unique constraint cho `(userId, reviewId)` trong bảng ReviewHelpful
- Tạo index `(productId, status)` cho bảng Review
- Tả index `userId` cho bảng Review
- Migrate data từ hệ thống cũ (nếu có):
  - Backfill `productId` từ orderItem → variant → product
  - Convert existing review photos sang Cloudinary
  - Set `status = APPROVED` cho tất cả reviews cũ

### 9.2 Rollback Plan

- Revert code deployment
- Restore DB backup (nếu schema change)
- Cloudinary photos được giữ lại (không xóa ngay)
- Re-migrate data từ backup nếu cần

---

## 10. Architecture Decision Records

### ADR-001: Auto-Approve Reviews

**Context:** Cần quyết định có nên duyệt đánh giá trước khi hiển thị công khai.

**Decision:** Mọi đánh giá mới đều `status = APPROVED` (không cần duyệt).

**Consequences:**
- **Pro:** Đơn giản, không cần admin moderation UI
- **Pro:** UX tốt hơn, user thấy review ngay lập tức
- **Pro:** Giảm workload cho admin
- **Con:** Risk spam/negative content không được filter
- **Mitigation:** Implement report mechanism trong tương lai, blacklist user spam

---

### ADR-002: 30-Day Edit Window

**Context:** User muốn sửa đánh giá sau khi viết, nhưng cần timeframe hợp lý.

**Decision:** Cho phép edit trong 30 ngày kể từ ngày tạo, config constant `EDIT_WINDOW_MS`.

**Consequences:**
- **Pro:** Balance giữa flexibility và data integrity
- **Pro:** Config constant, dễ thay đổi nếu cần
- **Con:** User có thể abuse (sửa rating sau 1 tháng)
- **Mitigation:** Log changes, track updatedAt timestamp

---

### ADR-003: Fire-and-Forget Photo Deletion

**Context:** Khi xóa review, cần xóa ảnh trên Cloudinary, nhưng không muốn block request.

**Decision:** Delete Review record trước, rồi fire-and-forget delete ảnh (không await).

**Consequences:**
- **Pro:** Response time nhanh, không block user request
- **Pro:** DB cascade delete đảm bảo consistency
- **Con:** Có thể orphan photos nếu Cloudinary delete fail
- **Mitigation:** Implement cleanup job chạy định kỳ

---

### ADR-004: Unique Constraint for Helpful Votes

**Context:** Cần đảm bảo 1 user chỉ vote helpful 1 lần cho 1 review.

**Decision:** Dùng composite unique key `(userId, reviewId)` ở DB level.

**Consequences:**
- **Pro:** DB đảm bảo uniqueness, không race condition
- **Pro:** Toggle logic đơn giản (check exists → create/delete)
- **Con:** Cần handle Prisma error nếu constraint violated
- **Mitigation:** Try-catch P2002 unique constraint violation

---

### ADR-005: Parallel Aggregation for Summary

**Context:** Summary endpoint cần aggregate 3 queries, latency concern.

**Decision:** Use `Promise.all()` để chạy aggregate, groupBy, count song song.

**Consequences:**
- **Pro:** Latency ~ max(query_time) thay vì sum(query_time)
- **Pro:** Better UX cho product page
- **Con:** DB load cao hơn (3 queries cùng lúc)
- **Mitigation:** Cache summary response (nếu cần)

---

### ADR-006: 1 Order Item = 1 Review

**Context:** Cần quyết định có cho phép review same product multiple times.

**Decision:** Unique constraint trên `orderItemId` → 1 order item chỉ review được 1 lần.

**Consequences:**
- **Pro:** Đơn giản, tránh spam reviews
- **Pro:** Data model clean, 1-1 relationship
- **Con:** User mua cùng sản phẩm 2 lần → chỉ review 1 lần
- **Mitigation:** Allow edit review, hoặc gộp multiple orders into 1 review (future feature)

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-20  
> **Next Review:** After integration test complete