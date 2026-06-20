# Review Module - API Specification

## Tổng quan

Module Review cung cấp hệ thống đánh giá sản phẩm toàn diện cho nền tảng Mobivexa. Hệ thống hỗ trợ đánh giá có hình ảnh, vote hữu ích, phản hồi từ admin, và quản lý hoàn toàn vòng đời đánh giá.

## Cấu trúc URL

- **Public endpoints**: `/api/products/:slug/reviews/*`
- **User endpoints**: `/api/users/me/reviews/*`, `/api/order-items/:orderItemId/review`, `/api/reviews/*`
- **Admin endpoints**: `/api/admin/reviews/*`

---

## 1. Public Endpoints

### 1.1 Lấy tóm tắt đánh giá

Lấy thống kê tổng hợp về đánh giá của sản phẩm (trung bình, phân phối, số lượng).

**Endpoint:** `GET /api/products/:slug/reviews/summary`

**Authentication:** Không yêu cầu

**Query Parameters:** Không có

**Response:**
```json
{
  "success": true,
  "data": {
    "averageRating": 4.3,
    "totalCount": 156,
    "breakdown": {
      "1": 5,
      "2": 8,
      "3": 15,
      "4": 42,
      "5": 86
    },
    "withPhotoCount": 98
  }
}
```

**Business Logic:**
- Chỉ tính các review có `status = APPROVED`
- Thực hiện 3 parallel aggregations (avg rating, breakdown by rating, photo count)
- `averageRating` làm tròn 1 chữ số thập phân
- `breakdown` luôn trả về đầy đủ 5 mức (1-5 sao), giá trị 0 nếu không có

**Performance:** < 300ms (p95)

**Error Responses:**
```json
// 404 - Product not found
{
  "success": false,
  "error": "Sản phẩm không tồn tại"
}
```

---

### 1.2 Danh sách đánh giá

Lấy danh sách đánh giá đã được duyệt của sản phẩm với bộ lọc và phân trang.

**Endpoint:** `GET /api/products/:slug/reviews`

**Authentication:** Không yêu cầu

**Query Parameters:**
| Parameter | Type | Description | Values |
|-----------|------|-------------|---------|
| rating | string | Lọc theo số sao | "1" \| "2" \| "3" \| "4" \| "5" |
| hasPhoto | string | Chỉ review có ảnh | "true" |
| sort | string | Sắp xếp | "newest" (mặc định) \| "helpful" |
| page | string | Trang hiện tại | Mặc định: "1" |
| limit | string | Số item/trang | Mặc định: "10", Max: 100 |

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "uuid",
        "rating": 5,
        "content": "Sản phẩm tuyệt vời!",
        "replyContent": "Cảm ơn bạn đã đánh giá!",
        "repliedAt": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-10T08:00:00Z",
        "orderItem": {
          "color": "Đen",
          "storage": "128GB",
          "ram": "8GB",
          "sku": "IP15-128-BLK"
        },
        "user": {
          "id": "uuid",
          "fullName": "Nguyễn Văn A",
          "avatarUrl": "https://..."
        },
        "photos": [
          {
            "id": "uuid",
            "url": "https://res.cloudinary.com/..."
          }
        ],
        "_count": {
          "helpful": 12
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalPages": 16,
      "totalItems": 156,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Business Logic:**
- Chỉ trả về review có `status = APPROVED`
- Mặc định sắp xếp theo `createdAt DESC` (mới nhất trước)
- Khi `sort = helpful`, sắp xếp theo số lượng vote hữu ích giảm dần
- Phân trang với metadata đầy đủ

**Performance:** < 200ms (p95)

**Error Responses:**
```json
// 404 - Product not found
{
  "success": false,
  "error": "Sản phẩm không tồn tại"
}

// 400 - Invalid pagination
{
  "success": false,
  "error": "Page và limit phải là số nguyên dương"
}
```

---

## 2. User Endpoints

### 2.1 Lấy danh sách sản phẩm cần đánh giá

Lấy danh sách các OrderItem đã giao nhưng chưa được đánh giá.

**Endpoint:** `GET /api/users/me/reviews/pending`

**Authentication:** Bắt buộc (Role: CUSTOMER+)

**Query Parameters:** Không có

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "order-item-uuid",
      "productName": "iPhone 15 Pro Max",
      "sku": "IP15-256-TIT",
      "color": "Titanium Black",
      "storage": "256GB",
      "ram": "8GB",
      "unitPrice": 34990000,
      "quantity": 1,
      "order": {
        "id": "order-uuid",
        "orderCode": "ORD-2024-001234",
        "updatedAt": "2024-01-10T15:30:00Z"
      },
      "variant": {
        "product": {
          "slug": "iphone-15-pro-max",
          "images": [
            {
              "url": "https://res.cloudinary.com/..."
            }
          ]
        }
      }
    }
  ]
}
```

**Business Logic:**
- Chỉ trả về OrderItem thuộc Orders có `status = DELIVERED`
- Chỉ OrderItem chưa có review (`review IS NULL`)
- Sắp xếp theo `order.updatedAt DESC` (đơn hàng mới giao trước)
- Bao gồm thông tin variant để hiển thị chính xác cấu hình đã mua

**Performance:** < 200ms (p95)

**Error Responses:**
```json
// 401 - Not authenticated
{
  "success": false,
  "error": "Bạn cần đăng nhập để tiếp tục"
}

