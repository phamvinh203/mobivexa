# SRS — Software Requirement Specification
## Module: Blog
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01 | **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Endpoints tổng quan — 29 endpoint

### Public — `/api/blog` (không auth)

| Method | Path | Rate limit | Mô tả |
|---|---|---|---|
| GET | `/posts` | — | Danh sách bài công khai, lọc `category`/`tag` |
| GET | `/search` | 20/phút | Tìm kiếm full-text |
| GET | `/posts/:slug` | — | Chi tiết bài công khai |
| POST | `/posts/:slug/view` | 30/phút | Đếm lượt xem (trả 204) |
| GET | `/preview/:token` | — | Xem trước qua token HMAC hạn 1h |
| GET | `/categories` | — | Danh mục đang bật (phẳng) |
| GET | `/content-types` | — | 14 loại nội dung + nhãn tiếng Việt |
| GET | `/sitemap.xml` | — | Sitemap XML (cache 600s) |
| GET | `/rss.xml` | — | RSS 2.0 20 bài mới (cache 600s) |

### Admin — `/api/admin/blog` (authenticate + role ADMIN hoặc STAFF)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/posts` | Danh sách quản trị: lọc status/categoryId/contentType/authorId/search, sort updated/created/published |
| GET | `/posts/:id` | Chi tiết quản trị + `missingForPublish` |
| POST | `/posts` | Tạo bài (mặc định DRAFT) |
| PUT | `/posts/:id` | Cập nhật một phần (tags/products/related/faqs thay cả bộ) |
| PATCH | `/posts/:id/status` | Đổi trạng thái theo bảng chuyển trạng thái |
| DELETE | `/posts/:id` | Xoá mềm |
| PUT | `/posts/:id/cover` | Ảnh đại diện (multipart `image`, Cloudinary `blog/covers`) |
| DELETE | `/posts/:id/cover` | Xoá ảnh đại diện (chỉ DRAFT/ARCHIVED) |
| POST | `/posts/:id/preview-token` | Token preview HMAC hạn 1h |
| POST | `/images` | Upload ảnh nội dung (Cloudinary `blog/content`) |
| GET | `/product-options` | Autocomplete sản phẩm (tên/SKU) |
| GET | `/categories` | Danh mục quản trị + `_count` |
| POST | `/categories` | Tạo danh mục |
| PUT | `/categories/:id` | Sửa danh mục |
| DELETE | `/categories/:id` | Xoá danh mục (chặn khi còn con/bài) |
| PATCH | `/categories/:id/status` | Toggle isActive |
| GET | `/tags` | Tag quản trị (search, limit ≤ 100) |
| POST | `/tags` | Tạo tag |
| PUT | `/tags/:id` | Sửa tag |
| DELETE | `/tags/:id` | Xoá tag (cascade gỡ khỏi bài) |

---

## 2. Schema dữ liệu

7 bảng, tiền tố `blog_`, domain riêng không dùng chung Category/Tag của sản phẩm.

| Bảng | Khoá chính | Điểm chính |
|---|---|---|
| `blog_categories` | id | name + slug đều unique; parentId tự tham chiếu (tối đa 2 cấp); Restrict |
| `blog_tags` | id | name + slug unique |
| `blog_posts` | id | slug unique toàn bảng (kể cả bài đã xoá mềm); status enum 4 giá trị; deletedAt xoá mềm |
| `blog_post_tags` | (postId, tagId) | Cascade hai chiều |
| `blog_post_products` | (postId, productId) | sortOrder; Cascade |
| `blog_related_posts` | (postId, relatedPostId) | Không đối xứng; sortOrder; Cascade |
| `blog_post_faqs` | id | question 1–300, answer 1–3000, sortOrder; Cascade |

**Enum:**
- `BlogPostStatus`: `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`
- `BlogContentType`: 14 giá trị cố định — `NEWS`, `SMARTPHONE_NEWS`, `REVIEW`, `COMPARISON`, `GUIDE`, `TIP_ANDROID`, `TIP_IPHONE`, `BUYING_ADVICE`, `TOP_LIST`, `PROMOTION`, `BRAND_NEWS`, `ACCESSORY`, `KNOWLEDGE`, `FAQ`

