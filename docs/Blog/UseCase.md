# Use Case Document
## Module: Blog
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Guest / Customer** | Người đọc công khai — xem danh sách, tìm kiếm, đọc bài, sitemap/RSS |
| **Admin / Staff** | Biên tập nội dung — CRUD bài viết, danh mục, tag, ảnh, xuất bản |
| **Googlebot / bot SEO** | Thu thập sitemap.xml và rss.xml |
| **Cloudinary** | Lưu trữ ảnh đại diện và ảnh nội dung |
| **PostgreSQL** | Lưu bài viết, danh mục, tag, liên kết sản phẩm, FAQ |

---

## 2. Danh sách Use Case

| ID | Tên | Actor | Ưu tiên |
|---|---|---|---|
| UC-01 | Xem danh sách bài viết | Guest | Cao |
| UC-02 | Tìm kiếm bài viết | Guest | Cao |
| UC-03 | Đọc chi tiết bài viết | Guest | Cao |
| UC-04 | Đếm lượt xem bài viết | Guest | Trung bình |
| UC-05 | Xem trước bài chưa xuất bản | Admin (qua link) | Trung bình |
| UC-06 | Xem danh mục và loại nội dung | Guest | Trung bình |
| UC-07 | Cung cấp sitemap và RSS | Bot SEO | Trung bình |
| UC-08 | Quản lý bài viết | Admin/Staff | Cao |
| UC-09 | Quản lý danh mục blog | Admin/Staff | Trung bình |
| UC-10 | Quản lý tag blog | Admin/Staff | Trung bình |

---

## 3. Chi tiết Use Case

---

### UC-01: Xem danh sách bài viết

| | |
|---|---|
| **Actor** | Guest |
| **Mục tiêu** | Duyệt bài đã xuất bản, lọc theo danh mục/tag |
| **Tiền điều kiện** | Không cần đăng nhập |
| **Hậu điều kiện** | Bài hẹn lịch đã tới giờ được tự xuất bản (lazy publish) |

**Luồng chính:**
1. `GET /api/blog/posts?page=1&limit=12&category=&tag=`
2. Chỉ trả bài `PUBLISHED`, chưa xoá mềm, sắp `publishedAt DESC`
3. Lọc theo danh mục **bao gồm cả danh mục con**; payload kèm thông tin danh mục/tag đã lọc

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| Danh mục không tồn tại hoặc đã tắt | `404` `Danh mục không tồn tại` |
| Tag không tồn tại | `404` `Tag không tồn tại` |

---

### UC-02: Tìm kiếm bài viết

| | |
|---|---|
| **Actor** | Guest |
| **Mục tiêu** | Tìm bài theo từ khoá |
| **Tiền điều kiện** | Không cần đăng nhập; rate limit 20 lượt/phút |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/blog/search?q=&page=&limit=`
2. Full-text search `simple` trên title (trọng số A) + excerpt (B), cộng điểm 0.2 khi khớp cả tên tag
3. Sắp theo điểm giảm dần rồi `publishedAt DESC`

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| Thiếu `q` | `400` `Vui lòng nhập từ khoá tìm kiếm` |
| `q` dài quá 100 ký tự | `400` `Từ khoá tối đa 100 ký tự` |
| Từ khoá vô nghĩa (tsquery rỗng) | Trả danh sách rỗng, không lỗi |

---

### UC-03: Đọc chi tiết bài viết

| | |
|---|---|
| **Actor** | Guest |
| **Mục tiêu** | Đọc trọn nội dung bài đã xuất bản |
| **Tiền điều kiện** | Bài `PUBLISHED`, chưa xoá mềm |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/blog/posts/:slug`
2. Trả `contentHtml` (đã sanitize ở server), tags, FAQ, bài liên quan, sản phẩm liên quan, SEO
3. Bài liên quan: bài admin chọn tay trước (tối đa 6, giữ đúng thứ tự), tự bổ sung bài cùng danh mục nếu thiếu
4. Sản phẩm liên quan: chỉ liệt kê sản phẩm còn đang bán

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| Bài nháp/hẹn lịch/lưu trữ hoặc đã xoá | `404` `Không tìm thấy bài viết` |