// 403 - Insufficient permissions
{
  "success": false,
  "error": "Bạn không có quyền thực hiện hành động này"
}
```

---

### 2.2 Lấy danh sách đánh giá của tôi

Lấy tất cả đánh giá của user hiện tại với phân trang.

**Endpoint:** `GET /api/users/me/reviews`

**Authentication:** Bắt buộc (Role: CUSTOMER+)

**Query Parameters:**
| Parameter | Type | Description | Values |
|-----------|------|-------------|---------|
| page | string | Trang hiện tại | Mặc định: "1" |
| limit | string | Số item/trang | Mặc định: "10", Max: 100 |

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review-uuid",
        "rating": 5,
        "content": "Rất hài lòng!",
        "status": "APPROVED",
        "createdAt": "2024-01-10T08:00:00Z",
        "updatedAt": "2024-01-10T08:00:00Z",
        "photos": [
          {
            "id": "uuid",
            "url": "https://res.cloudinary.com/..."
          }
        ],
        "product": {
          "name": "iPhone 15 Pro Max",
          "slug": "iphone-15-pro-max",
          "images": [
            {
              "url": "https://res.cloudinary.com/..."
            }
          ]
        },
        "orderItem": {
          "color": "Titanium Black",
          "storage": "256GB",
          "ram": "8GB"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalPages": 2,
      "totalItems": 15,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Business Logic:**
- Trả về TẤT CẢ review của user (bao gồm cả PENDING, APPROVED, REJECTED)
- Sắp xếp theo `createdAt DESC` (mới nhất trước)
- Bao gồm thông tin product và orderItem để hiển thị đầy đủ ngữ cảnh

**Performance:** < 200ms (p95)

**Error Responses:**
```json
// 401 - Not authenticated
{
  "success": false,
  "error": "Bạn cần đăng nhập để tiếp tục"
}

