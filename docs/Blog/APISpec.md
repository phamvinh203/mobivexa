# API Specification
## Module: Blog
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01  
> **Base URL:** `/api/blog` (public) · `/api/admin/blog` (quản trị)  
> **Auth:** Public không cần token · Admin: Bearer token, role **ADMIN hoặc STAFF**

---

## Tổng quan 29 endpoint

| Nhóm | Endpoint | Số lượng |
|---|---|---|
| Public | GET posts · GET search · GET posts/:slug · POST posts/:slug/view · GET preview/:token · GET categories · GET content-types · GET sitemap.xml · GET rss.xml | **9** |
| Admin — Posts | GET/POST posts · GET/PUT/DELETE posts/:id · PATCH status · PUT/DELETE cover · POST preview-token · POST images · GET product-options | **11** |
| Admin — Categories | GET/POST categories · PUT/DELETE categories/:id · PATCH status | **5** |
| Admin — Tags | GET/POST tags · PUT/DELETE tags/:id | **4** |

> Mọi handler đọc/đổi trạng thái bài đều chạy lazy-publish trước: bài `SCHEDULED` đã tới giờ tự chuyển `PUBLISHED` (`publishedAt = COALESCE(publishedAt, scheduledAt)`, xoá `scheduledAt`).

---

# PUBLIC — `/api/blog`

### GET /posts
Danh sách bài viết công khai, phân trang.

**Auth:** Không

**Query params:**
| Param | Type | Default | Mô tả |
|---|---|---|---|
| `page` | number | 1 | Trang |
| `limit` | number | 12 | Số bài/trang (trần 50) |
| `category` | string | — | Slug danh mục (bao gồm cả danh mục con đang bật) |
| `tag` | string | — | Slug tag |

**Response 200:**
```json
{
  "posts": [
    {
      "id": "uuid",
      "title": "Top 5 máy chơi game dưới 8 triệu",
      "slug": "top-5-may-choi-game-duoi-8-trieu",
      "excerpt": "Danh sách chọn lọc...",
      "coverImageUrl": "https://res.cloudinary.com/...",
      "contentType": "TOP_LIST",
      "category": { "id": "uuid", "name": "Tư vấn", "slug": "tu-van", "isActive": true },
      "authorName": "Đội ngũ Mobivexa",
      "publishedAt": "2026-09-20T03:00:00.000Z",
      "readingTimeMinutes": 6,
      "viewCount": 128
    }
  ],
  "pagination": { "page": 1, "limit": 12, "total": 34, "totalPages": 3 }
}
```

- Có `category` → response kèm `category: { id, name, slug, description, parent, children }` (chỉ con đang bật)
- Có `tag` → response kèm `tag: { id, name, slug }`
- Sắp `publishedAt DESC`, `id DESC`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 404 | Danh mục không tồn tại hoặc đã tắt |
| 404 | Tag không tồn tại |

---

### GET /search
Tìm kiếm bài viết (rate limit 20/phút).

**Auth:** Không

**Query params:**
| Param | Type | Default | Mô tả |
|---|---|---|---|
| `q` | string | — | Bắt buộc, tối đa 100 ký tự |
| `page` / `limit` | number | 1 / 12 | Phân trang (trần 50) |

**Xử lý:** Full-text `simple` trên title (trọng số A) + excerpt (B); khớp cả tên tag được cộng 0.2 điểm. Sắp theo điểm rồi `publishedAt DESC`.

**Response 200:**
```json
{
  "posts": [ { "...": "PostCard như GET /posts" } ],
  "pagination": { "page": 1, "limit": 12, "total": 5, "totalPages": 1 },
  "q": "chọn máy chơi game"
}
```

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Thiếu `q` |
| 400 | `q` dài quá 100 ký tự |
| 429 | Vượt 20 lượt/phút |

---

### GET /posts/:slug
Chi tiết bài viết công khai.

**Auth:** Không

