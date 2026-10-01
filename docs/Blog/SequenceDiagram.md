# Sequence Diagram — Luồng API
## Module: Blog
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01

---

## SD-01: Người đọc duyệt danh sách và đọc bài

```mermaid
sequenceDiagram
    autonumber
    participant R as Người đọc (FE)
    participant B as BlogService
    participant DB as PostgreSQL

    R->>B: GET /api/blog/posts?category=tu-van
    B->>DB: UPDATE blog_posts SET status='PUBLISHED' WHERE status='SCHEDULED' AND scheduledAt ≤ now
    Note over DB: Lazy publish — không cron

    B->>DB: blogCategory.findFirst(slug, isActive=true) + children
    alt Danh mục không tồn tại/tắt
        B-->>R: 404 Danh mục không tồn tại
    else OK
        B->>DB: childIds theo parentId
        par Song song
            B->>DB: blogPost.findMany WHERE PUBLISHED + deletedAt null + categoryId IN (cha, con)\nORDER BY publishedAt DESC, id DESC — SELECT PostCard
        and
            B->>DB: blogPost.count cùng WHERE
        end
        B-->>R: 200 { posts, pagination, category }
    end

    R->>B: GET /api/blog/posts/:slug
    B->>DB: findFirst slug + PUBLISHED + include chi tiết
    B->>B: buildRelatedPosts — curated ≤ 6, tự bổ sung cùng danh mục
    B->>B: buildSeo — title/description/canonical/ogImage
    B-->>R: 200 { post } (contentHtml, tags, faqs, relatedPosts, relatedProducts, seo)

    R->>B: POST /api/blog/posts/:slug/view
    B->>DB: UPDATE viewCount = viewCount + 1 WHERE slug + PUBLISHED (SQL nguyên tử)
    Note over DB: Không qua prisma.update — updatedAt không đổi, lastmod sitemap không nhảy
    B-->>R: 204 No Content
```

---

## SD-02: Admin xuất bản bài — guards chống race

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin/Staff
    participant V as Validator
    participant B as BlogService
    participant DB as PostgreSQL

    A->>V: PATCH /api/admin/blog/posts/:id/status { status: "PUBLISHED" }
    V-->>A: 400 nếu status không thuộc enum
    V->>B: updatePostStatus(id, body, updatedById)

    B->>DB: publishDueScheduledPosts
    B->>DB: blogPost.findFirst(id, deletedAt null)
    alt Bài không tồn tại
        B-->>A: 404
    else OK
        B->>B: Kiểm tra bảng chuyển trạng thái DRAFT → PUBLISHED
        alt Không nằm trong bảng
            B-->>A: 409 Không thể chuyển bài từ X sang Y
        else Đúng bảng
            B->>B: computeMissingForPublish(title, slug, contentHtml, categoryId, contentType, coverImage)
            alt Còn thiếu trường
                B-->>A: 400 Chưa đủ điều kiện xuất bản, còn thiếu: ...
            else Đủ
                B->>DB: blogPost.updateMany WHERE id AND status = trạng thái cũ
                Note over DB: Guard trong WHERE — 2 admin đổi cùng lúc chỉ 1 thắng
                alt count = 0
                    B-->>A: 409 Bài vừa được thay đổi trạng thái
                else count = 1
                    B->>DB: findUnique(id) — status, scheduledAt, publishedAt
                    B-->>A: 200
                end
            end
        end
    end