// 400 - Invalid pagination
{
  "success": false,
  "error": "Page và limit phải là số nguyên dương"
}
```

---

### 2.3 Tạo đánh giá mới

Tạo đánh giá cho một OrderItem đã giao.

**Endpoint:** `POST /api/order-items/:orderItemId/review`

**Authentication:** Bắt buộc (Role: CUSTOMER+)

**Content-Type:** `multipart/form-data`

**Form Data:**
| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| rating | number | Yes | Số sao đánh giá | Integer, 1-5 |
| content | string | Yes | Nội dung đánh giá | 10-2000 ký tự |
| photos | file[] | No | Hình ảnh đính kèm | Max 5 files, JPG/PNG/WebP, 5MB mỗi file |

**Request Example (cURL):**
```bash
curl -X POST "https://api.mobivexa.com/api/order-items/order-item-uuid/review" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "rating=5" \
  -F "content=Sản phẩm rất tốt, giao hàng nhanh!" \
  -F "photos=@/path/to/photo1.jpg" \
  -F "photos=@/path/to/photo2.jpg"
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "review-uuid",
    "orderItemId": "order-item-uuid",
    "userId": "user-uuid",
    "productId": "product-uuid",
    "variantId": "variant-uuid",
    "rating": 5,
    "content": "Sản phẩm rất tốt, giao hàng nhanh!",
    "status": "APPROVED",
    "replyContent": null,
    "repliedAt": null,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "photos": [
      {
        "id": "photo-uuid",
        "url": "https://res.cloudinary.com/mobivexa/reviews/..."
      },
      {
        "id": "photo-uuid-2",
        "url": "https://res.cloudinary.com/mobivexa/reviews/..."
      }
    ]
  }
}
```

**Business Logic:**
- **Ownership check**: OrderItem PHẢI thuộc về user hiện tại
- **Order status check**: Order phải có `status = DELIVERED`
- **Duplicate check**: OrderItem chưa có review nào (mỗi OrderItem chỉ được review 1 lần)
- **Auto-approve**: Review mới được set `status = APPROVED` ngay lập tức
- **Photo upload**:
  - Max 5 photos (chỉ lấy 5 files đầu tiên nếu upload nhiều hơn)
  - Upload lên Cloudinary folder: `mobivexa/reviews/`
  - Mỗi photo có `publicId` để xóa sau này
  - Photos được sắp xếp theo thứ tự upload (`sortOrder`)

**Performance:** < 500ms (p95) - bao gồm upload ảnh

**Error Responses:**
```json
// 401 - Not authenticated
{
  "success": false,
  "error": "Bạn cần đăng nhập để tiếp tục"
}

// 404 - OrderItem not found or not delivered
{
  "success": false,
  "error": "Không tìm thấy sản phẩm trong đơn hàng đã giao"
}

// 409 - Already reviewed
{
  "success": false,
  "error": "Bạn đã đánh giá sản phẩm này rồi"
}

// 400 - Validation errors
{
  "success": false,
  "error": "Đánh giá phải từ 1 đến 5 sao"
}
// hoặc
{
  "success": false,
  "error": "Nội dung phải có ít nhất 10 ký tự"
}
// hoặc
{
  "success": false,
  "error": "Nội dung không được quá 2000 ký tự"
}

// 400 - Invalid photo format
{
  "success": false",
  "error": "Chỉ chấp nhận file ảnh (JPG, PNG, WebP)"
}

// 400 - Photo too large
{
  "success": false",
  "error": "Kích thước mỗi ảnh không được quá 5MB"
}

// 500 - Cloudinary upload failed
{
  "success": false",
  "error": "Không thể upload ảnh, vui lòng thử lại"
}
```

---

### 2.4 Cập nhật đánh giá

Cập nhật nội dung hoặc ảnh của đánh giá đã có.

**Endpoint:** `PUT /api/reviews/:id`

**Authentication:** Bắt buộc (Role: CUSTOMER+, owner only)

**Content-Type:** `multipart/form-data`

**Form Data:**
| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| rating | number | No* | Số sao đánh giá mới | Integer, 1-5 |
| content | string | No* | Nội dung mới | 10-2000 ký tự |
| photos | file[] | No | Hình ảnh mới (thay thế toàn bộ) | Max 5 files, JPG/PNG/WebP, 5MB |

**Important:**
- Ít nhất một trong `rating` hoặc `content` phải được cung cấp
- Nếu upload `photos`, TẤT CẢ ảnh cũ sẽ bị xóa và thay thế bằng ảnh mới
- Không có partial update cho photos (all-or-nothing)

**Request Example (cURL):**
```bash
# Chỉ cập nhật content
curl -X PUT "https://api.mobivexa.com/api/reviews/review-uuid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "content=Cập nhật: Sản phẩm dùng 1 tuần vẫn rất tốt!"