**Response 200:**
```json
{
  "post": {
    "id": "uuid",
    "title": "...",
    "slug": "...",
    "excerpt": "...",
    "coverImageUrl": "...",
    "contentType": "GUIDE",
    "category": { "id": "uuid", "name": "...", "slug": "...", "isActive": true, "parent": null },
    "authorName": "...",
    "publishedAt": "2026-09-20T03:00:00.000Z",
    "readingTimeMinutes": 6,
    "viewCount": 128,
    "contentHtml": "<h2>...</h2><p>...</p>",
    "updatedAt": "2026-09-21T01:12:00.000Z",
    "tags": [ { "id": "uuid", "name": "gaming", "slug": "gaming" } ],
    "faqs": [ { "id": "uuid", "question": "...", "answer": "..." } ],
    "relatedPosts": [ { "id": "uuid", "title": "...", "slug": "...", "excerpt": "...", "coverImageUrl": "...", "contentType": "...", "category": { "...": "..." }, "authorName": "...", "publishedAt": "...", "readingTimeMinutes": 4, "viewCount": 20 } ],
    "relatedProducts": [ { "id": "uuid", "name": "iPhone 15 Pro", "slug": "iphone-15-pro", "imageUrl": "...", "salePrice": "27990000", "originalPrice": "31990000" } ],
    "seo": {
      "title": "...",
      "description": "...",
      "keywords": null,
      "canonicalUrl": "https://<site>/tin-tuc/...",
      "ogImage": "..."
    }
  }
}
```

**Quy tắc:**
- Bài liên quan: admin chọn tay trước (tối đa 6, đúng thứ tự, chỉ bài còn công khai) — thiếu tự bổ sung bài `PUBLISHED` cùng danh mục
- `relatedProducts`: chỉ sản phẩm còn `isActive=true`; giá lấy variant rẻ nhất đang bán, dạng **string**
- SEO: `seoTitle || title`, `seoDescription || excerpt || 160 ký tự đầu của nội dung thu text`, canonical mặc định `{FRONTEND_URL}/tin-tuc/{slug}`, `ogImage = coverImageUrl`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 404 | Bài không ở trạng thái công khai, đã xoá mềm, hoặc slug sai |

---

### POST /posts/:slug/view
Đếm lượt xem (rate limit 30/phút).

**Auth:** Không

**Response:** `204 No Content`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 404 | Bài không ở trạng thái công khai |

> Tăng `viewCount` bằng SQL nguyên tử, không đụng `updatedAt`.

---

### GET /preview/:token
Xem trước bài chưa xuất bản qua token.

**Auth:** Không (token tự xác thực)

**Response 200:**
```json
{
  "post": { "...": "Chi tiết như GET /posts/:slug, bất kể trạng thái" },
  "preview": {
    "status": "DRAFT",
    "scheduledAt": null,
    "expiresAt": "2026-10-01T10:00:00.000Z"
  }
}
```

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 404 | Token sai, sai kiểu `typ`, hết hạn (1 giờ) — thông điệp gộp một: `Liên kết xem trước không hợp lệ hoặc đã hết hạn` |
| 404 | Bài đã xoá mềm |

> Token: JWT HS256, `sub = postId`, `typ = blog-preview`, ký bằng khoá HMAC-SHA256 dẫn xuất từ `JWT_ACCESS_SECRET` — chặn dò token bằng access token thật.

---

### GET /categories
Danh mục công khai.

**Auth:** Không

**Response 200:**
```json
{
  "categories": [
    { "id": "uuid", "name": "Tư vấn", "slug": "tu-van", "description": "...", "parentId": null, "sortOrder": 1, "isActive": true, "createdAt": "...", "updatedAt": "..." }
  ]
}
```

> Chỉ danh mục `isActive=true`, phẳng, sắp `sortOrder ASC` rồi `name ASC` — FE tự dựng cây.

---

### GET /content-types
14 loại nội dung cố định.

**Auth:** Không