---

### UC-04: Đếm lượt xem bài viết

| | |
|---|---|
| **Actor** | Guest |
| **Mục tiêu** | Ghi nhận một lượt đọc |
| **Tiền điều kiện** | Bài đang xuất bản; rate limit 30 lượt/phút |
| **Hậu điều kiện** | `viewCount` tăng 1 bằng SQL nguyên tử |

**Luồng chính:**
1. `POST /api/blog/posts/:slug/view`
2. `UPDATE blog_posts SET viewCount = viewCount + 1 WHERE ...` — **không qua `prisma.update`** để `updatedAt` không đổi theo (lastmod sitemap không nhảy vô nghĩa)
3. Trả `204 No Content`

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| Bài không ở trạng thái công khai | `404` `Không tìm thấy bài viết` |

---

### UC-05: Xem trước bài chưa xuất bản

| | |
|---|---|
| **Actor** | Admin/Staff (mở link preview, không cần token người dùng) |
| **Mục tiêu** | Soi bài nháp/hẹn lịch như khi đã đăng |
| **Tiền điều kiện** | Có token preview hợp lệ, hạn 1 giờ |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. Admin tạo token: `POST /api/admin/blog/posts/:id/preview-token`
2. Người xem mở `GET /api/blog/preview/:token`
3. Trả nội dung đầy đủ bất kể trạng thái + `{ status, scheduledAt, expiresAt }`

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| Token sai, sai kiểu (`typ ≠ blog-preview`) hoặc hết hạn | `404` `Liên kết xem trước không hợp lệ hoặc đã hết hạn` |
| Bài đã xoá mềm | `404` `Không tìm thấy bài viết` |

> Token là JWT HS256 ký bằng khoá **dẫn xuất** từ `JWT_ACCESS_SECRET` (HMAC-SHA256 domain `blog-preview`) — không phải access token của người dùng, không dùng được cho API khác.

---

### UC-06: Xem danh mục và loại nội dung

| | |
|---|---|
| **Actor** | Guest |
| **Mục tiêu** | Dựng menu/blog filter |
| **Tiền điều kiện** | Không cần đăng nhập |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/blog/categories` — chỉ danh mục đang bật, phẳng (FE tự dựng cây)
2. `GET /api/blog/content-types` — 14 loại nội dung cố định kèm nhãn tiếng Việt

---

### UC-07: Cung cấp sitemap và RSS

| | |
|---|---|
| **Actor** | Bot SEO / RSS reader |
| **Mục tiêu** | SEO chuẩn, đối tác đọc tin |
| **Tiền điều kiện** | `FRONTEND_URL` cấu hình hợp lệ |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/blog/sitemap.xml` — trang blog + danh mục đang bật + bài công khai (kèm `lastmod` theo `updatedAt`); loại bài cross-post có canonical trỏ site khác
2. `GET /api/blog/rss.xml` — 20 bài mới nhất, RSS 2.0, ngôn ngữ `vi`
3. Cả hai cache được ở CDN: `Cache-Control: public, max-age=600`

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| `FRONTEND_URL` trống/không hợp lệ | `503` `Chưa cấu hình FRONTEND_URL nên chưa tạo được sitemap/RSS` |

---

### UC-08: Quản lý bài viết

| | |
|---|---|
| **Actor** | Admin/Staff |
| **Mục tiêu** | Soạn, xuất bản, hẹn lịch, lưu trữ, xoá bài |
| **Tiền điều kiện** | Đã đăng nhập, role ADMIN hoặc STAFF |
| **Hậu điều kiện** | Dữ liệu bài viết thay đổi; audit qua `authorId`/`updatedById` |