# Cập nhật cả rating và photos
curl -X PUT "https://api.mobivexa.com/api/reviews/review-uuid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "rating=4" \
  -F "photos=@/path/to/new-photo1.jpg" \
  -F "photos=@/path/to/new-photo2.jpg"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "review-uuid",
    "rating": 4,
    "content": "Cập nhật: Sản phẩm dùng 1 tuần vẫn rất tốt!",
    "status": "APPROVED",
    "updatedAt": "2024-01-20T14:30:00Z",
    "photos": [
      {
        "id": "new-photo-uuid",
        "url": "https://res.cloudinary.com/mobivexa/reviews/..."
      }
    ]
  }
}
```

**Business Logic:**
- **Ownership check**: Chỉ owner của review mới được cập nhật
- **Time window**: Chỉ được edit trong vòng 30 ngày kể từ ngày tạo (`createdAt`)
- **Status reset**: Khi update, `status` được reset về `APPROVED` (re-approve)
- **Photo replacement**:
  - Nếu upload photos mới: xóa ALL photos cũ trên Cloudinary + database
  - Upload photos mới và gán `sortOrder` theo thứ tự
  - Nếu KHÔNG upload photos: giữ nguyên photos cũ
- **Concurrent deletion**: Xóa ảnh cũ fire-and-forget (không đợi complete) để tối ưu performance

**Performance:** < 500ms (p95) - bao gồm upload ảnh nếu có

**Error Responses:**
```json
// 401 - Not authenticated
{
  "success": false,
  "error": "Bạn cần đăng nhập để tiếp tục"
}

// 404 - Review not found or not owner
{
  "success": false",
  "error": "Đánh giá không tồn tại"
}

// 400 - Edit window expired
{
  "success": false",
  "error": "Đã quá 30 ngày, không thể chỉnh sửa đánh giá"
}

// 400 - No fields to update
{
  "success": false",
  "error": "Không có gì để cập nhật"
}

// 400 - Validation errors
{
  "success": false",
  "error": "Đánh giá phải từ 1 đến 5 sao"
}
// hoặc
{
  "success": false",
  "error": "Nội dung phải có ít nhất 10 ký tự"
}

// 500 - Cloudinary upload failed
{
  "success": false",
  "error": "Không thể upload ảnh, vui lòng thử lại"
}
```

---

### 2.5 Xóa đánh giá của tôi

Xóa đánh giá và tất cả dữ liệu liên quan (photos, helpful votes).

**Endpoint:** `DELETE /api/reviews/:id`

**Authentication:** Bắt buộc (Role: CUSTOMER+, owner only)

**Response (204 No Content):**
```
(status line: HTTP/1.1 204 No Content)
(no body)
```

**Business Logic:**
- **Ownership check**: Chỉ owner của review mới được xóa
- **Cascade delete**: Database tự động xóa:
  - `ReviewPhoto` (onDelete: Cascade)
  - `ReviewHelpful` (onDelete: Cascade)
- **Cloudinary cleanup**: Xóa photos trên Cloudinary (fire-and-forget)
- **No undo**: Xóa là vĩnh viễn, không thể khôi phục

**Performance:** < 200ms (p95)

**Error Responses:**
```json
// 401 - Not authenticated
{
  "success": false,
  "error": "Bạn cần đăng nhập để tiếp tục"
}

// 404 - Review not found or not owner
{
  "success": false",
  "error": "Đánh giá không tồn tại"
}
```

---

### 2.6 Toggle "Hữu ích"

Đánh dấu review là hữu ích hoặc hủy đánh dấu (idempotent toggle).

**Endpoint:** `POST /api/reviews/:id/helpful`

**Authentication:** Bắt buộc (Role: CUSTOMER+)

**Request Body:** Không có (empty POST)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "helpful": true,
    "count": 13
  }
}
```

**Response khi hủy đánh dấu:**
```json
{
  "success": true,
  "data": {
    "helpful": false,
    "count": 12
  }
}
```

**Business Logic:**
- **Idempotent toggle**:
  - Nếu chưa vote: tạo bản ghi mới → `helpful: true`
  - Nếu đã vote: xóa bản ghi → `helpful: false`
- **Unique constraint**: Một user chỉ vote được 1 lần (composite unique key trên `userId + reviewId`)
- **Approved only**: Chỉ vote được cho review có `status = APPROVED`
- **Real-time count**: Trả về số lượng vote hiện tại sau khi toggle

**Performance:** < 100ms (p95)

**Error Responses:**
```json
// 401 - Not authenticated
{
  "success": false",
  "error": "Bạn cần đăng nhập để tiếp tục"
}

// 404 - Review not found or not approved
{
  "success": false",
  "error": "Đánh giá không tồn tại"
}
```