**Response 200:**
```json
{
  "contentTypes": [
    { "value": "NEWS", "label": "Tin công nghệ" },
    { "value": "SMARTPHONE_NEWS", "label": "Tin smartphone" },
    { "value": "REVIEW", "label": "Review điện thoại" },
    { "value": "COMPARISON", "label": "So sánh sản phẩm/điện thoại" },
    { "value": "GUIDE", "label": "Hướng dẫn sử dụng" },
    { "value": "TIP_ANDROID", "label": "Thủ thuật Android" },
    { "value": "TIP_IPHONE", "label": "Thủ thuật iPhone" },
    { "value": "BUYING_ADVICE", "label": "Tư vấn mua điện thoại" },
    { "value": "TOP_LIST", "label": "Top điện thoại" },
    { "value": "PROMOTION", "label": "Khuyến mãi" },
    { "value": "BRAND_NEWS", "label": "Tin thương hiệu" },
    { "value": "ACCESSORY", "label": "Phụ kiện" },
    { "value": "KNOWLEDGE", "label": "Kiến thức công nghệ" },
    { "value": "FAQ", "label": "FAQ" }
  ]
}
```

---

### GET /sitemap.xml
Sitemap chuẩn XML.

**Auth:** Không — `Content-Type: application/xml; charset=utf-8`, `Cache-Control: public, max-age=600`

**Nội dung:** trang `/tin-tuc` (lastmod = `updatedAt` mới nhất), các trang danh mục đang bật, các bài công khai kèm `lastmod`. Loại bài cross-post có canonical trỏ origin khác.

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 503 | `FRONTEND_URL` trống hoặc không hợp lệ |

---

### GET /rss.xml
RSS 2.0, 20 bài mới nhất.

**Auth:** Không — `Content-Type: application/rss+xml; charset=utf-8`, `Cache-Control: public, max-age=600`

**Nội dung:** channel "Tin tức Mobivexa", `language: vi`, mỗi item gồm title/link/guid/pubDate/description/category; link dùng `canonicalUrl` khi có.

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 503 | `FRONTEND_URL` trống hoặc không hợp lệ |

---

# ADMIN — `/api/admin/blog` (ADMIN hoặc STAFF)

## Posts

### GET /posts
Danh sách quản trị, phân trang.

**Auth:** Bearer token (ADMIN/STAFF)

**Query params:**
| Param | Type | Mô tả |
|---|---|---|
| `page` / `limit` | number | Mặc định 20/trang, trần 50 |
| `status` | string | `DRAFT` \| `SCHEDULED` \| `PUBLISHED` \| `ARCHIVED` |
| `categoryId` | string | Lọc theo danh mục |
| `contentType` | string | Một trong 14 loại nội dung |
| `authorId` | string | Lọc theo tác giả |
| `search` | string | Chứa trong title (không phân biệt hoa thường) |
| `sort` | string | `updated` (mặc định) \| `created` \| `published` |

**Response 200:** `{ "posts": [...], "pagination": {...} }` — mỗi dòng gồm title, slug, status, scheduledAt, publishedAt, contentType, coverImageUrl, authorDisplayName, viewCount, timestamps, category, author, updatedBy.

**Lỗi:** `400` Trạng thái/loại nội dung không hợp lệ.

---

### GET /posts/:id
Chi tiết quản trị trọn vẹn: mọi field bài + tags, products (kèm `isActive`, sortOrder), relatedPosts (kèm status), faqs, author, updatedBy, và **`missingForPublish`** — mảng tên trường còn thiếu để công khai.

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 404 | Bài không tồn tại hoặc đã xoá mềm |

---

### POST /posts
Tạo bài mới (mặc định `DRAFT`).

**Auth:** Bearer token (ADMIN/STAFF) — `Content-Type: application/json`

