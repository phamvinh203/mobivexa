# Activity Diagram
## Module: Blog
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01

---

## AD-01: Lazy publish — bài hẹn lịch tự xuất bản

```mermaid
flowchart TD
    Trigger([Bất kỳ handler đọc/đổi trạng thái bài]) --> Run[publishDueScheduledPosts]
    Run --> SQL[UPDATE blog_posts\nSET status = PUBLISHED\npublishedAt = COALESCE publishedAt, scheduledAt\nscheduledAt = NULL\nWHERE status = SCHEDULED\nAND scheduledAt ≤ now\nAND deletedAt IS NULL]
    SQL -- lỗi --> Warn[console.warn — không chặn lượt đọc\nbài được thăng hạng ở lượt sau]
    SQL -- OK --> Continue[Tiếp tục handler bình thường]
```

> Không cần cron — bài hẹn lịch được "thăng hạng" ngay ở lượt đọc đầu tiên sau giờ hẹn (promote-on-read).

---

## AD-02: Tạo / cập nhật bài viết

```mermaid
flowchart TD
    Start([Admin POST/PUT /admin/blog/posts]) --> Auth{Đã đăng nhập\nADMIN/STAFF?}
    Auth -- Không --> E401[401]
    Auth -- Có --> Validate[validateCreatePost / validateUpdatePost\ntitle 1-200 · excerpt 500 · contentHtml 200.000\ntagIds 20 · productIds 20 · relatedPostIds 6 · faqs 15]
    Validate -- Sai --> E400a[400 message tương ứng]
    Validate -- OK --> Ref{Danh mục / tag / sản phẩm /\nbài liên quan tồn tại?}
    Ref -- Không --> E400b[400 không tồn tại]
    Ref -- relatedPostIds chứa chính nó --> E400c[400 Bài viết không thể liên quan tới chính nó]
    Ref -- OK --> Slug[resolveUniqueSlug\ntừ slug gửi lên hoặc title\ntrùng → thêm hậu tố]
    Slug --> Sanitize[sanitizeBlogHtml\nwhitelist thẻ + ảnh chỉ Cloudinary hệ thống]
    Sanitize --> PublishGuard{Bài đang PUBLISHED\nhoặc SCHEDULED?}
    PublishGuard -- Có --> Check[computeMissingForPublish trên dữ liệu SAU khi áp]
    Check -- Còn thiếu --> E400d[400 Chưa đủ điều kiện xuất bản,\ncòn thiếu: ...]
    Check -- Đủ --> Write
    PublishGuard -- Không --> Write[Write: thay cả tag/product/related/faq\ntrong 1 transaction\ncập nhật updatedById]
    Write -- P2002 slug trùng --> E409a[409 Slug đã được sử dụng]
    Write -- P2003/P2025 race --> E409b[409 dữ liệu vừa bị thay đổi,\ntải lại]
    Write -- OK --> R200[201 tạo / 200 cập nhật\ncó missingForPublish]
```

---

## AD-03: Đổi trạng thái bài viết

```mermaid
flowchart TD
    Start([Admin PATCH /posts/:id/status]) --> Lazy[publishDueScheduledPosts]
    Lazy --> Find{Bài tồn tại\nvà chưa xoá mềm?}
    Find -- Không --> E404[404 Bài viết không tồn tại]
    Find -- Có --> Status{status hợp lệ?}
    Status -- Không --> E400a[400 Trạng thái không hợp lệ]
    Status -- Có --> Table{Nằm trong bảng\nchuyển trạng thái?}
    Table -- Không --> E409a[409 Không thể chuyển bài từ X sang Y]
    Table -- Có --> Sched{Sang SCHEDULED?}
    Sched -- Có --> Time{scheduledAt hợp lệ\nvà ở tương lai, dung sai 60s?}
    Time -- Không --> E400b[400 Thời điểm hẹn lịch phải ở tương lai]
    Time -- OK --> Guard
    Sched -- Không --> SetNull[scheduledAt = null\nGuard]
    Guard{Sang PUBLISHED/SCHEDULED?}
    Guard -- Có --> Missing{Đủ trường bắt buộc?}
    Missing -- Không --> E400c[400 Chưa đủ điều kiện xuất bản,\ncòn thiếu: ...]
    Missing -- Đủ --> PubAt
    Guard -- Không --> PubAt{Sang PUBLISHED?}
    PubAt -- Có --> First[publishedAt giữ lần công khai đầu\ncó rồi thì không đổi]
    PubAt -- Không --> Update[updateMany WHERE id AND status cũ\nguard chống ghi đè song song]
    First --> Update
    Update -- count = 0 --> E409b[409 Bài vừa được đổi trạng thái]
    Update -- OK --> R200[200 status + scheduledAt + publishedAt]
```

**Bảng chuyển trạng thái:**

| Từ | Cho phép sang |
|---|---|
| `DRAFT` | `SCHEDULED`, `PUBLISHED` |
| `SCHEDULED` | `DRAFT`, `SCHEDULED` (đổi giờ hẹn) |
| `PUBLISHED` | `DRAFT`, `ARCHIVED` |
| `ARCHIVED` | `DRAFT`, `PUBLISHED` |

---

## AD-04: Xem trước bằng preview token

```mermaid
flowchart TD
    Create([Admin POST /posts/:id/preview-token]) --> Check{Bài tồn tại,\nchưa xoá mềm?}
    Check -- Không --> E404a[404 Bài viết không tồn tại]
    Check -- Có --> Sign[jwt.sign sub = postId, typ = blog-preview\nHS256, khoá HMAC-SHA256\ndẫn xuất từ JWT_ACCESS_SECRET\nexpiresIn 1h]
    Sign --> R200[200 token + previewUrl + expiresAt]

    Read([GET /blog/preview/:token]) --> Verify{jwt.verify đúng khoá dẫn xuất,\ntyp = blog-preview, còn hạn?}
    Verify -- Không --> E404b[404 Liên kết xem trước không hợp lệ\nhoặc đã hết hạn]
    Verify -- Có --> Lazy[publishDueScheduledPosts]
    Lazy --> Post{Bài còn sống?}
    Post -- Không --> E404c[404 Không tìm thấy bài viết]
    Post -- Có --> Detail[Chi tiết đầy đủ bất kể trạng thái\n+ preview status, scheduledAt, expiresAt]
```

> Khoá preview là HMAC của `JWT_ACCESS_SECRET` — token preview không dùng được như access token, access token không mở được preview.

---

## AD-05: Xoá danh mục

```mermaid
flowchart TD
    Start([Admin DELETE /admin/blog/categories/:id]) --> Find{Danh mục tồn tại?}
    Find -- Không --> E404[404 Danh mục không tồn tại]
    Find -- Có --> Counts[Đếm bài sống theo categoryId\nvà danh mục con]
    Counts --> Children{Còn danh mục con?}
    Children -- Có --> E409a[409 Không thể xoá:\ndanh mục còn danh mục con]
    Children -- Không --> Posts{Còn bài sống?}
    Posts -- Có --> E409b[409 Không thể xoá:\ndanh mục đang có N bài viết]
    Posts -- Không --> Detach[Transaction:\n1. Bài đã xoá mềm → categoryId = null\n2. DELETE danh mục]
    Detach -- P2003 race --> E409c[409 vừa được gán bài hoặc con,\ntải lại]
    Detach -- OK --> R200[200 Xoá danh mục thành công]
```
