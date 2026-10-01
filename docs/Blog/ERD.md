# ERD — Entity Relationship Diagram
## Module: Blog
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01

---

## 1. Sơ đồ ERD

```mermaid
erDiagram
    BLOG_POST {
        string  id                  PK  "uuid"
        string  title                   "bắt buộc, 1-200"
        string  slug                UK  "duy nhất toàn bảng, KỂ bài đã xoá mềm"
        string  excerpt                 "null, ≤500"
        string  contentHtml             "default '', đã sanitize"
        string  coverImageUrl           "null với bài nháp"
        string  coverImagePublicId      "null nếu ảnh không do blog upload"
        string  categoryId          FK  "null với bài nháp; Restrict"
        enum    contentType             "null với bài nháp; 14 giá trị"
        enum    status                  "DRAFT | SCHEDULED | PUBLISHED | ARCHIVED"
        datetime scheduledAt            "khác null KHI VÀ CHỈ KHI status = SCHEDULED"
        datetime publishedAt            "lần công khai đầu, không đổi khi xuất bản lại"
        string  authorId            FK  "SetNull"
        string  authorDisplayName       "mặc định = fullName người tạo"
        int     readingTimeMinutes      "default 1"
        boolean isReadingTimeManual     "default false"
        string  seoTitle
        string  seoDescription
        string  seoKeywords
        string  canonicalUrl
        int     viewCount               "default 0"
        string  updatedById         FK  "SetNull"
        datetime createdAt
        datetime updatedAt
        datetime deletedAt              "xoá mềm"
    }

    BLOG_CATEGORY {
        string  id          PK  "uuid"
        string  name        UK  "duy nhất"
        string  slug        UK  "duy nhất"
        string  description
        string  parentId    FK  "self-relation, Restrict, tối đa 2 cấp"
        int     sortOrder       "default 0"
        boolean isActive        "default true"
        datetime createdAt
        datetime updatedAt
    }

    BLOG_TAG {
        string   id        PK "uuid"
        string   name      UK "duy nhất, 1-50"
        string   slug      UK "duy nhất"
        datetime createdAt
    }

    BLOG_POST_TAG {
        string postId  PK "FK → BlogPost; Cascade"
        string tagId   PK "FK → BlogTag; Cascade"
    }

    BLOG_POST_PRODUCT {
        string postId    PK "FK → BlogPost; Cascade"
        string productId PK "FK → Product; Cascade"
        int    sortOrder       "default 0"
    }

    BLOG_RELATED_POST {
        string postId        PK "FK → BlogPost; Cascade"
        string relatedPostId PK "FK → BlogPost; Cascade — không đối xứng"
        int    sortOrder           "default 0"
    }

    BLOG_POST_FAQ {
        string id        PK  "uuid"
        string postId    FK  "Cascade"
        string question      "1-300"
        string answer        "1-3000"
        int    sortOrder     "default 0"
    }

    BLOG_CATEGORY ||--o{ BLOG_POST : "phân loại (1:N)"
    BLOG_POST     ||--o{ BLOG_POST_TAG : "gắn tag"
    BLOG_TAG      ||--o{ BLOG_POST_TAG : "được gắn"
    BLOG_POST     ||--o{ BLOG_POST_PRODUCT : "gắn sản phẩm"
    BLOG_POST     ||--o{ BLOG_RELATED_POST : "chọn bài liên quan"
    BLOG_POST     ||--o{ BLOG_POST_FAQ : "FAQ trong bài"
```

> `BlogCategory` còn tự quan hệ cha–con (parent/children); `BlogPost` tham chiếu `User` qua `authorId` (người tạo) và `updatedById` (người sửa cuối) — đều `SetNull` khi tài khoản bị xoá cứng; `BlogPostProduct` tham chiếu `Product`.

---

## 2. Giải thích quan hệ

### BlogCategory → BlogPost (1:N)
Một danh mục chứa nhiều bài; một bài chỉ thuộc tối đa một danh mục.  
`onDelete: Restrict` — DB chặn xoá danh mục còn bài sống; service trả 409 trước khi tới đây. Bài đã xoá mềm được service gỡ `categoryId` trước khi xoá danh mục.

### BlogCategory → BlogCategory (cây, tối đa 2 cấp)
`parentId` tự tham chiếu, `onDelete: Restrict`. Service chặn: cha phải là danh mục gốc; danh mục đang có con không được gán cha.