**Request body:**
```json
{
  "title": "Top 5 máy chơi game dưới 8 triệu",
  "slug": "top-5-may-choi-game-duoi-8-trieu",
  "excerpt": "Tóm tắt ngắn",
  "contentHtml": "<h2>Nội dung</h2><p>...</p>",
  "categoryId": "uuid",
  "contentType": "TOP_LIST",
  "authorDisplayName": "Đội ngũ Mobivexa",
  "readingTimeMinutes": 6,
  "seoTitle": "...",
  "seoDescription": "...",
  "seoKeywords": "...",
  "canonicalUrl": "https://...",
  "tagIds": ["uuid"],
  "productIds": ["uuid"],
  "relatedPostIds": ["uuid"],
  "faqs": [ { "question": "Máy có bảo hành không?", "answer": "Có 12 tháng." } ]
}
```

**Validation (400 nếu vi phạm):**

| Field | Luật |
|---|---|
| `title` | Bắt buộc, 1–200 ký tự (chỉ field bắt buộc khi tạo) |
| `slug` | ≤ 200 ký tự; tự sinh từ title nếu bỏ trống |
| `excerpt` | ≤ 500 ký tự |
| `contentHtml` | ≤ 200.000 ký tự; **luôn được sanitize ở server** |
| `authorDisplayName` | ≤ 100 ký tự; bỏ trống → fullName người tạo |
| `readingTimeMinutes` | Số nguyên 1–600; bỏ trống → tự tính từ nội dung |
| `seoTitle` / `seoDescription` / `seoKeywords` | ≤ 200 / 320 / 255 ký tự |
| `canonicalUrl` | ≤ 500 ký tự, phải là URL http(s) |
| `tagIds` | ≤ 20 phần tử, tất cả là string |
| `productIds` | ≤ 20 phần tử |
| `relatedPostIds` | ≤ 6 phần tử, không chứa chính nó |
| `faqs` | ≤ 15 câu; câu hỏi 1–300, câu trả lời 1–3000 ký tự |

**Response 201:** `{ "message": "Tạo bài viết thành công", "post": { ... chi tiết quản trị } }`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Danh mục/tag/sản phẩm/bài liên quan không tồn tại |
| 409 | Slug đã được sử dụng bởi bài viết khác (kể cả bài đã xoá mềm) |

---

### PUT /posts/:id
Cập nhật một phần — chỉ gửi field muốn đổi.

**Auth:** Bearer token (ADMIN/STAFF)

**Xử lý đặc biệt:**
- `tagIds` / `productIds` / `relatedPostIds` / `faqs`: thay **toàn bộ danh sách** trong một transaction (kèm sortOrder theo thứ tự mảng)
- `readingTimeMinutes: null` → trả về tự tính; có giá trị → đánh dấu `isReadingTimeManual` (sửa nội dung sau đó không tự tính lại)
- `slug` đổi → tự sinh từ slug mới, hoặc title mới, hoặc title cũ
- **Guard công khai:** bài đang `PUBLISHED`/`SCHEDULED` không được để mất trường bắt buộc (title, slug, nội dung, danh mục, loại nội dung) sau khi áp thay đổi → `400`

**Response 200:** `{ "message": "Cập nhật bài viết thành công", "post": {...} }`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Thiếu trường bắt buộc để giữ trạng thái công khai; danh mục/tag/sản phẩm không tồn tại |
| 404 | Bài không tồn tại |
| 409 | Slug trùng; dữ liệu liên kết vừa bị thay đổi; bài vừa đổi trạng thái |

---

### PATCH /posts/:id/status
Đổi trạng thái theo bảng chuyển trạng thái duy nhất.

**Auth:** Bearer token (ADMIN/STAFF)

**Request body:**
```json
{ "status": "SCHEDULED", "scheduledAt": "2026-10-05T03:00:00.000Z" }
```

**Bảng chuyển trạng thái:**

| Từ | Cho phép sang |
|---|---|
| `DRAFT` | `SCHEDULED`, `PUBLISHED` |
| `SCHEDULED` | `DRAFT`, `SCHEDULED` (đổi giờ hẹn) |
| `PUBLISHED` | `DRAFT`, `ARCHIVED` |
| `ARCHIVED` | `DRAFT`, `PUBLISHED` |

