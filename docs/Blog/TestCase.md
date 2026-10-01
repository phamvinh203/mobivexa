# Test Case Document
## Module: Blog
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01  
> **Framework:** Vitest + Supertest (blog.test.ts)

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| Public — danh sách & tìm kiếm | 6 |
| Public — chi tiết, lượt xem, danh mục | 5 |
| Preview token | 4 |
| Sitemap & RSS | 4 |
| Admin — CRUD bài viết | 7 |
| Admin — trạng thái & lazy publish | 6 |
| Admin — ảnh đại diện & ảnh nội dung | 4 |
| Admin — danh mục & tag | 7 |
| **Tổng** | **43** |

---

## TC-PUB: Danh sách & tìm kiếm

### TC-PUB-01: Chỉ trả bài PUBLISHED chưa xoá mềm

**Precondition:** 1 bài DRAFT, 1 bài SCHEDULED chưa tới giờ, 1 bài PUBLISHED, 1 bài PUBLISHED đã xoá mềm  
**Input:** `GET /api/blog/posts`  
**Expected:** HTTP `200`, chỉ thấy bài PUBLISHED còn sống

---

### TC-PUB-02: Lọc theo danh mục quét cả danh mục con

**Precondition:** Danh mục cha "Tư vấn" + con "Mẹo hay"; bài ở cả hai  
**Input:** `GET /api/blog/posts?category=tu-van`  
**Expected:** Thấy bài của cha và con; payload kèm `category.children` (chỉ con đang bật)

---

### TC-PUB-03: Danh mục tắt → 404

**Precondition:** Danh mục `isActive=false`  
**Input:** `GET /api/blog/posts?category=<slug-đã-tắt>`  
**Expected:** `404` `Danh mục không tồn tại`

---

### TC-PUB-04: Tag không tồn tại → 404

**Input:** `GET /api/blog/posts?tag=khong-ton-tai`  
**Expected:** `404` `Tag không tồn tại`

---

### TC-PUB-05: Tìm kiếm khớp title và cộng điểm tag

**Precondition:** Bài A title chứa "chơi game"; bài B gắn tag "gaming"  
**Input:** `GET /api/blog/search?q=chơi game`  
**Expected:** `200`; kết quả sắp theo điểm rồi publishedAt; response có `q` echo lại

---

### TC-PUB-06: Tìm kiếm thiếu từ khoá / quá dài / quá nhanh

**Input:** `GET /api/blog/search` không có `q`; `q` 101 ký tự; gọi quá 20 lượt/phút  
**Expected:** `400` `Vui lòng nhập từ khoá tìm kiếm` / `400` `Từ khoá tối đa 100 ký tự` / `429`

---

## TC-READ: Chi tiết, lượt xem

### TC-READ-01: Chi tiết trả đủ payload

**Expected:** `200` với `contentHtml`, `tags`, `faqs`, `relatedPosts` (≤ 6, đúng thứ tự curated trước), `relatedProducts` (chỉ sản phẩm active), `seo`

---

### TC-READ-02: Bài nháp/hẹn lịch/lưu trữ → 404

**Input:** `GET /api/blog/posts/:slug` với bài DRAFT/SCHEDULED/ARCHIVED  
**Expected:** `404` `Không tìm thấy bài viết`

---

### TC-READ-03: Bài hẹn lịch tới giờ tự xuất bản khi đọc

**Precondition:** Bài SCHEDULED với `scheduledAt` trong quá khứ  
**Action:** `GET /api/blog/posts/:slug`  
**Expected:** Bài trả về bình thường; lần GET /posts sau thấy status PUBLISHED, `publishedAt = scheduledAt`, `scheduledAt = null`

---

### TC-READ-04: Đếm lượt xem trả 204 và tăng viewCount

**Input:** `POST /api/blog/posts/:slug/view`  
**Expected:** `204`; `viewCount` +1; `updatedAt` **không** đổi (lastmod sitemap không nhảy)

---

### TC-READ-05: Đếm lượt xem bài nháp → 404

**Expected:** `404` `Không tìm thấy bài viết`

---

## TC-PREVIEW: Preview token

### TC-PREVIEW-01: Tạo token cho bài nháp

**Input:** `POST /api/admin/blog/posts/:id/preview-token`  
**Expected:** `200` có `token`, `previewUrl`, `expiresAt` (~1 giờ sau)

---

### TC-PREVIEW-02: Đọc preview bất kể trạng thái

**Input:** `GET /api/blog/preview/:token` với bài DRAFT  
**Expected:** `200` — post chi tiết đầy đủ + `preview.status = "DRAFT"`

---

### TC-PREVIEW-03: Token hết hạn / sai → 404 chung một message