### Bảng liên kết N:N — toàn bộ Cascade
| Bảng | Khoá chính | Ý nghĩa |
|---|---|---|
| `blog_post_tags` | `(postId, tagId)` | Xoá tag → tự gỡ khỏi mọi bài |
| `blog_post_products` | `(postId, productId)` | Xoá sản phẩm → gỡ liên kết, bài không hỏng |
| `blog_related_posts` | `(postId, relatedPostId)` | **Không đối xứng**: A chọn B không làm B hiện A |
| `blog_post_faqs` | `id` riêng | Thay cả danh sách trong 1 transaction khi lưu bài |

---

## 3. Bảng `blog_posts` — chi tiết trạng thái

| Trường | Ghi chú nghiệp vụ |
|---|---|
| `status` | `DRAFT` (nháp) → `SCHEDULED` (hẹn giờ) → `PUBLISHED` (đăng) → `ARCHIVED` (lưu trữ); chuyển đổi theo bảng trạng thái duy nhất ở service |
| `scheduledAt` | Khác null khi và chỉ khi `SCHEDULED`; lần đọc đầu sau giờ hẹn tự chuyển `PUBLISHED` (lazy publish) |
| `publishedAt` | Lần công khai **đầu tiên**; gỡ rồi xuất bản lại không đổi |
| `slug` | Duy nhất toàn bảng kể cả bài đã xoá mềm — slug cũ không bao giờ tái sử dụng |
| `deletedAt` | Xoá mềm: mọi query công khai và admin đều lọc `deletedAt IS NULL` |
| `viewCount` | Tăng bằng SQL nguyên tử; không đụng `updatedAt` |
| `isReadingTimeManual` | `true` = admin ghi đè thời gian đọc, sửa nội dung không tự tính lại |
| `authorDisplayName` | Tên hiển thị trên bài, độc lập với tài khoản (kế thừa khi user bị xoá) |
| `coverImagePublicId` | Dùng destroy Cloudinary; `null` khi ảnh không do blog upload (seed tái dùng URL) — không bao giờ destroy |

---

## 4. Index

| Bảng | Index | Mục đích |
|---|---|---|
| `blog_posts` | `(status, publishedAt)` | Danh sách công khai: PUBLISHED sắp publishedAt DESC |
| `blog_posts` | `(categoryId, status, publishedAt)` | Trang danh mục + tự bổ sung bài liên quan cùng danh mục |
| `blog_posts` | `(status, scheduledAt)` | Truy vấn bài hẹn giờ đã tới hạn (lazy publish) |
| `blog_posts` | `(authorId)`, `(updatedById)` | Lọc danh sách quản trị theo tác giả |
| `blog_categories` | `(parentId)` | Duyệt cây 2 cấp |
| `blog_post_tags` | `(tagId)` | Trang tag → bài |
| `blog_post_products` | `(productId)` | Sản phẩm xuất hiện ở những bài nào |
| `blog_related_posts` | `(relatedPostId)` | Tra bài liên quan |
| `blog_post_faqs` | `(postId, sortOrder)` | Đọc FAQ đúng thứ tự |

**Index `(status, publishedAt)` phục vụ câu query danh sách công khai:**
```sql
SELECT * FROM blog_posts
WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL
ORDER BY "publishedAt" DESC, id DESC
LIMIT 12 OFFSET 0
```

---

## 5. Ràng buộc và hành vi xoá

| Quan hệ | `onDelete` | Hành vi |
|---|---|---|
| BlogCategory → BlogPost | Restrict | Chặn xoá danh mục còn bài sống (service 409 trước) |
| BlogCategory → BlogCategory | Restrict | Chặn xoá danh mục còn con |
| User → BlogPost (author/updatedBy) | SetNull | Xoá tài khoản không mất bài; `authorDisplayName` giữ tên hiển thị cũ |
| BlogPost → bảng liên kết | Cascade | Xoá bài (cứng) gọn tag/product/related/faq — thực tế bài chỉ xoá mềm |
| BlogTag → BlogPostTag | Cascade | Xoá tag tự gỡ khỏi mọi bài |
| Product → BlogPostProduct | Cascade | Xoá sản phẩm không làm hỏng bài |