**Quy tắc:**
- Sang `SCHEDULED`: bắt buộc `scheduledAt` hợp lệ, phải ở tương lai (dung sai 60 giây bù lệch đồng hồ)
- Sang `PUBLISHED`/`SCHEDULED`: kiểm đủ trường bắt buộc (title, slug, nội dung — có chữ hoặc ảnh, danh mục, loại nội dung, ảnh đại diện) → thiếu trả `400` kèm danh sách tên trường tiếng Việt
- Sang `PUBLISHED`: `publishedAt` set **lần đầu tiên**, gỡ rồi xuất bản lại không đổi
- Trạng thái khác có `scheduledAt = null`
- Guard trong WHERE (`updateMany WHERE id + status cũ`): hai request đổi cùng lúc → người sau `409`

**Response 200:** `{ "message": "Cập nhật trạng thái thành công", "post": { "id", "status", "scheduledAt", "publishedAt", "updatedAt" } }`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Trạng thái/scheduledAt không hợp lệ; thiếu trường để công khai |
| 404 | Bài không tồn tại |
| 409 | Chuyển đổi không nằm trong bảng; bài vừa được đổi trạng thái |

---

### DELETE /posts/:id
Xoá mềm (`deletedAt = now`). Slug vẫn giữ chỗ toàn bảng (không tái sử dụng).

**Auth:** Bearer token (ADMIN/STAFF)

**Response 200:** `{ "message": "Xoá bài viết thành công" }`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 404 | Bài không tồn tại hoặc đã xoá |

---

### PUT /posts/:id/cover
Cập nhật ảnh đại diện.

**Auth:** Bearer token (ADMIN/STAFF) — **multipart/form-data**, field `image`

**Xử lý:** upload Cloudinary `blog/covers`; upload mới thành công mới destroy ảnh cũ; upload DB lỗi → destroy ảnh vừa upload.

**Response 200:** `{ "message": "Cập nhật ảnh đại diện thành công", "post": { "id", "coverImageUrl", "updatedAt" } }`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Thiếu file (`Ảnh đại diện là bắt buộc`); file sai định dạng/quá nặng (MulterError) |
| 404 | Bài không tồn tại |

---

### DELETE /posts/:id/cover
Xoá ảnh đại diện — chỉ cho phép khi bài `DRAFT` hoặc `ARCHIVED` (bài công khai bắt buộc phải có ảnh).

**Response 200:** `{ "message": "Đã xoá ảnh đại diện" }`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Bài đang `PUBLISHED`/`SCHEDULED` — trả thiếu trường "Ảnh đại diện" |
| 404 | Bài không tồn tại |
| 409 | Trạng thái vừa bị thay đổi |

---

### POST /posts/:id/preview-token
Sinh liên kết xem trước hạn 1 giờ.

**Response 200:**
```json
{
  "token": "eyJhbGciOi...",
  "previewUrl": "https://<site>/tin-tuc/xem-truoc/<token>",
  "expiresAt": "2026-10-01T10:00:00.000Z"
}
```

> `previewUrl` trả `null` khi `FRONTEND_URL` không hợp lệ — token vẫn dùng được gọi API trực tiếp.

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 404 | Bài không tồn tại hoặc đã xoá mềm |

---

### POST /images
Upload ảnh chèn vào nội dung bài.

**Auth:** Bearer token (ADMIN/STAFF) — **multipart/form-data**, field `image`

**Response 201:**
```json
{ "url": "https://res.cloudinary.com/<cloud>/image/upload/...jpg", "publicId": "blog/content/..." }
```

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Thiếu file (`Ảnh là bắt buộc`); sai định dạng/quá nặng |

> URL trả về thuộc cloud Cloudinary của hệ thống — đây là **duy nhất** dạng `src` ảnh mà sanitize chấp nhận trong `contentHtml`.

---

### GET /product-options
Tìm sản phẩm để gắn vào bài (autocomplete).