Chi tiết cột/index: xem [ERD.md](./ERD.md).

---

## 3. Yêu cầu chức năng

### FR-01: Danh sách công khai (GET /posts)

| | |
|---|---|
| **Endpoint** | `GET /api/blog/posts` |
| **Auth** | Không |

- Lazy publish trước; `WHERE status = PUBLISHED AND deletedAt IS NULL`
- Lọc `category` (slug): danh mục phải `isActive=true`, quét cả danh mục con; payload trả `category` kèm `parent` + `children` (chỉ con đang bật)
- Lọc `tag` (slug): `WHERE tags.some.tagId`
- Sắp `publishedAt DESC, id DESC`; phân trang default 12, trần 50
- Key lặp query (`?category=a&category=b`) chuẩn hoá lấy phần tử đầu — chống lỗi 500 ở Express 5

### FR-02: Tìm kiếm (GET /search)

- Full-text `simple` trên title (A) + excerpt (B); khớp tên tag cộng 0.2 điểm; sort điểm DESC rồi `publishedAt DESC`
- Cắt trang bằng raw SQL rồi hydrate bằng `findMany` với cùng điều kiện công khai (bài bị gỡ đúng khe thời gian vẫn bị loại)
- `q` bắt buộc, ≤ 100 ký tự; rate limit 20/phút

### FR-03: Chi tiết công khai (GET /posts/:slug)

- Trả `contentHtml` (đã sanitize), tags, faqs, relatedPosts, relatedProducts, seo
- Bài liên quan: curated (≤ 6, đúng thứ tự, chỉ bài còn công khai) + tự bổ sung cùng danh mục; sản phẩm liên quan chỉ lấy `isActive=true`
- SEO một nguồn tính: `seoTitle || title`; `seoDescription || excerpt || 160 ký tự đầu nội dung`; `canonicalUrl || {SITE_URL}/tin-tuc/{slug}`; `ogImage = coverImageUrl`

### FR-04: Lượt xem (POST /posts/:slug/view)

- `UPDATE viewCount = viewCount + 1` nguyên tử, **không qua `prisma.update`** để `updatedAt` (lastmod sitemap) không đổi; 0 dòng → 404; rate limit 30/phút; trả 204

### FR-05: Lazy publish (promote-on-read)

- Đầu **mọi** handler đọc/đổi trạng thái bài (public + admin) chạy `UPDATE ... SET status='PUBLISHED', publishedAt=COALESCE(publishedAt, scheduledAt), scheduledAt=NULL WHERE status='SCHEDULED' AND scheduledAt <= now AND deletedAt IS NULL`
- Lỗi lazy publish chỉ warn, không chặn lượt đọc — bài được thăng hạng ở lượt sau; không cần cron

### FR-06: CRUD bài viết (Admin)

- Tạo: chỉ `title` bắt buộc (1–200); slug tự sinh từ title (trùng → hậu tố); nội dung luôn qua `sanitizeBlogHtml`; thời gian đọc tự tính nếu không ghi đè (`isReadingTimeManual`); tác giả hiển thị mặc định = fullName người tạo (fallback "Đội ngũ Mobivexa")
- Sửa: một phần; `tagIds`/`productIds`/`relatedPostIds`/`faqs` thay toàn bộ trong 1 transaction kèm sortOrder; sửa nội dung khi chưa ghi đè thời gian đọc → tự tính lại
- **Guard công khai** khi sửa bài `PUBLISHED`/`SCHEDULED`: dữ liệu sau khi áp không được mất trường bắt buộc → 400 kèm danh sách tên tiếng Việt
- Xoá mềm `deletedAt`; lỗi DB dịch thành 409 (slug trùng P2002; dữ liệu liên kết đổi P2003; trạng thái đổi P2025)
- Kiểm tra tham chiếu: tag/sản phẩm/bài liên quan/danh mục không tồn tại → 400; bài liên quan không chứa chính nó

### FR-07: Trạng thái (PATCH /posts/:id/status)