---

## 3. Admin Endpoints

### 3.1 Danh sách tất cả đánh giá

Lấy danh sách tất cả review với đầy đủ thông tin để quản lý.

**Endpoint:** `GET /api/admin/reviews`

**Authentication:** Bắt buộc (Role: STAFF+)

**Query Parameters:**
| Parameter | Type | Description | Values |
|-----------|------|-------------|---------|
| status | string | Lọc theo trạng thái | "PENDING" \| "APPROVED" \| "REJECTED" |
| rating | string | Lọc theo số sao | "1" \| "2" \| "3" \| "4" \| "5" |
| productId | string | Lọc theo sản phẩm | UUID |
| page | string | Trang hiện tại | Mặc định: "1" |
| limit | string | Số item/trang | Mặc định: "10", Max: 100 |

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review-uuid",
        "rating": 5,
        "content": "Sản phẩm tuyệt vời!",
        "status": "APPROVED",
        "replyContent": "Cảm ơn bạn đã đánh giá!",
        "repliedAt": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-10T08:00:00Z",
        "updatedAt": "2024-01-10T08:00:00Z",
        "orderItemId": "order-item-uuid",
        "userId": "user-uuid",
        "productId": "product-uuid",
        "variantId": "variant-uuid",
        "user": {
          "id": "user-uuid",
          "fullName": "Nguyễn Văn A",
          "email": "nguyenvana@example.com"
        },
        "product": {
          "id": "product-uuid",
          "name": "iPhone 15 Pro Max",
          "slug": "iphone-15-pro-max"
        },
        "photos": [
          {
            "id": "photo-uuid",
            "url": "https://res.cloudinary.com/..."
          }
        ],
        "_count": {
          "helpful": 12
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalPages": 16,
      "totalItems": 156,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Business Logic:**
- Trả về TẤT CẢ review (bất kể status)
- Bao gồm full user và product info (không như public endpoint)
- Đủ thông tin để hiển thị trong admin panel
- Sắp xếp theo `createdAt DESC` (mới nhất trước)

**Performance:** < 300ms (p95)

**Error Responses:**
```json
// 401 - Not authenticated
{
  "success": false,
  "error": "Bạn cần đăng nhập để tiếp tục"
}

// 403 - Not staff
{
  "success": false,
  "error": "Bạn không có quyền thực hiện hành động này"
}

// 400 - Invalid pagination
{
  "success": false,
  "error": "Page và limit phải là số nguyên dương"
}
```

---

### 3.2 Phản hồi đánh giá

Tạo hoặc cập nhật phản hồi của admin cho một review.

**Endpoint:** `POST /api/admin/reviews/:id/reply`

**Authentication:** Bắt buộc (Role: STAFF+)

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "content": "Cảm ơn bạn đã đánh giá sản phẩm! Nếu có bất kỳ câu hỏi nào, vui lòng liên hệ hỗ trợ."
}
```

**Validation:**
- `content`: string, 1-1000 ký tự, required

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "review-uuid",
    "rating": 5,
    "content": "Sản phẩm tuyệt vời!",
    "status": "APPROVED",
    "replyContent": "Cảm ơn bạn đã đánh giá sản phẩm! Nếu có bất kỳ câu hỏi nào, vui lòng liên hệ hỗ trợ.",
    "repliedAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-10T08:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "user": {
      "id": "user-uuid",
      "fullName": "Nguyễn Văn A",
      "email": "nguyenvana@example.com"
    },
    "product": {
      "id": "product-uuid",
      "name": "iPhone 15 Pro Max",
      "slug": "iphone-15-pro-max"
    },
    "photos": [
      {
        "id": "photo-uuid",
        "url": "https://res.cloudinary.com/..."
      }
    ],
    "_count": {
      "helpful": 12
    }
  }
}
```

**Business Logic:**
- **Overwrite**: Nếu đã có reply trước đó, sẽ bị GHI ĐÈ hoàn toàn
- **Auto timestamp**: `repliedAt` được set đến thời điểm hiện tại
- **Full entity return**: Trả về full review với admin include để FE replace cả row trong list
- **No notification**: Không gửi notification cho user (có thể thêm sau nếu cần)

