# ERD — Entity Relationship Diagram
## Module: Review
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Sơ đồ ERD

```mermaid
erDiagram
    USER {
        string  id          PK
        string  fullName
        string  email
        string  avatarUrl
    }

    ORDER {
        string      id     PK
        string      userId
        OrderStatus status  "DELIVERED = có thể review"
    }

    ORDER_ITEM {
        string  id          PK "unique"
        string  orderId
        string  variantId   "nullable"
        string  productName "snapshot"
        string  sku         "snapshot"
        string  color       "nullable snapshot"
        string  storage     "nullable snapshot"
        string  ram         "nullable snapshot"
    }

    REVIEW {
        string       id           PK
        string       orderItemId  UK "1 orderItem = 1 review"
        string       userId
        string       productId
        string       variantId    "nullable"
        int          rating       "1-5"
        string       content
        ReviewStatus status       "default PENDING; createReview hardcode APPROVED"
        string       replyContent "nullable"
        datetime     repliedAt    "nullable"
        datetime     createdAt
        datetime     updatedAt
    }

    REVIEW_PHOTO {
        string id        PK
        string reviewId
        string url
        string publicId  "Cloudinary public_id"
        int    sortOrder "default 0"
    }

    REVIEW_HELPFUL {
        string userId    PK
        string reviewId  PK
    }

    PRODUCT {
        string id   PK
        string name
        string slug
    }

    USER         ||--o{ REVIEW         : "viết đánh giá (1:N)"
    ORDER        ||--o{ ORDER_ITEM     : "chứa items (1:N)"
    ORDER_ITEM   ||--|| REVIEW         : "có 1 review (1:1)"
    PRODUCT      ||--o{ REVIEW         : "được đánh giá (1:N)"
    REVIEW       ||--o{ REVIEW_PHOTO   : "có ảnh (1:N)"
    REVIEW       ||--o{ REVIEW_HELPFUL : "được đánh dấu helpful (1:N)"
    USER         ||--o{ REVIEW_HELPFUL : "đánh dấu helpful (1:N)"
```

---

## 2. Mô tả các model chính

### Review

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `orderItemId` | String | UNIQUE — 1 orderItem chỉ có 1 review |
| `status` | ReviewStatus | Default PENDING trong schema, nhưng service hardcode APPROVED khi tạo |
| `replyContent` | String? | Admin reply text |
| `repliedAt` | DateTime? | Null cho đến khi admin reply lần đầu |

**Index:** `@@index([productId, status])`, `@@index([userId])`

### ReviewPhoto

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `publicId` | String | Cloudinary public_id; dùng để xóa khi review bị xóa |
| `sortOrder` | Int | Thứ tự hiển thị; tăng theo index của file upload |

`onDelete: Cascade` từ Review

### ReviewHelpful

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `@@id([userId, reviewId])` | Composite PK | Mỗi user chỉ helpful 1 lần / review |

`onDelete: Cascade` từ cả User và Review

---

## 3. Select objects

### REVIEW_PUBLIC_SELECT (public endpoints)
```
id, rating, content, replyContent, repliedAt, createdAt
orderItem: { color, storage, ram, sku }
user: { id, fullName, avatarUrl }
photos: sorted by sortOrder ASC { id, url }
_count: { helpful }
```

### REVIEW_ADMIN_INCLUDE (admin endpoints)
```
user:    { id, fullName, email }
product: { id, name, slug }
photos:  sorted by sortOrder ASC { id, url }
_count:  { helpful }
```

> Admin include dùng **include** (không phải select) nên trả thêm tất cả scalar fields của Review.