**Action:** Đổi ký tự token; chờ quá 1 giờ  
**Expected:** `404` `Liên kết xem trước không hợp lệ hoặc đã hết hạn` (không phân biệt nguyên nhân)

---

### TC-PREVIEW-04: Access token không mở được preview

**Precondition:** Access token đăng nhập hợp lệ  
**Input:** `GET /api/blog/preview/<accessToken>`  
**Expected:** `404` — token preview ký bằng khoá HMAC dẫn xuất riêng, `typ` không khớp

---

## TC-SEO: Sitemap & RSS

### TC-SEO-01: Sitemap chứa trang blog, danh mục và bài công khai

**Expected:** `200` XML; có `/tin-tuc` (lastmod = updatedAt mới nhất), các danh mục đang bật, các bài PUBLISHED kèm lastmod; không có bài nháp

---

### TC-SEO-02: Bài cross-post bị loại khỏi sitemap

**Precondition:** Bài PUBLISHED có `canonicalUrl` trỏ origin khác  
**Expected:** Bài không xuất hiện trong sitemap

---

### TC-SEO-03: RSS 20 bài mới nhất, ngôn ngữ vi

**Expected:** `200` RSS 2.0; đúng 20 item mới nhất; `<language>vi</language>`; link ưu tiên canonical

---

### TC-SEO-04: Thiếu FRONTEND_URL → 503

**Precondition:** `FRONTEND_URL` trống/không hợp lệ  
**Input:** `GET /api/blog/sitemap.xml` và `/rss.xml`  
**Expected:** `503` `Chưa cấu hình FRONTEND_URL nên chưa tạo được sitemap/RSS`; previewUrl tương ứng trả null

---

## TC-POST-ADMIN: CRUD bài viết

### TC-POST-ADMIN-01: Tạo bài tối thiểu chỉ cần title

**Input:** `POST /api/admin/blog/posts { "title": "Bài mới" }`  
**Expected:** `201`; status DRAFT; slug tự sinh từ title; `missingForPublish` liệt kê trường còn thiếu

---

### TC-POST-ADMIN-02: Nội dung được sanitize

**Input:** `contentHtml` chứa `<script>alert(1)</script><h1>Tiêu đề</h1><img src="https://evil.com/a.png">`  
**Expected:** Lưu xong không còn `script`; `h1` thành `h2`; img nguồn lạ bị loại — chỉ giữ whitelist

---

### TC-POST-ADMIN-03: Ảnh chỉ nhận Cloudinary của hệ thống

**Input:** img src Cloudinary cloud khác / delivery type `image/fetch`  
**Expected:** Đều bị loại khỏi `contentHtml`

---

### TC-POST-ADMIN-04: Slug trùng (kể cả bài đã xoá mềm) → 409

**Precondition:** Bài cũ slug "bai-a" đã xoá mềm  
**Input:** Tạo bài với slug "bai-a"  
**Expected:** `409` `Slug đã được sử dụng bởi bài viết khác`

---

### TC-POST-ADMIN-05: Bài liên quan không thể là chính nó

**Input:** `relatedPostIds` chứa id của bài đang sửa  
**Expected:** `400` `Bài viết không thể liên quan tới chính nó`

---

### TC-POST-ADMIN-06: Giới hạn số lượng liên kết

**Input:** 21 tagIds / 21 productIds / 7 relatedPostIds / 16 faqs  
**Expected:** `400` với message tương ứng (`Tối đa 20 tag` / `Tối đa 6 bài viết liên quan` / `Tối đa 15 câu hỏi FAQ cho mỗi bài`)

---

### TC-POST-ADMIN-07: Sửa bài PUBLISHED làm mất ảnh → chặn

**Precondition:** Bài PUBLISHED đủ điều kiện  
**Input:** `PUT` đặt `categoryId = null`  
**Expected:** `400` `Chưa đủ điều kiện xuất bản, còn thiếu: Danh mục, ...`

---

## TC-STATUS: Trạng thái & lazy publish

### TC-STATUS-01: Chuyển đúng bảng cho phép

**Input:** DRAFT → PUBLISHED; SCHEDULED → DRAFT; PUBLISHED → ARCHIVED; ARCHIVED → PUBLISHED  
**Expected:** Tất cả `200` kèm status/scheduledAt/publishedAt mới

---

### TC-STATUS-02: Chuyển trái luật → 409

**Input:** DRAFT → ARCHIVED; PUBLISHED → SHIPPING không tồn tại  
**Expected:** `409` `Không thể chuyển bài từ Nháp sang Lưu trữ` / `400` `Trạng thái không hợp lệ`

---

### TC-STATUS-03: Hẹn lịch thiếu giờ / giờ quá khứ

**Input:** SCHEDULED không có `scheduledAt`; `scheduledAt` 5 phút trước (vượt dung sai 60s)  
**Expected:** `400` `Thời điểm hẹn lịch không hợp lệ` / `400` `Thời điểm hẹn lịch phải ở tương lai`