**Performance:** < 200ms (p95)

**Error Responses:**
```json
// 401 - Not authenticated
{
  "success": false",
  "error": "Bạn cần đăng nhập để tiếp tục"
}

// 403 - Not staff
{
  "success": false",
  "error": "Bạn không có quyền thực hiện hành động này"
}

// 404 - Review not found
{
  "success": false",
  "error": "Đánh giá không tồn tại"
}

// 400 - Validation errors
{
  "success": false",
  "error": "Nội dung phải có ít nhất 1 ký tự"
}
// hoặc
{
  "success": false",
  "error": "Nội dung không được quá 1000 ký tự"
}
```

---

### 3.3 Xóa bất kỳ đánh giá nào

Xóa một review bất kỳ (không cần ownership check).

**Endpoint:** `DELETE /api/admin/reviews/:id`

**Authentication:** Bắt buộc (Role: STAFF+)

**Response (204 No Content):**
```
(status line: HTTP/1.1 204 No Content)
(no body)
```

**Business Logic:**
- **No ownership check**: Admin có thể xóa review của bất kỳ user nào
- **Cascade delete**: Tự động xóa photos, helpful votes
- **Cloudinary cleanup**: Xóa photos trên Cloudinary (fire-and-forget)
- **No undo**: Xóa là vĩnh viễn
- **Audit trail**: Nên log ai đã xóa review nào (không implement trong scope này)

**Performance:** < 200ms (p95)

**Error Responses:**
```json
// 401 - Not authenticated
{
  "success": false",
  "error": "Bạn cần đăng nhập để tiếp tục"
}

// 403 - Not staff
{
  "success": false",
  "error": "Bạn không có quyền thực hiện hành động này"
}

// 404 - Review not found
{
  "success": false",
  "error": "Đánh giá không tồn tại"
}
```

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Bạn cần đăng nhập để tiếp tục"
}
```
**Triggers**: JWT token missing, expired, or invalid

### 403 Forbidden
```json
{
  "success": false,
  "error": "Bạn không có quyền thực hiện hành động này"
}
```
**Triggers**: Role insufficient (e.g., CUSTOMER accessing admin endpoint)

### 404 Not Found
```json
{
  "success": false,
  "error": "Đánh giá không tồn tại"
}
```
**Triggers**: Review ID not found OR not owner (for user endpoints)

### 400 Bad Request
```json
{
  "success": false,
  "error": "Error message here"
}
```
**Triggers**: Validation errors, business logic violations

### 409 Conflict
```json
{
  "success": false,
  "error": "Bạn đã đánh giá sản phẩm này rồi"
}
```
**Triggers**: Trying to create duplicate review

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Đã có lỗi xảy ra, vui lòng thử lại sau"
}
```
**Triggers**: Unexpected errors (database failures, Cloudinary errors, etc.)

---

## Data Models

### Review (Database Schema)
```typescript
interface Review {
  id: string                    // UUID
  orderItemId: string           // Unique (1 orderItem = 1 review)
  userId: string
  productId: string
  variantId: string | null      // Variant đã mua
  rating: number                // 1-5
  content: string
  status: ReviewStatus          // PENDING | APPROVED | REJECTED
  replyContent: string | null   // Admin reply
  repliedAt: Date | null
  createdAt: Date
  updatedAt: Date

  // Relations
  orderItem: OrderItem
  user: User
  product: Product
  photos: ReviewPhoto[]
  helpful: ReviewHelpful[]
}

enum ReviewStatus {
  PENDING = 'PENDING',      // Chờ duyệt (not used currently - auto-approve)
  APPROVED = 'APPROVED',    // Đã duyệt
  REJECTED = 'REJECTED'     // Từ chối (not used currently - auto-approve)
}
```

### ReviewPhoto
```typescript
interface ReviewPhoto {
  id: string          // UUID
  reviewId: string
  url: string         // Cloudinary URL
  publicId: string   // Cloudinary public ID (for deletion)
  sortOrder: number  // 0-indexed, display order

  review: Review
}
```

### ReviewHelpful
```typescript
interface ReviewHelpful {
  userId: string      // Composite unique key with reviewId
  reviewId: string

  user: User
  review: Review
}
```