```

> `publishedAt` chỉ set lần công khai đầu (`post.publishedAt ?? new Date()`) — gỡ rồi xuất bản lại không đổi.

---

## SD-03: Tạo bài — sanitize và slug tự sinh

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin/Staff
    participant V as Validator
    participant B as BlogService
    participant DB as PostgreSQL

    A->>V: POST /api/admin/blog/posts { title, contentHtml, tagIds... }
    V-->>A: 400 nếu vi phạm (title 1-200, tagIds ≤ 20, faqs ≤ 15...)
    V->>B: createPost(body, callerId)

    par Kiểm tra song song
        B->>DB: assertTagsExist(tagIds)
    and
        B->>DB: assertProductsExist(productIds)
    and
        B->>DB: assertRelatedPostsValid(relatedPostIds)
    and
        B->>DB: assertCategoryExists(categoryId)
    end
    alt Không tồn tại
        B-->>A: 400
    else OK
        B->>B: resolveUniqueSlug(base title) — trùng → thêm hậu tố
        B->>B: sanitizeBlogHtml(contentHtml) — whitelist thẻ, ảnh chỉ Cloudinary hệ thống
        B->>B: computeReadingTime nếu không gửi readingTimeMinutes
        B->>DB: authorDisplayName mặc định = fullName người gọi
        B->>DB: blogPost.create (status DRAFT)
        alt P2002
            B-->>A: 409 Slug đã được sử dụng bởi bài viết khác
        else OK
            B-->>A: 201 { post, missingForPublish }
        end
    end
```

---

## SD-04: Upload ảnh đại diện — rollback Cloudinary

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin/Staff
    participant B as BlogService
    participant CL as Cloudinary
    participant DB as PostgreSQL

    A->>B: PUT /api/admin/blog/posts/:id/cover (multipart image)
    alt Thiếu file
        B-->>A: 400 Ảnh đại diện là bắt buộc
    else Có file
        B->>DB: findAdminPostOrThrow(id)
        B->>CL: uploadEntityImage(buffer, "blog/covers")
        B->>DB: blogPost.update coverImageUrl + coverImagePublicId + updatedById
        alt DB lỗi
            B->>CL: destroyImage(publicId vừa upload) — rollback
            B-->>A: lỗi gốc
        else OK
            B->>CL: destroyImage(coverImagePublicId cũ) — fire and forget
            B-->>A: 200 { id, coverImageUrl, updatedAt }
        end
    end
```

---

## SD-05: Preview token — tạo và đọc

```mermaid
sequenceDiagram
    autonumber
    participant Ad as Admin/Staff
    participant B as BlogService
    participant R as Người xem (FE link)

    Ad->>B: POST /api/admin/blog/posts/:id/preview-token
    B->>B: previewSecret = HMAC-SHA256(JWT_ACCESS_SECRET, "blog-preview")
    B-->>Ad: 200 { token, previewUrl, expiresAt (1 giờ) }

    R->>B: GET /api/blog/preview/:token
    B->>B: jwt.verify HS256 + typ = blog-preview
    alt Token sai / hết hạn / sai kiểu
        B-->>R: 404 Liên kết xem trước không hợp lệ hoặc đã hết hạn
    else OK
        B->>B: publishDueScheduledPosts
        B-->>R: 200 { post (bất kể trạng thái), preview { status, scheduledAt, expiresAt } }
    end
```

---

## SD-06: Sitemap và RSS cho bot SEO

```mermaid
sequenceDiagram
    autonumber
    participant Bot as Googlebot / RSS reader
    participant B as BlogService
    participant DB as PostgreSQL

    Bot->>B: GET /api/blog/sitemap.xml
    B->>B: publishDueScheduledPosts
    alt SITE_URL không hợp lệ (FRONTEND_URL)
        B-->>Bot: 503 Chưa cấu hình FRONTEND_URL nên chưa tạo được sitemap/RSS
    else OK
        par Song song
            B->>DB: blogPost PUBLISHED — slug, updatedAt, canonicalUrl
        and
            B->>DB: blogCategory isActive — slug
        end
        B->>B: Lọc bỏ bài cross-post (canonical trỏ origin khác)
        B-->>Bot: 200 XML (Cache-Control: public, max-age=600)
    end

    Bot->>B: GET /api/blog/rss.xml
    B->>DB: 20 bài mới nhất PUBLISHED
    B-->>Bot: 200 RSS 2.0 (language vi, canonical khi có)
```