---

### TC-STATUS-04: publishedAt giữ lần công khai đầu

**Action:** PUBLISHED → DRAFT → PUBLISHED  
**Expected:** `publishedAt` không đổi

---

### TC-STATUS-05: Hai admin đổi trạng thái cùng lúc

**Action:** Hai request PATCH song song trên cùng bài  
**Expected:** Đúng một request `200`; request kia `409` `Bài viết vừa được thay đổi trạng thái...`

---

### TC-STATUS-06: Bài thiếu trường không xuất bản được

**Precondition:** Bài DRAFT chưa có ảnh đại diện/danh mục  
**Input:** PATCH sang PUBLISHED  
**Expected:** `400` `Chưa đủ điều kiện xuất bản, còn thiếu: Ảnh đại diện, Danh mục...`

---

## TC-MEDIA: Ảnh

### TC-MEDIA-01: Upload cover thành công, thay ảnh cũ

**Expected:** `200` `coverImageUrl` mới; ảnh cũ trên Cloudinary bị destroy

---

### TC-MEDIA-02: Thiếu file → 400

**Input:** PUT cover không có field `image`  
**Expected:** `400` `Ảnh đại diện là bắt buộc`

---

### TC-MEDIA-03: Không xoá cover của bài đang công khai

**Precondition:** Bài PUBLISHED  
**Input:** `DELETE /posts/:id/cover`  
**Expected:** `400` (thiếu trường "Ảnh đại diện"); bài DRAFT/ARCHIVED thì `200`

---

### TC-MEDIA-04: Upload ảnh nội dung trả url + publicId

**Input:** `POST /api/admin/blog/images` (multipart `image`)  
**Expected:** `201` với url thuộc cloud Cloudinary hệ thống, path `blog/content/...`

---

## TC-TAXO: Danh mục & Tag

### TC-TAXO-01: Tạo danh mục — tên duy nhất

**Input:** `POST /categories { "name": "Tư vấn" }` hai lần  
**Expected:** Lần 1 `201`; lần 2 `409` `Tên danh mục đã tồn tại`

---

### TC-TAXO-02: Chặn cây 3 cấp

**Precondition:** Cha (gốc) → Con  
**Input:** Tạo "Cháu" với `parentId = Con` (Con đang có cha)  
**Expected:** `400` `Danh mục chỉ hỗ trợ tối đa 2 cấp`

---

### TC-TAXO-03: Xoá danh mục còn bài → 409 kèm số bài

**Precondition:** Danh mục có 3 bài sống  
**Input:** `DELETE /categories/:id`  
**Expected:** `409` `Không thể xoá: danh mục đang có 3 bài viết`

---

### TC-TAXO-04: Xoá danh mục còn con → 409

**Expected:** `409` `Không thể xoá: danh mục còn danh mục con`

---

### TC-TAXO-05: Xoá danh mục gỡ categoryId của bài đã xoá mềm

**Precondition:** Danh mục chỉ còn bài đã xoá mềm tham chiếu  
**Input:** `DELETE /categories/:id`  
**Expected:** `200`; bài cũ `categoryId = null` (không vi phạm FK)

---

### TC-TAXO-06: Toggle trạng thái danh mục

**Input:** `PATCH /categories/:id/status`  
**Expected:** `200`; `isActive` đảo giá trị; danh mục tắt biến mất khỏi `GET /api/blog/categories`

---

### TC-TAXO-07: Xoá tag tự gỡ khỏi mọi bài

**Precondition:** Tag "gaming" gắn ở 2 bài  
**Input:** `DELETE /tags/:id`  
**Expected:** `200`; 2 bài còn nguyên, không còn tag "gaming"; tạo lại tag mới không lột lịch sử bài

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Bài nháp kín tuyệt đối khỏi public | TC-READ-02, TC-READ-05 |
| Lazy publish đúng giờ, không cron | TC-READ-03, TC-PUB-01 |
| Publish guard đủ 6 trường bắt buộc | TC-STATUS-06, TC-POST-ADMIN-07 |
| Bảng chuyển trạng thái + chống race | TC-STATUS-01, 02, 05 |
| Sanitize whitelist + ảnh chỉ Cloudinary | TC-POST-ADMIN-02, 03 |
| Preview HMAC 1h, tách access token | TC-PREVIEW-01..04 |
| Slug không tái sử dụng | TC-POST-ADMIN-04 |
| publishedAt bất biến | TC-STATUS-04 |
| Xoá mềm + ràng buộc danh mục/tag | TC-TAXO-03..07 |
| Sitemap/RSS chỉ nội dung công khai | TC-SEO-01..04 |
| Rate limit search/view | TC-PUB-06 |