---

## Photo Upload Specifications

### Supported Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)

### Size Limits
- **Max file size**: 5MB per photo
- **Max photos per review**: 5 photos
- **Total upload size**: Up to 25MB per request (5 × 5MB)

### Cloudinary Configuration
- **Folder**: `mobivexa/reviews/`
- **Naming**: Auto-generated unique ID with timestamp
- **Transformation**: None currently (can add later: resize, compress)

### Storage Strategy
- **Public URLs**: Photos are publicly accessible via Cloudinary CDN
- **Cleanup**: Automatic deletion when:
  - Review is deleted (cascade)
  - Review is updated with new photos (old ones deleted)

---

## Security Considerations

### Ownership & Access Control
1. **Verified Purchase Only**
   - Chỉ user đã mua sản phẩm (DELIVERED) mới được review
   - 1 OrderItem = 1 Review (không review lại nhiều lần)
   - OrderItem phải thuộc về user hiện tại

2. **Owner-Only Operations**
   - Update, delete: chỉ owner của review
   - Toggle helpful: bất kỳ customer nào cũng được

3. **Admin Privileges**
   - List all reviews: STAFF+
   - Reply: STAFF+
   - Delete any: STAFF+ (no ownership check)

### Data Protection
1. **User Privacy**
   - Public endpoints chỉ trả về `fullName` và `avatarUrl` (không có email)
   - Admin endpoints có `email` (chỉ STAFF+ thấy được)

2. **Photo Safety**
   - All photos uploaded to secure Cloudinary account
   - Public ID mapping to prevent unauthorised access
   - Automatic cleanup on deletion

3. **Rate Limiting** (Recommended implementation)
   - Create review: 10 requests per 15 minutes per user
   - Update review: 20 requests per 15 minutes per user
   - Toggle helpful: 30 requests per 15 minutes per user
   - Public endpoints: 100 requests per 15 minutes per IP

---

## Validation Rules Summary

### Rating
```typescript
rating: number
- Type: integer
- Range: 1-5
- Required for: create, optional for update
```

### Content
```typescript
content: string
- Create: 10-2000 characters, required, trimmed
- Update: 10-2000 characters, optional, trimmed
- Reply: 1-1000 characters, required, trimmed
```

### Photos
```typescript
photos: File[]
- Max count: 5 files
- Max size per file: 5MB
- Allowed formats: JPG, PNG, WebP
- Required: no (optional field)
```

### Query Parameters
```typescript
// Common pagination
page: number    // >= 1, default: 1
limit: number   // 1-100, default: 10

// Review list filters
rating: '1' | '2' | '3' | '4' | '5'
hasPhoto: 'true'
sort: 'newest' | 'helpful'

// Admin filters
status: 'PENDING' | 'APPROVED' | 'REJECTED'
productId: UUID (string format)
```

---

## cURL Examples

### Public: Get review summary
```bash
curl -X GET "https://api.mobivexa.com/api/products/iphone-15-pro-max/reviews/summary"
```

### Public: List reviews with filters
```bash
curl -X GET "https://api.mobivexa.com/api/products/iphone-15-pro-max/reviews?rating=5&hasPhoto=true&sort=helpful&page=1&limit=10"
```

### User: Get pending reviews
```bash
curl -X GET "https://api.mobivexa.com/api/users/me/reviews/pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### User: Create review with photos
```bash
curl -X POST "https://api.mobivexa.com/api/order-items/order-item-uuid/review" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "rating=5" \
  -F "content=Sản phẩm rất tốt, giao hàng nhanh!" \
  -F "photos=@/path/to/photo1.jpg" \
  -F "photos=@/path/to/photo2.jpg"
```

### User: Update review
```bash
curl -X PUT "https://api.mobivexa.com/api/reviews/review-uuid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "content=Cập nhật: Dùng 1 tuần vẫn rất tốt!" \
  -F "photos=@/path/to/new-photo.jpg"
```

### User: Delete own review
```bash
curl -X DELETE "https://api.mobivexa.com/api/reviews/review-uuid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### User: Toggle helpful
```bash
curl -X POST "https://api.mobivexa.com/api/reviews/review-uuid/helpful" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Admin: List all reviews
```bash
curl -X GET "https://api.mobivexa.com/api/admin/reviews?status=APPROVED&page=1&limit=20" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