- Bảng chuyển trạng thái duy nhất: DRAFT→[SCHEDULED, PUBLISHED]; SCHEDULED→[DRAFT, SCHEDULED]; PUBLISHED→[DRAFT, ARCHIVED]; ARCHIVED→[DRAFT, PUBLISHED]; trái luật → 409
- SCHEDULED: `scheduledAt` bắt buộc, tương lai (dung sai 60s); trạng thái khác đặt `scheduledAt = null`
- PUBLISHED/SCHEDULED: kiểm đủ trường bắt buộc; PUBLISHED set `publishedAt` lần đầu
- Chống race: `updateMany WHERE id AND status = trạng thái cũ` — `count = 0` → 409

### FR-08: Ảnh và preview

- Cover: upload Cloudinary `blog/covers` rồi mới update DB; DB lỗi → destroy ảnh vừa upload; thành công → destroy ảnh cũ (fire and forget); xoá cover chỉ cho DRAFT/ARCHIVED
- Preview token: JWT HS256 `{ sub: postId, typ: 'blog-preview' }`, hạn 1 giờ, ký bằng `HMAC-SHA256(JWT_ACCESS_SECRET, 'blog-preview')` — tách khỏi access token; verify fail/typ sai/hết hạn gộp một message 404
- Ảnh nội dung: upload Cloudinary `blog/content`, trả `{ url, publicId }` — URL này là duy nhất dạng `src` mà sanitize chấp nhận

### FR-09: Sanitize nội dung (ADR-blog-005)

- Whitelist thẻ: `p, br, hr, h2, h3, h4, strong, b, em, i, u, s, blockquote, ul, ol, li, code, pre, a, img`
- Thuộc tính: `a[href, target, rel]`, `img[src, alt, width, height]`; scheme cho phép http/https/mailto/tel
- `h1` tự chuyển `h2` (trang đã có H1 là tiêu đề bài); `target=_blank` tự thêm `rel="noopener noreferrer"`
- `img`: loại nếu không phải `https://res.cloudinary.com/<cloud>/image/upload/...` (so bằng `new URL()` chống lách `..` và delivery type `image/fetch`)
- `contentHtml` giới hạn 200.000 ký tự ở validator

### FR-10: Sitemap & RSS

- `SITE_URL` đọc một nguồn từ `FRONTEND_URL` (phần tử đầu hợp lệ), resolve **không bao giờ throw**
- Sitemap: trang blog (lastmod = `updatedAt` mới nhất) + danh mục đang bật + bài công khai kèm lastmod; loại bài có canonical trỏ origin khác
- RSS 2.0: 20 bài mới, `language: vi`, link ưu tiên canonical; `publishedAt` null (legacy) fallback `updatedAt`
- Cả hai: `Cache-Control: public, max-age=600`; thiếu domain hợp lệ → 503

### FR-11: Danh mục & Tag (Admin)

- Danh mục: name 2–100 unique, slug tự sinh; luật 2 cấp (cha phải là gốc; đang có con thì không được gán cha); tạo/sửa trong transaction **Serializable** (P2034 → 409 tải lại); xoá chặn khi còn con (409) hoặc còn bài sống (409 kèm số bài); xoá tự gỡ `categoryId` của bài đã xoá mềm trước
- Toggle `isActive`: FE tự dựng cây và ẩn nhánh con khi cha tắt
- Tag: name 1–50 unique; search `contains` insensitive; xoá cascade gỡ khỏi mọi bài; `_count.posts` chỉ đếm bài chưa xoá mềm

---

## 4. Yêu cầu phi chức năng

| | |
|---|---|
| **An toàn nội dung** | Sanitize whitelist + ảnh chỉ Cloudinary hệ thống; preview token tách domain khỏi access token |
| **Tính nhất quán** | Guard trạng thái trong WHERE; transaction Serializable cho cây danh mục; thay cả bộ liên kết trong 1 transaction |
| **Hiệu năng** | Rate limit search 20/phút, view 30/phút; sitemap/RSS cache CDN 600s; index phủ các truy vấn danh sách |
| **SEO** | Một nguồn `SITE_URL`; lastmod bám `updatedAt`; viewCount nguyên tử không nghịch lastmod |
| **Bền bỉ dữ liệu** | Xoá mềm bài; slug không tái sử dụng; xoá tag/sản phẩm không làm gãy bài |
| **Quan sát được** | Resolve domain warn khi cấu hình sai; lazy publish warn khi lỗi, không chặn đọc |
