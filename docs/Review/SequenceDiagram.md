# Sequence Diagram — Luồng API
## Module: Review
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## SD-01: Tạo đánh giá có ảnh

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant MW as Middleware (Auth + Upload)
    participant Val as validateCreateReview
    participant Svc as review.service
    participant Cloud as Cloudinary
    participant DB as PostgreSQL

    C->>MW: POST /order-items/:orderItemId/review\nmultipart/form-data (photos[], rating, content)
    MW-->>C: 401 nếu chưa đăng nhập
    MW->>Val: req.body (rating string từ form-data, content)
    Val-->>C: 400 nếu rating không 1-5 hoặc content < 10 ký tự
    Val->>Svc: createReview(userId, orderItemId, body, files)

    Svc->>DB: findFirst OrderItem\nwhere id=orderItemId, order.userId=userId, order.status=DELIVERED\ninclude order.id, review.id
    DB-->>Svc: orderItem hoặc null
    Svc-->>C: 404 nếu null
    Svc-->>C: 409 nếu orderItem.review tồn tại

    par Song song
        Svc->>DB: findUnique ProductVariant → productId
        DB-->>Svc: productId
    and
        Svc->>Cloud: uploadEntityImage(buffer, 'reviews') × N
        Cloud-->>Svc: [{ url, publicId }]
    end

    Svc->>DB: review.create(data + photos.create[])
    DB-->>Svc: review (include photos)
    Svc-->>C: 201 review
```

---

## SD-02: Sửa đánh giá (có ảnh mới)

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant Svc as review.service
    participant Cloud as Cloudinary
    participant DB as PostgreSQL

    C->>Svc: PUT /reviews/:id\n(rating?, content?, photos[]?)
    Svc->>DB: findFirst Review\nwhere id=reviewId AND userId=userId\ninclude photos
    DB-->>Svc: review hoặc null
    Svc-->>C: 404 nếu null
    Svc->>Svc: now - review.createdAt > 30d?
    Svc-->>C: 400 nếu quá hạn

    Svc->>Cloud: destroyImage(photo.publicId) × N (fire-and-forget)
    Svc->>Cloud: uploadEntityImage(buffer, 'reviews') × N
    Cloud-->>Svc: [{ url, publicId }]

    Svc->>DB: review.update\ndata + photos.deleteMany + photos.create\nstatus = APPROVED
    DB-->>Svc: updated review
    Svc-->>C: 200 review
```

---

## SD-03: Xem summary sản phẩm

```mermaid
sequenceDiagram
    autonumber
    participant G as Guest
    participant Svc as review.service
    participant DB as PostgreSQL

    G->>Svc: GET /products/:slug/reviews/summary
    Svc->>DB: product.findUnique where slug
    DB-->>Svc: { id } hoặc null
    Svc-->>G: 404 nếu null

    par 3 query song song
        Svc->>DB: review.aggregate (avg rating, count)\nwhere productId, APPROVED
        DB-->>Svc: { _avg.rating, _count.id }
    and
        Svc->>DB: review.groupBy rating\nwhere productId, APPROVED
        DB-->>Svc: [{rating, _count.id}]
    and
        Svc->>DB: reviewPhoto.count\nwhere review.productId, APPROVED
        DB-->>Svc: withPhotoCount
    end

    Svc->>Svc: Dựng breakdown {1:N, 2:N, 3:N, 4:N, 5:N}
    Svc-->>G: 200 { averageRating, totalCount, breakdown, withPhotoCount }
```

---

## SD-04: Admin Reply

```mermaid
sequenceDiagram
    autonumber
    participant S as Staff
    participant Svc as review.service
    participant DB as PostgreSQL

    S->>Svc: POST /admin/reviews/:id/reply\n{ content }
    Svc->>DB: review.update\nwhere id=reviewId\ndata { replyContent, repliedAt: now() }\ninclude REVIEW_ADMIN_INCLUDE
    alt P2025
        DB-->>Svc: PrismaClientKnownRequestError
        Svc-->>S: 404
    else OK
        DB-->>Svc: full review
        Svc-->>S: 200 full review
    end
```