**Luồng chính:**
1. CRUD: `GET/POST /posts`, `GET/PUT/DELETE /posts/:id`
2. Xuất bản/hẹn lịch: `PATCH /posts/:id/status` theo **bảng chuyển trạng thái duy nhất**
3. Ảnh đại diện: `PUT/DELETE /posts/:id/cover` (Cloudinary `blog/covers`)
4. Đính kèm: `tagIds` (≤20), `productIds` (≤20), `relatedPostIds` (≤6), `faqs` (≤15)
5. Preview: `POST /posts/:id/preview-token`; ảnh trong nội dung: `POST /images` (Cloudinary `blog/content`)
6. Trợ giúp gắn sản phẩm: `GET /product-options?q=`

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| Slug trùng bài khác | `409` `Slug đã được sử dụng bởi bài viết khác` |
| Chuyển trạng thái không nằm trong bảng | `409` `Không thể chuyển bài từ X sang Y` |
| Xuất bản/hẹn lịch thiếu trường bắt buộc | `400` `Chưa đủ điều kiện xuất bản, còn thiếu: ...` |
| Hẹn giờ trong quá khứ (dung sai 60s) | `400` `Thời điểm hẹn lịch phải ở tương lai` |
| Hai admin đổi trạng thái cùng lúc | Người sau nhận `409` (guard trạng thái trong WHERE) |

**Bảng chuyển trạng thái:** DRAFT → SCHEDULED/PUBLISHED; SCHEDULED → DRAFT/SCHEDULED (đổi giờ); PUBLISHED → DRAFT/ARCHIVED; ARCHIVED → DRAFT/PUBLISHED.

---

### UC-09: Quản lý danh mục blog

| | |
|---|---|
| **Actor** | Admin/Staff |
| **Mục tiêu** | Cây danh mục tối đa 2 cấp, bật/tắt, xoá |
| **Tiền điều kiện** | Đã đăng nhập, role ADMIN hoặc STAFF |
| **Hậu điều kiện** | Danh mục thay đổi |

**Luồng chính:**
1. `GET/POST /categories`, `PUT/DELETE /categories/:id`, `PATCH /categories/:id/status` (toggle)
2. Tên và slug đều duy nhất; tên 2–100 ký tự; giao dịch Serializable chống race trùng tên

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| Gán cha đã là danh mục con, hoặc gán cha cho danh mục đang có con | `400` `Danh mục chỉ hỗ trợ tối đa 2 cấp` |
| Xoá khi còn danh mục con | `409` `Không thể xoá: danh mục còn danh mục con` |
| Xoá khi còn bài sống | `409` `Không thể xoá: danh mục đang có N bài viết` |

---

### UC-10: Quản lý tag blog

| | |
|---|---|
| **Actor** | Admin/Staff |
| **Mục tiêu** | Nhãn bài viết tách hẳn khỏi tag sản phẩm |
| **Tiền điều kiện** | Đã đăng nhập, role ADMIN hoặc STAFF |
| **Hậu điều kiện** | Tag thay đổi; xoá tag tự gỡ khỏi mọi bài |

**Luồng chính:**
1. `GET/POST /tags`, `PUT/DELETE /tags/:id`
2. Tên 1–50 ký tự, duy nhất; xoá tag cascade gỡ liên kết ở mọi bài

---

## 4. Quan hệ Use Cases

```
UC-08 Quản lý bài viết (Admin)
   │  soạn DRAFT → PUBLISHED (hoặc SCHEDULED → tự xuất bản)
   ▼
UC-01 Danh sách ──► UC-03 Chi tiết ──► UC-04 Đếm lượt xem
                        │
        UC-02 Tìm kiếm (title + excerpt + tag)
        UC-05 Xem trước (token HMAC, chỉ admin phát hành)
        UC-07 Sitemap/RSS (chỉ bài công khai)
                        │
   UC-09 Danh mục ── lọc ──┘── UC-10 Tag ── cộng điểm tìm kiếm
```

---

## 5. So sánh với module khác

| Tiêu chí | Blog | Product | Banner |
|---|---|---|---|
| Danh mục riêng | ✅ BlogCategory (2 cấp) | Category (2 cấp) | Theo vị trí |
| Tag riêng | ✅ BlogTag | Tag | ❌ |
| Xoá | Mềm (`deletedAt`) | Tắt `isActive` | Xoá cứng |
| Hẹn giờ xuất bản | ✅ SCHEDULED + lazy publish | ❌ | ✅ startAt/endAt |
| SEO | ✅ sitemap/RSS/canonical/meta | ✅ slug + mô tả | ❌ |
