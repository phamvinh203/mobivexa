# Sequence Diagram - Review Module

**Version**: 1.0  
**Ngày**: 2025-06-20  
**Module**: Review System  
**Database**: PostgreSQL (Prisma ORM)  
**Storage**: Cloudinary

---

## 📋 Mục lục

1. [View Review Summary](#1-view-review-summary)
2. [List Reviews](#2-list-reviews)
3. [Create Review](#3-create-review)
4. [Update Review](#4-update-review)
5. [Toggle Helpful](#5-toggle-helpful)
6. [Admin Reply Review](#6-admin-reply-review)
7. [Common Patterns](#common-patterns)
8. [Testing Checklist](#testing-checklist)

---

## 1. View Review Summary

**Endpoint**: `GET /api/products/:slug/reviews/summary`  
**Access**: Public  
**Purpose**: Hiển thị thống kê đánh giá trên trang product detail

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Public as 👤 Public User
    participant API as 🌐 API Gateway
    participant Controller as 🎮 Review Controller
    participant Service as ⚙️ Review Service
    participant Prisma as 🗄️ Prisma Client
    participant DB as 💾 Database

    Note over Public,DB: GET /api/products/:slug/reviews/summary

    Public->>API: GET /api/products/iphone-15-pro/reviews/summary
    API->>Controller: getSummary(req, res)
    Controller->>Service: getReviewSummary('iphone-15-pro')

    Note over Service,Prisma: Step 1: Find product by slug
    Service->>Prisma: prisma.product.findUnique({ where: { slug } })
    Prisma->>DB: SELECT id, name FROM products WHERE slug = 'iphone-15-pro'
    DB-->>Prisma: { id: 'prod-123', name: 'iPhone 15 Pro' }
    Prisma-->>Service: Product entity
    Service->>Service: Check if product exists, throw 404 if not

    Note over Service,Prisma: Step 2: Execute 3 parallel queries (Promise.all)
    par Query 1: Aggregate ratings
        Service->>Prisma: prisma.review.aggregate({ where: { productId, status: APPROVED }, _avg: { rating }, _count: { id } })
        Prisma->>DB: SELECT AVG(rating), COUNT(*) FROM reviews WHERE productId = 'prod-123' AND status = 'APPROVED'
        DB-->>Prisma: { _avg: { rating: 4.5 }, _count: { id: 100 } }
        Prisma-->>Service: Aggregate result
    and Query 2: Group by rating (breakdown)
        Service->>Prisma: prisma.review.groupBy({ by: ['rating'], where: { productId, status: APPROVED }, _count: { id } })
        Prisma->>DB: SELECT rating, COUNT(*) FROM reviews WHERE productId = 'prod-123' AND status = 'APPROVED' GROUP BY rating
        DB-->>Prisma: [{ rating: 5, _count: { id: 60 } }, { rating: 4, _count: { id: 25 } }, { rating: 3, _count: { id: 10 } }, { rating: 2, _count: { id: 3 } }, { rating: 1, _count: { id: 2 } }]
        Prisma-->>Service: GroupBy result
    and Query 3: Count photos
        Service->>Prisma: prisma.reviewPhoto.count({ where: { review: { productId, status: APPROVED } } })
        Prisma->>DB: SELECT COUNT(*) FROM review_photos rp JOIN reviews r ON rp.reviewId = r.id WHERE r.productId = 'prod-123' AND r.status = 'APPROVED'
        DB-->>Prisma: 75
        Prisma-->>Service: Photo count
    end

    Note over Service,Service: Step 3: Build response
    Service->>Service: Build breakdown5: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    Service->>Service: Map breakdown results to breakdown5
    Service->>Service: Calculate averageRating = aggregate._avg.rating.toFixed(1) = "4.5"
    Service->>Service: Prepare response object

    Service-->>Controller: { averageRating: 4.5, totalCount: 100, breakdown: {1: 2, 2: 3, 3: 10, 4: 25, 5: 60}, withPhotoCount: 75 }
    Controller-->>API: sendSuccess(res, data, 200)
    API-->>Public: JSON Response { averageRating: 4.5, totalCount: 100, breakdown: {...}, withPhotoCount: 75 }

    Note over Public,DB: ✅ Summary displayed on product page
```

### Observable States

| Phase | Customer sees | Database state | Logs |
|-------|--------------|----------------|------|
| Request | Loading spinner / summary skeleton | — | `[INFO] GET /api/products/:slug/reviews/summary` |
| Product not found | 404 error page | — | `[ERROR] Product not found: slug=xxx` |
| Success | Star rating + breakdown counts | `products` table queried | `[INFO] Summary fetched: productId=prod-123, avgRating=4.5` |

### Error Responses

| Scenario | HTTP Code | Response body |
|----------|-----------|---------------|
| Product not found | 404 | `{ "ok": false, "error": "Sản phẩm không tồn tại" }` |
| Database connection failed | 500 | `{ "ok": false, "error": "Lỗi hệ thống" }` |

---

## 2. List Reviews

**Endpoint**: `GET /api/products/:slug/reviews`  
**Access**: Public  
**Purpose**: Lấy danh sách đánh giá có phân trang và lọc

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Public as 👤 Public User
    participant API as 🌐 API Gateway
    participant Controller as 🎮 Review Controller
    participant Service as ⚙️ Review Service
    participant Prisma as 🗄️ Prisma Client
    participant DB as 💾 Database

    Note over Public,DB: GET /api/products/:slug/reviews?rating=5&hasPhoto=true&sort=newest&page=1&limit=10

    Public->>API: GET /api/products/iphone-15-pro/reviews?rating=5&hasPhoto=true&sort=newest&page=1&limit=10
    API->>Controller: list(req, res)
    Controller->>Service: listReviews('iphone-15-pro', query)

    Note over Service,Prisma: Step 1: Find product by slug
    Service->>Prisma: prisma.product.findUnique({ where: { slug } })
    Prisma->>DB: SELECT id FROM products WHERE slug = 'iphone-15-pro'
    DB-->>Prisma: { id: 'prod-123' }
    Prisma-->>Service: Product entity

    Note over Service,Service: Step 2: Build WHERE clause
    Service->>Service: where = { productId: 'prod-123', status: APPROVED }
    alt query.rating = '5'
        Service->>Service: where.rating = 5
    end
    alt query.hasPhoto = 'true'
        Service->>Service: where.photos = { some: {} }
    end

    Note over Service,Service: Step 3: Determine ORDER BY
    alt query.sort = 'helpful'
        Service->>Service: orderBy = { helpful: { _count: 'desc' } }
    else default / query.sort = 'newest'
        Service->>Service: orderBy = { createdAt: 'desc' }
    end

    Note over Service,Service: Step 4: Calculate pagination
    Service->>Service: parsePagination({ page: '1', limit: '10' })
    Service->>Service: skip = (1 - 1) * 10 = 0, take = 10

    Note over Service,Prisma: Step 5: Execute queries in parallel
    par Query reviews
        Service->>Prisma: prisma.review.findMany({ where, orderBy, skip: 0, take: 10, select: REVIEW_PUBLIC_SELECT })
        Note over Prisma: SELECT with includes: user, orderItem, photos, _count.helpful
        Prisma->>DB: Complex JOIN query with all relations
        DB-->>Prisma: Array<Review> with all relations
        Prisma-->>Service: Reviews array
    and Count total
        Service->>Prisma: prisma.review.count({ where })
        Prisma->>DB: SELECT COUNT(*) FROM reviews WHERE productId = 'prod-123' AND status = 'APPROVED' AND rating = 5 AND EXISTS (SELECT 1 FROM review_photos WHERE reviewId = reviews.id)
        DB-->>Prisma: 50
        Prisma-->>Service: Total count
    end

    Note over Service,Service: Step 6: Build pagination metadata
    Service->>Service: paginationMeta(page=1, limit=10, total=50)
    Service->>Service: { currentPage: 1, totalPages: 5, totalItems: 50, itemsPerPage: 10, hasNext: true, hasPrev: false }

    Service-->>Controller: { reviews: [...], pagination: {...} }
    Controller-->>API: sendSuccess(res, data, 200)
    API-->>Public: JSON Response with reviews array + pagination metadata

    Note over Public,DB: ✅ Reviews list displayed with filters applied
```

### Observable States

| Phase | Customer sees | Database state | Logs |
|-------|--------------|----------------|------|
| Request | Loading skeleton for reviews list | — | `[INFO] GET /api/products/:slug/reviews with query` |
| Product not found | 404 error page | — | `[ERROR] Product not found` |
| Success | Reviews cards with photos, helpful count, pagination controls | `reviews` table queried with JOINs | `[INFO] Reviews fetched: productId=prod-123, count=10, total=50` |

### Error Responses

| Scenario | HTTP Code | Response body |
|----------|-----------|---------------|
| Product not found | 404 | `{ "ok": false, "error": "Sản phẩm không tồn tại" }` |
| Invalid pagination | 400 | `{ "ok": false, "error": "Số trang hoặc giới hạn không hợp lệ" }` |

---

## 3. Create Review

**Endpoint**: `POST /api/order-items/:orderItemId/review`  
**Access**: Customer (authenticated)  
**Purpose**: Tạo đánh giá mới cho sản phẩm đã mua

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Customer as 👤 Customer
    participant API as 🌐 API Gateway
    participant Auth as 🔐 Auth Middleware
    participant Upload as 📤 Upload Middleware
    participant Validator as ✅ Validator
    participant Controller as 🎮 Review Controller
    participant Service as ⚙️ Review Service
    participant Prisma as 🗄️ Prisma Client
    participant DB as 💾 Database
    participant Cloudinary as ☁️ Cloudinary

    Note over Customer,Cloudinary: POST /api/order-items/:orderItemId/review

    Customer->>API: POST /api/order-items/oi-123/review<br/>with photos (multipart/form-data)
    API->>Auth: authenticate(req, res, next)
    Auth->>Auth: Verify JWT token from header
    Auth-->>API: req.user = { userId: 'user-456' }
    API->>Upload: uploadImage.array('photos', 5)
    Upload-->>API: req.files = [Buffer, Buffer, ...] (max 5 photos)
    API->>Validator: validateCreateReview(req, res, next)
    Validator->>Validator: Check rating: 1-5 integer
    Validator->>Validator: Check content: required, min 10 chars, max 2000 chars
    alt Validation fails
        Validator-->>API: sendError(res, 400, '...')
        API-->>Customer: 400 Error
    end
    Validator-->>API: next() - validation passed
    API->>Controller: create(req, res)
    Controller->>Service: createReview(userId='user-456', orderItemId='oi-123', body, files)

    Note over Service,Prisma: Step 1: Find OrderItem with ownership + DELIVERED status check
    Service->>Prisma: prisma.orderItem.findFirst({<br/>  where: { id: 'oi-123', order: { userId: 'user-456', status: DELIVERED } },<br/>  include: { order: { select: { id: true } }, review: { select: { id: true } } }<br/>})
    Prisma->>DB: SELECT * FROM order_items oi JOIN orders o ON oi.orderId = o.id WHERE oi.id = 'oi-123' AND o.userId = 'user-456' AND o.status = 'DELIVERED'
    DB-->>Prisma: OrderItem with order + review
    Prisma-->>Service: OrderItem entity

    alt OrderItem not found
        Service-->>Controller: throw AppError(404, 'Không tìm thấy sản phẩm trong đơn hàng đã giao')
        Controller-->>API: sendError(res, 404, '...')
        API-->>Customer: 404 Error
    end
    alt Review already exists
        Service-->>Controller: throw AppError(409, 'Bạn đã đánh giá sản phẩm này rồi')
        Controller-->>API: sendError(res, 409, '...')
        API-->>Customer: 409 Conflict
    end

    Note over Service,Cloudinary: Step 2: Parallel operations - resolve productId + upload photos
    par Resolve productId
        Service->>Service: productIdPromise = orderItem.variantId ? findVariant() : resolveFromOrderItem()
        alt variantId exists
            Service->>Prisma: prisma.productVariant.findUnique({ where: { id: variantId }, select: { productId } })
            Prisma->>DB: SELECT productId FROM product_variants WHERE id = 'variant-789'
            DB-->>Prisma: { productId: 'prod-123' }
            Prisma-->>Service: productId = 'prod-123'
        else no variantId - fallback to SKU or product name
            Service->>Service: resolveProductIdFromOrderItem(orderItem)
            Service->>Prisma: prisma.productVariant.findUnique({ where: { sku: orderItem.sku }, select: { productId } })
            Prisma->>DB: SELECT productId FROM product_variants WHERE sku = 'IP15PRO-128-BLK'
            alt SKU found
                DB-->>Prisma: { productId: 'prod-123' }
                Prisma-->>Service: productId = 'prod-123'
            else SKU not found - fallback to product name
                Service->>Prisma: prisma.product.findFirst({ where: { name: orderItem.productName }, select: { id } })
                Prisma->>DB: SELECT id FROM products WHERE name = 'iPhone 15 Pro'
                DB-->>Prisma: { id: 'prod-123' }
                Prisma-->>Service: productId = 'prod-123'
                alt Product not found
                    Service-->>Controller: throw AppError(400, 'Không xác định được sản phẩm')
                    Controller-->>API: sendError(res, 400, '...')
                    API-->>Customer: 400 Error
                end
            end
        end
    and Upload photos to Cloudinary
        Service->>Cloudinary: Promise.all(files.map(f => uploadEntityImage(f.buffer, 'reviews')))
        loop For each photo (max 5)
            Cloudinary->>Cloudinary: upload_stream to folder 'reviews'
            Cloudinary-->>Service: { url: 'https://res.cloudinary.com/...', publicId: 'reviews/abc123' }
        end
        Service-->>Service: uploadedPhotos = [{ url, publicId }, ...]
    end
    Service->>Service: [productId, uploadedPhotos] = await Promise.all([productIdPromise, uploadPromise])

    Note over Service,Prisma: Step 3: Create review with photos
    Service->>Prisma: prisma.review.create({<br/>  data: {<br/>    orderItemId: 'oi-123',<br/>    userId: 'user-456',<br/>    productId: 'prod-123',<br/>    variantId: 'variant-789',<br/>    rating: 5,<br/>    content: 'Sản phẩm tuyệt vời!',<br/>    status: APPROVED,<br/>    photos: { create: uploadedPhotos.map((p, i) => ({ url: p.url, publicId: p.publicId, sortOrder: i })) }<br/>  },<br/>  include: { photos: true }<br/>})
    Prisma->>DB: BEGIN TRANSACTION
    Prisma->>DB: INSERT INTO reviews (orderItemId, userId, productId, variantId, rating, content, status) VALUES (...)
    DB-->>Prisma: Review created with id = 'rev-999'
    loop For each photo
        Prisma->>DB: INSERT INTO review_photos (reviewId, url, publicId, sortOrder) VALUES ('rev-999', 'https://...', 'reviews/abc123', 0)
    end
    Prisma->>DB: COMMIT
    DB-->>Prisma: Complete Review entity with photos
    Prisma-->>Service: Review with photos array

    Service-->>Controller: Review entity with photos
    Controller-->>API: sendSuccess(res, data, 201)
    API-->>Customer: 201 Created { id, rating, content, photos: [...], createdAt, ... }

    Note over Customer,Cloudinary: ✅ Review created and displayed on product page
```

### Observable States

| Phase | Customer sees | Database state | Cloudinary state |
|-------|--------------|----------------|------------------|
| Upload progress | Progress bar for each photo | — | Photos uploading to 'reviews' folder |
| Validation | Inline errors if invalid | — | — |
| Creating | "Đang gửi đánh giá..." spinner | Transaction started | Photos stored with publicIds |
| Success | "Đánh giá thành công!" toast | `reviews` + `review_photos` records created | Photos accessible via URLs |
| Error | Error message toast | No changes (transaction rolled back) | Orphaned photos cleaned manually |

### Error Responses

| Scenario | HTTP Code | Response body |
|----------|-----------|---------------|
| Not authenticated | 401 | `{ "ok": false, "error": "Vui lòng đăng nhập" }` |
| OrderItem not found / not delivered | 404 | `{ "ok": false, "error": "Không tìm thấy sản phẩm trong đơn hàng đã giao" }` |
| Already reviewed | 409 | `{ "ok": false, "error": "Bạn đã đánh giá sản phẩm này rồi" }` |
| Validation failed | 400 | `{ "ok": false, "error": "Đánh giá phải từ 1 đến 5 sao" }` |
| Product cannot be determined | 400 | `{ "ok": false, "error": "Không xác định được sản phẩm" }` |
| Cloudinary upload failed | 500 | `{ "ok": false, "error": "Lỗi khi tải ảnh lên" }` |

---

## 4. Update Review

**Endpoint**: `PUT /api/reviews/:id`  
**Access**: Customer (authenticated, ownership verified)  
**Purpose**: Chỉnh sửa đánh giá (trong 30 ngày)

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Customer as 👤 Customer
    participant API as 🌐 API Gateway
    participant Auth as 🔐 Auth Middleware
    participant Upload as 📤 Upload Middleware
    participant Validator as ✅ Validator
    participant Controller as 🎮 Review Controller
    participant Service as ⚙️ Review Service
    participant Prisma as 🗄️ Prisma Client
    participant DB as 💾 Database
    participant Cloudinary as ☁️ Cloudinary

    Note over Customer,Cloudinary: PUT /api/reviews/:id

    Customer->>API: PUT /api/reviews/rev-999<br/>with optional new photos (multipart/form-data)
    API->>Auth: authenticate(req, res, next)
    Auth->>Auth: Verify JWT token
    Auth-->>API: req.user = { userId: 'user-456' }
    API->>Upload: uploadImage.array('photos', 5)
    Upload-->>API: req.files = [Buffer, ...] (optional)
    API->>Validator: validateUpdateReview(req, res, next)
    Validator->>Validator: Check at least one field present (rating OR content)
    Validator->>Validator: Check rating: 1-5 if present
    Validator->>Validator: Check content: 10-2000 chars if present
    alt Validation fails
        Validator-->>API: sendError(res, 400, 'Không có gì để cập nhật')
        API-->>Customer: 400 Error
    end
    Validator-->>API: next()
    API->>Controller: update(req, res)
    Controller->>Service: updateReview(userId='user-456', reviewId='rev-999', body, files)

    Note over Service,Prisma: Step 1: Find owned review with photos
    Service->>Prisma: prisma.review.findFirst({ where: { id: 'rev-999', userId: 'user-456' }, include: { photos: true } })
    Prisma->>DB: SELECT * FROM reviews WHERE id = 'rev-999' AND userId = 'user-456'
    DB-->>Prisma: Review with photos array
    Prisma-->>Service: Review entity

    alt Review not found
        Service-->>Controller: throw AppError(404, 'Đánh giá không tồn tại')
        Controller-->>API: sendError(res, 404, '...')
        API-->>Customer: 404 Error
    end

    Note over Service,Service: Step 2: Validate 30-day window
    Service->>Service: daysSinceCreation = Date.now() - review.createdAt.getTime()
    Service->>Service: EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 (30 days)
    alt daysSinceCreation > EDIT_WINDOW_MS
        Service-->>Controller: throw AppError(400, 'Đã quá 30 ngày, không thể chỉnh sửa đánh giá')
        Controller-->>API: sendError(res, 400, '...')
        API-->>Customer: 400 Error
    end

    Note over Service,Service: Step 3: Prepare update data
    Service->>Service: data = { status: APPROVED }
    alt body.rating !== undefined
        Service->>Service: data.rating = body.rating
    end
    alt body.content !== undefined
        Service->>Service: data.content = body.content.trim()
    end

    alt New photos provided
        Note over Service,Cloudinary: Step 4a: Upload new photos AND delete old photos (parallel)
        par Upload new photos
            Service->>Cloudinary: Promise.all(files.map(f => uploadEntityImage(f.buffer, 'reviews')))
            loop For each photo
                Cloudinary->>Cloudinary: upload_stream to folder 'reviews'
                Cloudinary-->>Service: { url, publicId }
            end
            Service-->>Service: uploaded = [{ url, publicId }, ...]
        and Delete old photos (fire-and-forget)
            loop For each old photo
                Service->>Cloudinary: destroyImage(oldPhoto.publicId)
                Cloudinary->>Cloudinary: uploader.destroy(publicId)
                Note over Cloudinary: Errors ignored (orphan cleanup)
            end
        end
        Service->>Service: await uploadPromise
        Service->>Service: data.photos = { deleteMany: {}, create: uploaded.map((p, i) => ({ url: p.url, publicId: p.publicId, sortOrder: i })) }
    end

    Note over Service,Prisma: Step 5: Update review
    Service->>Prisma: prisma.review.update({ where: { id: 'rev-999' }, data, include: { photos: true } })
    Prisma->>DB: BEGIN TRANSACTION
    Prisma->>DB: UPDATE reviews SET rating = ?, content = ?, status = 'APPROVED', updatedAt = NOW() WHERE id = 'rev-999'
    alt New photos provided
        Prisma->>DB: DELETE FROM review_photos WHERE reviewId = 'rev-999'
        loop For each new photo
            Prisma->>DB: INSERT INTO review_photos (reviewId, url, publicId, sortOrder) VALUES ('rev-999', 'https://...', 'reviews/xyz', 0)
        end
    end
    Prisma->>DB: COMMIT
    DB-->>Prisma: Updated Review with photos
    Prisma-->>Service: Review entity

    Service-->>Controller: Review entity
    Controller-->>API: sendSuccess(res, data, 200)
    API-->>Customer: 200 OK { id, rating, content, photos: [...], updatedAt, ... }

    Note over Customer,Cloudinary: ✅ Review updated, old photos replaced
```

### Observable States

| Phase | Customer sees | Database state | Cloudinary state |
|-------|--------------|----------------|------------------|
| Upload | Progress bar for new photos | — | New photos uploading |
| Validation | Inline errors | — | — |
| Window check | Loading state | — | — |
| Updating | "Đang cập nhật..." spinner | Transaction started | Old photos deleted (fire-and-forget) |
| Success | "Cập nhật thành công!" toast | `reviews` record updated, `review_photos` replaced | New photos stored, old ones deleted |
| Error (30-day exceeded) | "Đã quá 30 ngày, không thể chỉnh sửa" error | No changes | No changes |

### Error Responses

| Scenario | HTTP Code | Response body |
|----------|-----------|---------------|
| Not authenticated | 401 | `{ "ok": false, "error": "Vui lòng đăng nhập" }` |
| Review not found / not owned | 404 | `{ "ok": false, "error": "Đánh giá không tồn tại" }` |
| 30-day window exceeded | 400 | `{ "ok": false, "error": "Đã quá 30 ngày, không thể chỉnh sửa đánh giá" }` |
| Validation failed | 400 | `{ "ok": false, "error": "Không có gì để cập nhật" }` |

---

## 5. Toggle Helpful

**Endpoint**: `POST /api/reviews/:id/helpful`  
**Access**: Customer (authenticated)  
**Purpose**: Đánh giá review là "hữu ích" hoặc bỏ đánh giá

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Customer as 👤 Customer
    participant API as 🌐 API Gateway
    participant Auth as 🔐 Auth Middleware
    participant Controller as 🎮 Review Controller
    participant Service as ⚙️ Review Service
    participant Prisma as 🗄️ Prisma Client
    participant DB as 💾 Database

    Note over Customer,DB: POST /api/reviews/:id/helpful

    Customer->>API: POST /api/reviews/rev-999/helpful
    API->>Auth: authenticate(req, res, next)
    Auth->>Auth: Verify JWT token
    Auth-->>API: req.user = { userId: 'user-456' }
    API->>Controller: helpful(req, res)
    Controller->>Service: toggleHelpful(userId='user-456', reviewId='rev-999')

    Note over Service,Prisma: Step 1: Parallel - find review + find existing vote
    par Find review
        Service->>Prisma: prisma.review.findUnique({ where: { id: 'rev-999' }, select: { id: true, status: true } })
        Prisma->>DB: SELECT id, status FROM reviews WHERE id = 'rev-999'
        DB-->>Prisma: { id: 'rev-999', status: 'APPROVED' }
        Prisma-->>Service: Review entity
    and Find existing vote
        Service->>Prisma: prisma.reviewHelpful.findUnique({ where: { userId_reviewId: { userId: 'user-456', reviewId: 'rev-999' } } })
        Prisma->>DB: SELECT * FROM review_helpful WHERE userId = 'user-456' AND reviewId = 'rev-999'
        DB-->>Prisma: null OR existing vote record
        Prisma-->>Service: Vote entity OR null
    end
    Service->>Service: [review, existing] = await Promise.all([...])

    alt Review not found OR status != APPROVED
        Service-->>Controller: throw AppError(404, 'Đánh giá không tồn tại')
        Controller-->>API: sendError(res, 404, '...')
        API-->>Customer: 404 Error
    end

    Note over Service,Prisma: Step 2: Toggle - delete if exists, create if not
    alt existing vote found (user voted before)
        Service->>Prisma: prisma.reviewHelpful.delete({ where: { userId_reviewId: { userId: 'user-456', reviewId: 'rev-999' } } })
        Prisma->>DB: DELETE FROM review_helpful WHERE userId = 'user-456' AND reviewId = 'rev-999'
        DB-->>Prisma: Delete successful
        Prisma-->>Service: Confirmation
        Service->>Service: action = 'removed'
    else no existing vote (first time voting)
        Service->>Prisma: prisma.reviewHelpful.create({ data: { userId: 'user-456', reviewId: 'rev-999' } })
        Prisma->>DB: INSERT INTO review_helpful (userId, reviewId) VALUES ('user-456', 'rev-999')
        DB-->>Prisma: Vote created
        Prisma-->>Service: Vote entity
        Service->>Service: action = 'added'
    end

    Note over Service,Prisma: Step 3: Count total helpful votes
    Service->>Prisma: prisma.review.findUnique({ where: { id: 'rev-999' }, select: { _count: { select: { helpful: true } } } })
    Prisma->>DB: SELECT COUNT(*) FROM review_helpful WHERE reviewId = 'rev-999'
    DB-->>Prisma: { _count: { helpful: 42 } }
    Prisma-->>Service: Count result

    Service-->>Controller: { helpful: boolean (true=added, false=removed), count: 42 }
    Controller-->>API: sendSuccess(res, data, 200)
    API-->>Customer: 200 OK { helpful: true, count: 42 }

    Note over Customer,DB: ✅ Helpful count updated, button state toggled
```

### Observable States

| Phase | Customer sees | Database state |
|-------|--------------|----------------|
| Loading | Button shows loading state | — |
| Toggling ON | "Đánh giá hữu ích" button active, count increases | `review_helpful` record created |
| Toggling OFF | Button inactive, count decreases | `review_helpful` record deleted |
| Review not approved | 404 error (review hidden) | — |

### Error Responses

| Scenario | HTTP Code | Response body |
|----------|-----------|---------------|
| Not authenticated | 401 | `{ "ok": false, "error": "Vui lòng đăng nhập" }` |
| Review not found / not approved | 404 | `{ "ok": false, "error": "Đánh giá không tồn tại" }` |

---

## 6. Admin Reply Review

**Endpoint**: `POST /api/admin/reviews/:id/reply`  
**Access**: Admin/Staff (authenticated + authorized)  
**Purpose**: Admin trả lời đánh giá của khách hàng

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Admin as 👤 Admin
    participant API as 🌐 API Gateway
    participant Auth as 🔐 Auth Middleware
    participant Authorize as 🛡️ Authorize Middleware
    participant Validator as ✅ Validator
    participant Controller as 🎮 Review Controller
    participant Service as ⚙️ Review Service
    participant Prisma as 🗄️ Prisma Client
    participant DB as 💾 Database

    Note over Admin,DB: POST /api/admin/reviews/:id/reply

    Admin->>API: POST /api/admin/reviews/rev-999/reply<br/>Body: { content: 'Cảm ơn bạn đã đánh giá!' }
    API->>Auth: authenticate(req, res, next)
    Auth->>Auth: Verify JWT token
    Auth-->>API: req.user = { userId: 'admin-789', role: 'ADMIN' }
    API->>Authorize: authorize(...STAFF_ROLES)
    Authorize->>Authorize: Check if req.user.role in [ADMIN, STAFF]
    Authorize-->>API: next() - authorized
    API->>Validator: validateReplyReview(req, res, next)
    Validator->>Validator: Check content: required, min 1 char, max 1000 chars
    alt Validation fails
        Validator-->>API: sendError(res, 400, 'Nội dung phải từ 1-1000 ký tự')
        API-->>Admin: 400 Error
    end
    Validator-->>API: next()
    API->>Controller: adminReply(req, res)
    Controller->>Service: replyReview(reviewId='rev-999', content='Cảm ơn bạn đã đánh giá!')

    Note over Service,Prisma: Step 1: Update review with reply
    Service->>Prisma: prisma.review.update({<br/>  where: { id: 'rev-999' },<br/>  data: { replyContent: 'Cảm ơn bạn đã đánh giá!', repliedAt: new Date() },<br/>  include: REVIEW_ADMIN_INCLUDE<br/>})
    Note over Service: REVIEW_ADMIN_INCLUDE includes:<br/>- user (select: id, fullName, email)<br/>- product (select: id, name, slug)<br/>- photos (orderBy: sortOrder)<br/>- _count.helpful
    Prisma->>DB: BEGIN TRANSACTION
    Prisma->>DB: UPDATE reviews SET replyContent = 'Cảm ơn bạn đã đánh giá!', repliedAt = NOW() WHERE id = 'rev-999'
    DB-->>Prisma: Update confirmation
    Prisma->>DB: SELECT with all includes (user, product, photos, _count)
    DB-->>Prisma: Full Review entity with all relations
    Prisma->>DB: COMMIT
    Prisma-->>Service: Review entity with all admin includes

    alt Review not found (P2025 error)
        Prisma-->>Service: Prisma error with code = 'P2025'
        Service-->>Controller: throw AppError(404, 'Đánh giá không tồn tại')
        Controller-->>API: sendError(res, 404, '...')
        API-->>Admin: 404 Error
    end

    Service-->>Controller: Review entity with all relations
    Controller-->>API: sendSuccess(res, data, 200)
    API-->>Admin: 200 OK { id, rating, content, replyContent, repliedAt, user: {...}, product: {...}, photos: [...], _count: { helpful: 42 } }

    Note over Admin,DB: ✅ Admin reply displayed on review detail
```

### Observable States

| Phase | Admin sees | Database state | Customer sees (on product page) |
|-------|------------|----------------|---------------------------------|
| Validation | Inline error if content invalid | — | — |
| Replying | "Đang gửi trả lời..." spinner | Transaction started | — |
| Success | "Trả lời thành công!" toast, reply visible | `reviews.replyContent` + `repliedAt` updated | Admin reply visible under review |
| Error | Error message toast | No changes | No changes |

### Error Responses

| Scenario | HTTP Code | Response body |
|----------|-----------|---------------|
| Not authenticated | 401 | `{ "ok": false, "error": "Vui lòng đăng nhập" }` |
| Not authorized (not staff/admin) | 403 | `{ "ok": false, "error": "Không có quyền truy cập" }` |
| Validation failed | 400 | `{ "ok": false, "error": "Nội dung phải từ 1-1000 ký tự" }` |
| Review not found | 404 | `{ "ok": false, "error": "Đánh giá không tồn tại" }` |

---

## Common Patterns

### 1. Authentication Pattern

```mermaid
sequenceDiagram
    participant Client as 🌐 Client
    participant Auth as 🔐 Auth Middleware
    participant Handler as ⚙️ Handler

    Client->>Auth: Request with Authorization header
    Auth->>Auth: Extract JWT token
    Auth->>Auth: Verify token signature + expiry
    alt Token invalid
        Auth-->>Client: 401 Unauthorized
    else Token valid
        Auth-->>Handler: req.user = { userId, role, ... }
        Handler-->>Client: Process request
    end
```

**Applied in**: Create, Update, Delete, Toggle Helpful, Admin operations

### 2. Ownership Verification Pattern

```mermaid
sequenceDiagram
    participant Service as ⚙️ Service
    participant Prisma as 🗄️ Prisma
    participant DB as 💾 Database

    Service->>Prisma: findFirst({ where: { id, userId } })
    Prisma->>DB: Query with userId check
    DB-->>Prisma: Record OR null
    alt Record not found
        Service-->>Service: throw AppError(404, 'Not found')
    else Record found
        Service-->>Service: Proceed with operation
    end
```

**Applied in**: Update Review, Delete Review, Find OrderItem for Create

### 3. Validation Pattern

```mermaid
sequenceDiagram
    participant Validator as ✅ Validator
    participant Next as 🔗 Next Handler

    Validator->>Validator: Check required fields present
    Validator->>Validator: Validate data types (integer rating)
    Validator->>Validator: Validate ranges (1-5 for rating, 10-2000 for content)
    Validator->>Validator: Validate business rules (at least one field for update)
    alt Validation fails
        Validator-->>Next: sendError(res, 400, message)
    else Validation passes
        Validator-->>Next: next() - pass to handler
    end
```

**Applied in**: All POST/PUT endpoints via validator middleware

### 4. Photo Management Workflow

```mermaid
graph TB
    A[Create Review] --> B{Has photos?}
    B -->|Yes| C[Upload to Cloudinary]
    B -->|No| D[Skip upload]
    C --> E[Create review with photos]
    D --> E
    E --> F[Review created]

    G[Update Review] --> H{New photos?}
    H -->|Yes| I[Upload new to Cloudinary]
    H -->|No| J[Keep existing photos]
    I --> K[Delete old from Cloudinary]
    K --> L[Replace photos in DB]
    J --> M[Update other fields]
    L --> N[Review updated]
    M --> N

    O[Delete Review] --> P[Find review with photos]
    P --> Q[Delete review from DB]
    Q --> R[Delete all photos from Cloudinary]
    R --> S[Cleanup complete]
```

**Cloudinary operations**:
- `uploadEntityImage(buffer, 'reviews')` → `{ url, publicId }`
- `destroyImage(publicId)` → void (errors ignored)

### 5. Toggle Helpful Pattern (Idempotent Upsert)

```mermaid
sequenceDiagram
    participant Service as ⚙️ Service
    participant DB as 💾 Database

    Service->>DB: Check existing vote
    DB-->>Service: exists OR not_exists

    alt exists
        Service->>DB: DELETE vote (unvote)
        Service-->>Service: helpful = false
    else not_exists
        Service->>DB: INSERT vote (upvote)
        Service-->>Service: helpful = true
    end

    Service->>DB: COUNT helpful votes
    DB-->>Service: count = N
    Service-->>Service: Return { helpful: boolean, count: N }
```

**Key characteristics**:
- Idempotent: Same request toggles state
- Always returns current count
- Parallel queries for performance
- Single record for unique user+review (composite key)

### 6. Admin Override Capability

Admin có thể:
- Xem tất cả reviews (bất kể status)
- Trả lời reviews (kể cả đã approved)
- Xóa reviews (hard delete với cleanup photos)
- Admin routes có prefix `/api/admin` và require `STAFF_ROLES`

**Authorization check**:
```typescript
authorize(...STAFF_ROLES) // [ADMIN, STAFF]
```

---

## Testing Checklist

### Unit Tests

- [ ] **getReviewSummary**
  - [ ] Product found - returns aggregate data
  - [ ] Product not found - throws 404
  - [ ] Parallel queries execute correctly
  - [ ] Breakdown builds correctly for all ratings 1-5
  - [ ] Average rating rounds to 1 decimal
  - [ ] With photo count accurate

- [ ] **listReviews**
  - [ ] Valid pagination - returns correct slice
  - [ ] Filter by rating - WHERE clause correct
  - [ ] Filter by hasPhoto - EXISTS clause correct
  - [ ] Sort by helpful - ORDER BY helpful._count DESC
  - [ ] Sort by newest - ORDER BY createdAt DESC (default)
  - [ ] Pagination metadata accurate
  - [ ] Product not found - throws 404

- [ ] **createReview**
  - [ ] Valid order item delivered - creates review
  - [ ] Order item not found - throws 404
  - [ ] Order not delivered - throws 404
  - [ ] Review already exists - throws 409
  - [ ] With variantId - resolves productId from variant
  - [ ] Without variantId - resolves from SKU fallback
  - [ ] SKU not found - resolves from productName fallback
  - [ ] Product cannot be determined - throws 400
  - [ ] With photos - uploads to Cloudinary + creates photos
  - [ ] Without photos - creates review only
  - [ ] Max 5 photos enforced
  - [ ] Status set to APPROVED by default
  - [ ] Returns review with photos included

- [ ] **updateReview**
  - [ ] Valid ownership + within window - updates review
  - [ ] Review not found - throws 404
  - [ ] Not owned - throws 404
  - [ ] 30-day window exceeded - throws 400
  - [ ] Update rating only - updates rating field
  - [ ] Update content only - updates content field
  - [ ] Update both - updates both fields
  - [ ] Update with new photos - uploads + deletes old + replaces
  - [ ] Update without photos - keeps existing photos
  - [ ] Status reset to APPROVED on update
  - [ ] Returns updated review with photos

- [ ] **toggleHelpful**
  - [ ] First vote - creates vote, returns { helpful: true, count: N+1 }
  - [ ] Remove vote - deletes vote, returns { helpful: false, count: N-1 }
  - [ ] Toggle twice - returns to original state
  - [ ] Review not found - throws 404
  - [ ] Review not approved - throws 404
  - [ ] Count accurate after multiple votes

- [ ] **replyReview (Admin)**
  - [ ] Valid review - updates replyContent + repliedAt
  - [ ] Returns full review with admin includes
  - [ ] Review not found - throws 404
  - [ ] Content trimmed correctly
  - [ ] repliedAt set to current timestamp

### Integration Tests

- [ ] **End-to-end review lifecycle**
  - [ ] Customer places order → Order delivered
  - [ ] Customer sees pending review in "my reviews"
  - [ ] Customer creates review with photos
  - [ ] Review appears on product page
  - [ ] Review summary updates
  - [ ] Customer edits review within 30 days
  - [ ] Customer cannot edit after 30 days
  - [ ] Other customers toggle helpful
  - [ ] Admin replies to review
  - [ ] Admin deletes review
  - [ ] Photos cleaned up on Cloudinary

- [ ] **Concurrent operations**
  - [ ] Multiple customers toggle helpful simultaneously - no race conditions
  - [ ] Create review for same orderItem twice - second one gets 409
  - [ ] Update review while someone else votes - no conflicts

- [ ] **Cloudinary failure handling**
  - [ ] Upload fails during create - review not created
  - [ ] Upload fails during update - old photos preserved
  - [ ] Delete photo fails - logged but ignored (fire-and-forget)

### API Tests

- [ ] **Public endpoints**
  - [ ] GET /api/products/:slug/reviews/summary - 200
  - [ ] GET /api/products/:slug/reviews - 200
  - [ ] GET /api/products/invalid-slug/reviews - 404

- [ ] **User endpoints (authenticated)**
  - [ ] POST /api/order-items/:id/review - 201 (with valid data)
  - [ ] POST /api/order-items/:id/review - 401 (without auth)
  - [ ] POST /api/order-items/:id/review - 409 (already reviewed)
  - [ ] PUT /api/reviews/:id - 200 (within window)
  - [ ] PUT /api/reviews/:id - 400 (after 30 days)
  - [ ] DELETE /api/reviews/:id - 204
  - [ ] POST /api/reviews/:id/helpful - 200

- [ ] **Admin endpoints (authorized)**
  - [ ] GET /api/admin/reviews - 200 (admin/staff)
  - [ ] GET /api/admin/reviews - 403 (customer)
  - [ ] POST /api/admin/reviews/:id/reply - 200
  - [ ] DELETE /api/admin/reviews/:id - 204

### Performance Tests

- [ ] **Query optimization**
  - [ ] Summary queries (3 parallel) complete within 200ms
  - [ ] List reviews with includes completes within 300ms
  - [ ] Pagination queries use correct indexes

- [ ] **Concurrent load**
  - [ ] 100 simultaneous helpful toggles - no deadlocks
  - [ ] 50 simultaneous review creations - no conflicts

---

## Appendix: Database Schema

### Review Table

```sql
CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID UNIQUE NOT NULL,
  user_id      UUID NOT NULL,
  product_id   UUID NOT NULL,
  variant_id   UUID,
  rating       INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content      TEXT NOT NULL,
  status       VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reply_content TEXT,
  replied_at   TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_reviews_product_status ON reviews(product_id, status);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
```

### ReviewPhoto Table

```sql
CREATE TABLE review_photos (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL,
  url       TEXT NOT NULL,
  public_id TEXT NOT NULL,
  sort_order INT DEFAULT 0,

  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);

CREATE INDEX idx_review_photos_review_id ON review_photos(review_id);
```

### ReviewHelpful Table

```sql
CREATE TABLE review_helpful (
  user_id   UUID NOT NULL,
  review_id UUID NOT NULL,

  PRIMARY KEY (user_id, review_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);
```

---

## Notes

- **30-day edit window**: Hardcoded as `EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000`
- **Max photos**: Hardcoded as `MAX_PHOTOS = 5`
- **Auto-approve**: All new reviews set to `status = APPROVED` automatically (no moderation)
- **Photo cleanup**: Fire-and-forget on delete/update - errors ignored to avoid blocking operations
- **Parallel queries**: Used extensively (Promise.all) for performance
- **Idempotent operations**: Toggle helpful is naturally idempotent (same request toggles state)
- **Authorization**: Admin operations require role in `[ADMIN, STAFF]`
- **Ownership**: Customers can only modify their own reviews
- **Delivery required**: Can only review items from delivered orders

---

**Document Status**: ✅ Complete  
**Last Updated**: 2025-06-20  
**Next Review**: After any schema or service layer changes