### Admin: Reply to review
```bash
curl -X POST "https://api.mobivexa.com/api/admin/reviews/review-uuid/reply" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Cảm ơn bạn đã đánh giá!"}'
```

### Admin: Delete any review
```bash
curl -X DELETE "https://api.mobivexa.com/api/admin/reviews/review-uuid" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

---

## Postman Collection Example

### Environment Variables
```javascript
{
  "base_url": "https://api.mobivexa.com",
  "user_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "product_slug": "iphone-15-pro-max",
  "order_item_id": "uuid-of-order-item",
  "review_id": "uuid-of-review"
}
```

### Collection Structure
```
Mobivexa Review API
├── Public
│   ├── Get Review Summary
│   └── List Reviews
├── User (Authenticated)
│   ├── Get Pending Reviews
│   ├── Get My Reviews
│   ├── Create Review (with file upload)
│   ├── Update Review (with file upload)
│   ├── Delete Review
│   └── Toggle Helpful
└── Admin (Staff+)
    ├── List All Reviews
    ├── Reply to Review
    └── Delete Any Review
```

---

## Performance Targets

| Endpoint | Target (p95) | Notes |
|----------|-------------|-------|
| GET /products/:slug/reviews/summary | < 300ms | 3 parallel aggregations |
| GET /products/:slug/reviews | < 200ms | Paginated, indexed query |
| GET /users/me/reviews/pending | < 200ms | Single user query |
| GET /users/me/reviews | < 200ms | Paginated, user-scoped |
| POST /order-items/:id/review | < 500ms | Includes photo uploads |
| PUT /reviews/:id | < 500ms | Includes photo uploads |
| DELETE /reviews/:id | < 200ms | Cascade delete |
| POST /reviews/:id/helpful | < 100ms | Simple upsert |
| GET /admin/reviews | < 300ms | Full data, paginated |
| POST /admin/reviews/:id/reply | < 200ms | Single record update |
| DELETE /admin/reviews/:id | < 200ms | Cascade delete |

---

## Future Enhancements

### Not Currently Implemented
1. **Review Moderation Workflow**
   - PENDING → APPROVED/REJECTED by admin
   - Currently: auto-approve all reviews (status = APPROVED)

2. **Helpful Vote Algorithm**
   - Sort by "most helpful" could use weighted algorithm
   - Currently: simple count sort

3. **Photo Moderation**
   - Flag inappropriate photos
   - Currently: no moderation

4. **Edit History**
   - Track all changes to review
   - Currently: no audit trail

5. **Notifications**
   - Notify user when admin replies
   - Currently: no notification system

6. **Rich Content**
   - Support video reviews
   - Support formatted text (markdown)
   - Currently: plain text only

### Scalability Considerations
1. **Caching Strategy**
   - Cache review summary (invalidated on new review)
   - Cache top reviews for product page
   - TTL: 5-15 minutes

2. **Database Optimization**
   - Composite index on (productId, status, createdAt) for list
   - Composite index on (userId, createdAt) for my reviews
   - Consider materialized view for summary stats

3. **CDN Caching**
   - Cache public endpoints at CDN level
   - Cache headers: Cache-Control: public, max-age=300

---

## Support & Troubleshooting

### Common Issues

**Issue: Upload photo fails**
- **Cause**: File too large or invalid format
- **Solution**: Check file size < 5MB, format is JPG/PNG/WebP

**Issue: Cannot edit review**
- **Cause**: Edit window expired (30 days)
- **Solution**: Delete and recreate review (contact support if needed)

**Issue: Helpful toggle doesn't work**
- **Cause**: Already voted, trying to vote again
- **Solution**: Toggle again to remove vote

**Issue: Admin reply not showing**
- **Cause**: Cache not invalidated
- **Solution**: Wait for cache TTL or force refresh

### Contact
For API issues, contact: api-support@mobivexa.com

---

**Document Version:** 1.0.0  
**Last Updated:** 2024-01-15  
**Maintained By:** Backend Team, Mobivexa