**Query params:**
| Param | Type | Mô tả |
|---|---|---|
| `q` | string | Bắt buộc, ≤ 100 ký tự; khớp tên sản phẩm hoặc SKU variant |
| `limit` | number | 1–20, mặc định 10 |

**Response 200:** `{ "products": [ { "id", "name", "slug", "imageUrl", "isActive": true } ] }`

**Lỗi:** `400` Thiếu/từ khoá quá dài.

---

## Categories

### GET /categories
Danh sách quản trị — gồm cả danh mục đã tắt, kèm đếm.

**Response 200:** `{ "categories": [ { "...": "mọi field", "_count": { "children": 2, "posts": 12 } } ] }`

> `_count.posts` chỉ đếm bài **chưa xoá mềm**.

---

### POST /categories
Tạo danh mục.

**Request body:**
```json
{ "name": "Thủ thuật", "slug": "thu-thuat", "description": "Mẹo hay", "parentId": null, "sortOrder": 3, "isActive": true }
```

| Field | Luật |
|---|---|
| `name` | Bắt buộc, 2–100 ký tự, duy nhất |
| `slug` | ≤ 200; tự sinh từ name nếu bỏ trống |
| `description` | ≤ 500 ký tự |
| `parentId` | Cha phải là danh mục gốc; tối đa 2 cấp |
| `sortOrder` | Số nguyên |
| `isActive` | Boolean (chấp nhận "true"/"false" dạng string) |

**Response 201:** `{ "message": "Tạo danh mục thành công", "category": {...} }`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Tên sai độ dài; danh mục cha không tồn tại; vi phạm luật 2 cấp |
| 409 | Tên hoặc slug đã tồn tại |

---

### PUT /categories/:id
Cập nhật một phần — luật như POST, thêm:

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 404 | Danh mục không tồn tại |

---

### DELETE /categories/:id
Xoá cứng — chặn khi còn con hoặc còn bài sống.

**Xử lý:** bài đã xoá mềm vẫn tham chiếu `categoryId` — được tự gỡ (`categoryId = null`) trước khi xoá để không vi phạm FK.

**Response 200:** `{ "message": "Xoá danh mục thành công" }`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 404 | Danh mục không tồn tại |
| 409 | `Không thể xoá: danh mục còn danh mục con` / `Không thể xoá: danh mục đang có N bài viết` / vừa bị gán trong race |

---

### PATCH /categories/:id/status
Toggle `isActive` (bật ↔ tắt). FE tự ẩn nhánh con khi cha tắt.

**Response 200:** `{ "message": "Cập nhật trạng thái thành công", "category": {...} }`

**Lỗi:** `404` Danh mục không tồn tại.

---

## Tags

### GET /tags
Danh sách tag quản trị.

**Query params:**
| Param | Type | Mô tả |
|---|---|---|
| `search` | string | Chứa trong tên (không phân biệt hoa thường) |
| `limit` | number | 1–100, mặc định 100 |

**Response 200:** `{ "tags": [ { "id", "name", "slug", "createdAt", "_count": { "posts": 8 } } ] }` — sắp `name ASC`; `_count.posts` chỉ đếm bài chưa xoá mềm.

---

### POST /tags
Tạo tag. `name` bắt buộc 1–50 ký tự, duy nhất; `slug` tự sinh nếu bỏ trống.

**Response 201:** `{ "message": "Tạo tag thành công", "tag": {...} }`

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Tên sai độ dài |
| 409 | Tên hoặc slug đã tồn tại |

---

### PUT /tags/:id
Cập nhật một phần (`name`, `slug`) — luật như POST.

**Lỗi:** `404` Tag không tồn tại · `409` Tên/slug đã tồn tại.

---

### DELETE /tags/:id
Xoá tag — liên kết `blog_post_tags` cascade gỡ khỏi mọi bài.

**Response 200:** `{ "message": "Xoá tag thành công" }`

**Lỗi:** `404` Tag không tồn tại.
