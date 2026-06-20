# BRD — Business Requirement Document
## Module: Review (Đánh giá sản phẩm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-20  
> **Người soạn:** Product Manager  

---

## 1. Bối cảnh kinh doanh

Mobivexa là nền tảng thương mại điện tử bán thiết bị di động và phụ kiện tại Việt Nam. Module Review là **yếu tố then chốt trong việc xây dựng niềm tin và thúc đẩy quyết định mua hàng** — cho phép khách hàng đã mua hàng chia sẻ trải nghiệm thực tế, giúp những người mua tiềm năng có thêm thông tin đáng tin cậy.

Hệ thống phục vụ 3 nhóm người dùng chính:

| Nhóm | Mô tả |
|---|---|
| **Khách (Public visitors)** | Người chưa đăng nhập, có thể xem đánh giá nhưng không thể tạo/sửa/xóa |
| **Khách hàng (Customers)** | Người đã đăng nhập và đã mua hàng, có thể tạo/sửa/xóa đánh giá cho sản phẩm đã mua |
| **Admin (Quản trị viên)** | Người quản lý hệ thống, có thể xem/tất cả đánh giá, trả lời đánh giá, xóa nếu vi phạm |

### Workflow Đánh giá Sản phẩm:

1. Khách hàng đặt đơn hàng và chờ giao hàng
2. Đơn hàng được giao thành công (trạng thái `DELIVERED`)
3. Khách hàng nhận email/m thông báo mời đánh giá sản phẩm
4. Khách hàng vào trang sản phẩm hoặc trang đơn hàng để viết đánh giá
5. Khách hàng tạo đánh giá với rating (1-5 sao), nội dung văn bản, và ảnh (tùy chọn)
6. Đánh giá được **tự động duyệt** (auto-approve) và hiển thị công khai ngay lập tức
7. Khách hàng khác có thể đánh dấu "Hữu ích" (Helpful) cho đánh giá
8. Admin có thể trả lời đánh giá để giải đáp thắc mắc hoặc cảm ơn
9. Khách hàng có thể sửa đánh giá trong vòng **30 ngày** kể từ khi tạo

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường thành công |
|---|---|---|
| **BG-01** | Cho phép chỉ khách hàng đã mua hàng được đánh giá | 100% đánh giá đến từ OrderItem đã DELIVERED |
| **BG-02** | Tự động duyệt đánh giá để hiển thị ngay lập tức | 100% đánh giá được auto-approve, không cần moderation |
| **BG-03** | Hỗ trợ đánh giá phong phú với ảnh | Tối đa 5 ảnh/đánh giá, upload qua Cloudinary |
| **BG-04** | Cho phép sửa đánh giá trong thời gian hợp lý | Khách hàng có thể sửa trong 30 ngày kể từ khi tạo |
| **BG-05** | Hệ thống bình chọn "Hữu ích" để nổi bật đánh giá chất lượng | Tối thiểu 20% đánh giá có helpful vote |
| **BG-06** | Admin có thể trả lời đánh giá | 100% đánh giá có admin response (trong 48h) |
| **BG-07** | Công khai đánh giá để thúc đẩy quyết định mua | Tỷ lệ chuyển đổi tăng 15% khi sản phẩm có ≥10 đánh giá |

---

## 3. Các bên liên quan (Stakeholders)

| Stakeholder | Vai trò | Kỳ vọng |
|---|---|---|
| **Khách hàng (đã mua)** | Người tạo đánh giá | Có thể đánh giá dễ dàng, sửa lỗi trong 30 ngày, xóa nếu muốn |
| **Khách (tiềm năng)** | Người đọc đánh giá | Thấy được đánh giá từ người mua thật, có ảnh, helpful vote |
| **Admin** | Quản lý đánh giá | Có thể trả lời, xem thống kê, xóa đánh giá vi phạm |
| **Support team** | Hỗ trợ khách hàng | Xử lý khiếu nại về đánh giá, hướng dẫn cách đánh giá |
| **Product team** | Quản lý sản phẩm | Dùng đánh giá để cải thiện sản phẩm, marketing |
| **Dev team** | Phát triển & vận hành | Xử lý upload ảnh, helpful vote, edit window |

---

## 4. Yêu cầu kinh doanh

### 4.1 Tạo đánh giá (Review Creation)

**Mô tả:** Khách hàng tạo đánh giá cho sản phẩm đã mua.

| Yêu cầu | Chi tiết |
|---|---|
| **Điều kiện tiên quyết** | Khách hàng phải đã đăng nhập (JWT token CUSTOMER+) |
| **Điều kiện OrderItem** | OrderItem phải tồn tại và `order.status = DELIVERED` |
| **Mỗi OrderItem đánh giá 1 lần** | 1 OrderItem → 1 Review (quan hệ 1:1) |
| **Rating bắt buộc** | Số sao từ 1-5, không để trống |
| **Comment tùy chọn** | Nội dung văn bản có thể để trống hoặc dài tối đa 2000 ký tự |
| **Ảnh tùy chọn** | Có thể upload từ 0-5 ảnh qua Cloudinary |
| **Auto-approve** | Đánh giá được auto-approved (`status = APPROVED`) ngay khi tạo |
| **Public visibility** | Đánh giá hiển thị công khai ngay sau khi tạo |

**Ràng buộc:**
- OrderItem không tồn tại → `404` `Sản phẩm trong đơn hàng không tồn tại`
- OrderItem chưa DELIVERED → `400` `Chỉ có thể đánh giá khi đơn hàng đã giao thành công`
- OrderItem đã được đánh giá → `400` `Bạn đã đánh giá sản phẩm này rồi`
- Rating < 1 hoặc > 5 → `400` `Đánh giá phải từ 1 đến 5 sao`
- Comment > 2000 ký tự → `400` `Nội dung quá dài (tối đa 2000 ký tự)`
- Ảnh > 5 → `400` `Chỉ được upload tối đa 5 ảnh`

**Business Rules:**
- **BR-01**: Chỉ khách hàng đã mua hàng và đã nhận hàng (DELIVERED) mới được đánh giá
- **BR-02**: Mỗi OrderItem chỉ được đánh giá đúng 1 lần (không sửa bằng cách tạo mới)
- **BR-03**: Đánh giá được public ngay lập tức (auto-approve workflow)
- **BR-04**: Owner của Review là Customer đã tạo, không thể transfer

---

### 4.2 Sửa đánh giá (Review Editing)

**Mô tả:** Khách hàng có thể sửa đánh giá trong 30 ngày kể từ khi tạo.

| Yêu cầu | Chi tiết |
|---|---|
| **Thời gian cho phép** | Chỉ sửa trong vòng 30 ngày kể từ `createdAt` |
| **Owner check** | Chỉ người tạo đánh giá mới được sửa |
| **Có thể sửa gì** | Rating, comment, thêm/xóa ảnh |
| **Không thể sửa gì** | OrderItem liên kết, người tạo, thời gian tạo |
| **Ảnh khi sửa** | Có thể thêm/bớt ảnh nhưng tổng ≤ 5 ảnh |
| **Giữ nguyên helpful votes** | Số helpful votes không đổi khi sửa |
| **Giữ nguyên admin response** | Admin response không bị xóa khi sửa |
| **Auto-approve sau sửa** | Vẫn auto-approve, không cần re-moderation |

**Ràng buộc:**
- Quá 30 ngày → `400` `Đã quá thời hạn sửa đánh giá (30 ngày)`
- Không phải owner → `403` `Bạn không có quyền sửa đánh giá này`
- Rating không hợp lệ → `400` `Đánh giá phải từ 1 đến 5 sao`

**Business Rules:**
- **BR-05**: Cửa sổ sửa 30 ngày là cân bằng giữa flexibility và data stability
- **BR-06**: Sau 30 ngày, đánh giá được "khóa" để bảo đảm tính toàn vẹn dữ liệu
- **BR-07**: Helpful votes và admin response được bảo toàn khi sửa

---

### 4.3 Xóa đánh giá (Review Deletion)

**Mô tả:** Khách hàng có thể xóa đánh giá của chính mình.

| Yêu cầu | Chi tiết |
|---|---|
| **Owner check** | Chỉ người tạo đánh giá mới được xóa |
| **Xóa vĩnh viễn** | Hard delete, không soft delete |
| **Cascade delete** | Xóa Review → xóa luôn Helpful votes, Admin response, Photos |
| **OrderItem có thể đánh giá lại** | Sau khi xóa, OrderItem có thể được đánh giá lại (tạo Review mới) |
| **Không thể hồi phục** | Sau khi xóa, không thể restore (không có undo) |

**Ràng buộc:**
- Không phải owner → `403` `Bạn không có quyền xóa đánh giá này`
- Review không tồn tại → `404` `Đánh giá không tồn tại`

**Business Rules:**
- **BR-08**: Xóa vĩnh viễn để tuân thủ GDPR (right to be forgotten)
- **BR-09**: Cho phép đánh giá lại sau khi xóa để cho phép sửa lỗi sai lớn

---

### 4.4 Quản lý ảnh (Photo Management)

**Mô tả:** Khách hàng có thể upload ảnh minh họa cho đánh giá.

| Yêu cầu | Chi tiết |
|---|---|
| **Số lượng tối đa** | 5 ảnh/đánh giá |
| **Upload qua Cloudinary** | Sử dụng Cloudinary API để upload và lưu trữ |
| **Định dạng hỗ trợ** | JPG, JPEG, PNG |
| **Kích thước tối đa** | 5MB/ảnh |
| **Auto-resize** | Cloudinary tự resize tối đa 1920x1080 |
| **Xóa ảnh** | Khi xóa Review, tất cả ảnh được xóa khỏi Cloudinary |
| **Moderation ảnh** | Cloudinary AI detection để filter NSFW content |

**Ràng buộc:**
- Upload > 5 ảnh → `400` `Chỉ được upload tối đa 5 ảnh`
- File > 5MB → `400` `Kích thước ảnh tối đa 5MB`
- Định dạng không hỗ trợ → `400` `Chỉ hỗ trợ JPG, JPEG, PNG`

**Business Rules:**
- **BR-10**: 5 ảnh/đánh giá là cân bằng giữa richness và storage cost
- **BR-11**: Cloudinary AI moderation tự động filter NSFW content
- **BR-12**: Ảnh được xóa vĩnh viễn khi Review bị xóa (GDPR compliance)

---

### 4.5 Helpful Voting (Bình chọn Hữu ích)

**Mô tả:** Khách hàng có thể đánh dấu đánh giá là "Hữu ích".

| Yêu cầu | Chi tiết |
|---|---|
| **Toggle behavior** | Click lần đầu → helpful, click lần nữa → unhelpful |
| **Ai có thể vote** | Bất kỳ khách hàng nào đã đăng nhập (CUSTOMER+) |
| **Không vote đánh giá của mình** | Owner không thể vote helpful cho đánh giá của chính mình |
| **Anonymous** | Vote là anonymous, không hiển thị ai đã vote |
| **Display count** | Hiển thị số lượng helpful votes công khai |
| **Sort by helpful** | Có thể sort đánh giá theo số helpful votes |

**Ràng buộc:**
- Vote cho đánh giá của mình → `400` `Bạn không thể vote cho đánh giá của mình`
- Chưa đăng nhập → `401` `Yêu cầu đăng nhập để vote`

**Business Rules:**
- **BR-13**: Toggle behavior cho phép thay đổi quyết định dễ dàng
- **BR-14**: Helpful votes là social proof để nổi bật đánh giá chất lượng
- **BR-15**: Mỗi customer chỉ được vote 1 lần/đánh giá

---

### 4.6 Admin Response (Trả lời Admin)

**Mô tả:** Admin có thể trả lời đánh giá của khách hàng.

| Yêu cầu | Chi tiết |
|---|---|
| **Ai có thể trả lời** | Chỉ Admin (ADMIN role) |
| **Nội dung trả lời** | Văn bản, tối đa 2000 ký tự |
| **Bắt buộc** | Không bắt buộc — Admin có thể trả lời hoặc không |
| **SLA trả lời** | Target 48h cho đánh giá < 3 sao |
| **Public visibility** | Admin response hiển thị công khai bên dưới đánh giá |
| **Edit response** | Admin có thể sửa response của chính mình |
| **Delete response** | Admin có thể xóa response (không xóa Review) |

**Ràng buộc:**
- Phải là Admin → `403` `Chỉ admin mới có quyền trả lời`
- Response > 2000 ký tự → `400` `Nội dung quá dài (tối đa 2000 ký tự)`

**Business Rules:**
- **BR-16**: Admin response để giải đáp thắc mắc và xây dựng thương hiệu
- **BR-17**: Target 48h cho đánh giá tiêu cực để giảm customer churn
- **BR-18**: Admin response được hiển thị rõ ràng, không thể混淆 với Review

---

### 4.7 Public Access (Truy cập Công khai)

**Mô tả:** Người dùng chưa đăng nhập có thể xem đánh giá công khai.

| Yêu cầu | Chi tiết |
|---|---|
| **Không cần đăng nhập** | Public endpoints không yêu cầu JWT token |
| **Xem danh sách** | GET /products/:id/reviews — danh sách tất cả đánh giá của sản phẩm |
| **Xem chi tiết** | GET /reviews/:id — chi tiết một đánh giá |
| **Xem thống kê** | GET /products/:id/reviews/summary — tóm tắt đánh giá (avg rating, distribution) |
| **Sort & Filter** | Có thể sort theo newest, oldest, highest rating, lowest rating, most helpful |
| **Pagination** | Mỗi trang 20 đánh giá, hỗ trợ cursor-based pagination |

**Ràng buộc:**
- Chỉ hiển thị Review có `status = APPROVED`
- Review bị xóa không hiển thị
- Internal notes không hiển thị công khai

**Business Rules:**
- **BR-19**: 100% đánh giá được auto-approve nên public access luôn đầy đủ
- **BR-20**: Summary stats (avg rating, distribution) được cache 5 phút

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Chỉ tiêu | Giá trị |
|---|---|
| Tạo đánh giá | < 500ms (p95) (bao gồm upload ảnh) |
| Sửa đánh giá | < 300ms (p95) |
| Xóa đánh giá | < 200ms (p95) |
| Helpful vote toggle | < 100ms (p95) |
| Get danh sách đánh giá | < 400ms (p95) |
| Get summary stats | < 100ms (p95) (cached) |

---

### 5.2 Scalability

| Yêu cầu | Chi tiết |
|---|---|
| Số review tối đa/sản phẩm | Không giới hạn (hard limit: 1M) |
| Số ảnh/review | Tối đa 5 ảnh/review |
| Số helpful vote/review | Không giới hạn |
| Concurrent users | 100+ users tạo/edit review cùng lúc |
| Storage | Cloudinary CDN cho ảnh, DB cho metadata |

---

### 5.3 Security

| Yêu cầu | Mô tả |
|---|---|
| **Customer endpoints** | Yêu cầu JWT token (CUSTOMER+) |
| **Admin endpoints** | Yêu cầu JWT token (ADMIN) |
| **Owner check** | Verify `review.userId === currentUserId` cho edit/delete |
| **Cloudinary signature** | Upload ảnh phải có valid signature từ server |
| **NSFW detection** | Cloudinary AI auto-filter inappropriate content |
| **Rate limiting** | Giới hạn 5 review/phút/user để tránh spam |
| **SQL Injection prevention** | Prisma ORM escape input |

---

### 5.4 Availability

| Yêu cầu | Giá trị |
|---|---|
| **Uptime target** | 99.9% |
| **Image upload** | 99.5% (fallback: skip ảnh nếu Cloudinary down) |
| **Helpful vote** | 99.9% (can retry on client) |

---

### 5.5 Data Retention

| Yêu cầu | Chi tiết |
|---|---|
| **Review retention** | Vĩnh viễn (trừ khi bị xóa bởi owner hoặc admin) |
| **Image retention** | Vĩnh viễn trên Cloudinary (trừ khi Review bị xóa) |
| **GDPR compliance** | User request delete → xóa Review + ảnh vĩnh viễn trong 30 ngày |
| **Admin logs** | Lưu all admin actions (edit/delete review) trong 1 năm |

---

## 6. Dependencies

| Module | Dependency | Chi tiết |
|---|---|---|
| **Review ↔ Order** | FK | `orderItemId` → OrderItem.id (validate DELIVERED) |
| **Review ↔ Product** | FK | `productId` → Product.id (hiển thị trên trang sản phẩm) |
| **Review ↔ User** | FK | `userId` → User.id (owner, helpful vote) |
| **Review ↔ Cloudinary** | External API | Upload/delete ảnh, NSFW detection |
| **Review ↔ Notification** | Service | Gửi email mời đánh giá khi đơn DELIVERED |
| **Review ↔ Analytics** | Service | Track review completion rate, helpful vote rate |

---

## 7. Risks & Assumptions

### 7.1 Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| **R-01** | Khách hàng tạo đánh giá giả (mua rồi trả) | Cao | Chỉ cho phép đánh giá sau DELIVERED; monitor return rate |
| **R-02** | Upload ảnh NSFW bypass Cloudinary detection | Trung bình | Cloudinary AI + report button để user flag |
| **R-03** | Helpful vote bị tấn công (bot vote 5 sao) | Trung bình | Rate limiting; CAPTCHA cho vote; detect suspicious patterns |
| **R-04** | Khách hàng xóa đánh giá sau khi đã read | Thấp | Không thể undo; privacy policy rõ ràng |
| **R-05** | Cloudinary downtime → không upload ảnh | Trung bình | Fallback: cho phép tạo review không có ảnh |
| **R-06** | Admin không trả lời review kịp thời | Trung bình | SLA tracking; auto-assign to support team |
| **R-07** | Khách hàng sửa review để thay đổi hoàn toàn | Thấp | Audit log track changes; flag suspicious edits |
| **R-08** | Database quá lớn do 1M+ reviews | Thấp | Archive reviews cũ (>2 năm); pagination luôn enabled |

---

### 7.2 Assumptions

| ID | Assumption |
|---|---|
| **A-01** | OrderItem có `status` field và `DELIVERED` là trạng thái cuối |
| **A-02** | Khách hàng có email/SMS để nhận thông báo mời đánh giá |
| **A-03** | Cloudinary account có sufficient bandwidth và storage |
| **A-04** | Khách hàng chấp nhận 5 ảnh là đủ cho minh họa |
| **A-05** | 30 ngày edit window là cân bằng và không cần policy phức tạp hơn |
| **A-06** | Auto-approve workflow không tạo ra rủi ro content moderation lớn |
| **A-07** | Helpful vote toggle behavior đủ cho use case (không need downvote) |
| **A-08** | Admin response không cần approval (trusted admins) |
| **A-09** | Khách hàng không cần export/import reviews (không phải feature) |
| **A-10** | Public access không cần rate limiting (read-heavy) |

---

## 8. Success Metrics

| Metric | Target | How to measure |
|---|---|---|
| **Review completion rate** | ≥ 40% | Số OrderItem DELIVERED có review / Tổng OrderItem DELIVERED |
| **Review with photo rate** | ≥ 15% | Số review có ảnh / Tổng review |
| **Helpful vote rate** | ≥ 20% | Số review có ≥1 helpful vote / Tổng review |
| **Admin response SLA** | ≥ 90% trong 48h | Số review <3 sao có response trong 48h / Tổng review <3 sao |
| **Review authenticity** | 100% | 100% review liên kết với OrderItem DELIVERED |
| **Average rating** | 4.2+ | Trung bình rating tất cả review (indicates product quality) |
| **Review edit rate** | < 10% | Số review được edit / Tổng review (indicates initial quality) |
| **Review deletion rate** | < 5% | Số review bị xóa / Tổng review (indicates satisfaction) |
| **Conversion lift** | +15% | Tỷ lệ chuyển đổi sản phẩm có ≥10 review vs sản phẩm 0 review |
| **NSFW photo detection** | ≥ 95% | Cloudinary AI detection accuracy (false positive rate <5%) |

---

## 9. Timeline & Phases

### Phase 1: Foundation (Week 1-2)
- ✅ Database schema: Review, ReviewPhoto, HelpfulVote, AdminResponse
- ✅ API endpoints: Create, Update, Delete, Get by ID
- ✅ Business logic: Validate OrderItem DELIVERED, 1 review per OrderItem
- ✅ Auto-approve workflow (status = APPROVED)

### Phase 2: Public Access & Display (Week 3)
- ✅ Public endpoints: Get list by product, Get summary stats
- ✅ Sort & filter: newest, oldest, highest/lowest rating, most helpful
- ✅ Pagination: cursor-based cho performance
- ✅ Display logic: Product page hiển thị summary + top reviews

### Phase 3: Photo Upload (Week 4)
- ✅ Cloudinary integration: upload, delete, NSFW detection
- ✅ Photo management: max 5 photos, auto-resize
- ✅ Cascade delete: xóa Review → xóa photos trên Cloudinary
- ✅ Display photos trong review list và detail

### Phase 4: Helpful Voting (Week 5)
- ✅ Helpful vote API: toggle behavior, prevent self-vote
- ✅ Display helpful count trong review list
- ✅ Sort by most helpful
- ✅ Rate limiting để tránh abuse

### Phase 5: Admin Tools (Week 6)
- ✅ Admin dashboard: list all reviews, filter by rating, status
- ✅ Admin response: create, edit, delete
- ✅ Admin analytics: review completion rate, helpful vote rate
- ✅ SLA tracking: reviews <3 stars chưa được response

### Phase 6: Notifications (Week 7)
- ⏳ Email notification khi đơn DELIVERED → mời đánh giá
- ⏳ Email notification khi Admin trả lời review
- ⏳ Reminder email: nếu chưa đánh giá sau 7 ngày

### Phase 7: Advanced Features (Future)
- ⏳ Review badges: "Verified Purchase", "Top Reviewer"
- ⏳ Review comments: cho phép reply khác review
- ⏳ Review export: cho phép user export all reviews
- ⏳ Review analytics: thống kê review theo thời gian, theo category

---

## 10. Appendix

### 10.1 Terminology

| Term | Definition |
|---|---|
| **Review** | Đánh giá sản phẩm — bao gồm rating (1-5 sao), comment, photos |
| **OrderItem** | Mỗi sản phẩm trong đơn hàng — quan hệ 1:1 với Review |
| **DELIVERED** | Trạng thái đơn hàng đã giao thành công — điều kiện tiên quyết để đánh giá |
| **Auto-approve** | Tự động duyệt — review được public ngay lập tức mà không cần moderation |
| **Helpful vote** | Bình chọn hữu ích — khách hàng có thể vote review là "hữu ích" |
| **Toggle behavior** | Click lần đầu → select, click lần nữa → deselect |
| **Edit window** | Thời gian cho phép sửa review — 30 ngày kể từ khi tạo |
| **Cloudinary** | Service cloud storage và image processing — lưu trữ photos |
| **NSFW detection** | AI filter để phát hiện nội dung không phù hợp |
| **Admin response** | Trả lời từ admin cho review — public, không thể混淆 với review |
| **Verified purchase** | Review từ người mua thật (gắn với OrderItem DELIVERED) |
| **Summary stats** | Thống kê tóm tắt — avg rating, distribution (5 sao: X%, 4 sao: Y%, ...) |
| **Cursor-based pagination** | Phân trang dùng cursor thay vì offset — performance tốt hơn |
| **SLA** | Service Level Agreement — target thời gian phản hồi (48h cho review <3 sao) |

---

### 10.2 Related Documents

| Document | Link |
|---|---|
| Business Requirements (Current) | [BRD.md](./BRD.md) |
| Software Requirements | [SRS.md](./SRS.md) |
| Use Case Document | [UseCase.md](./UseCase.md) |
| API Specification | [APISpec.md](./APISpec.md) |
| Database Schema | [ERD.md](./ERD.md) |
| Test Cases | [TestCase.md](./TestCase.md) |

---

### 10.3 Business Rules Summary

| Rule | Description |
|---|---|
| **BR-01** | Chỉ khách hàng đã mua hàng (OrderItem) và đã nhận hàng (DELIVERED) mới được đánh giá |
| **BR-02** | Mỗi OrderItem chỉ được đánh giá đúng 1 lần — không tạo lại nếu đã có Review |
| **BR-03** | Đánh giá được auto-approve ngay lập tức — không cần moderation |
| **BR-04** | Owner của Review là Customer đã tạo — không thể transfer |
| **BR-05** | Cửa sổ sửa 30 ngày — balance giữa flexibility và data stability |
| **BR-06** | Sau 30 ngày — Review bị "khóa", không thể sửa |
| **BR-07** | Helpful votes và Admin response được bảo toàn khi sửa Review |
| **BR-08** | Xóa Review vĩnh viễn — GDPR compliance |
| **BR-09** | Cho phép đánh giá lại sau khi xóa — cho phép sửa lỗi sai lớn |
| **BR-10** | 5 ảnh/review — balance giữa richness và storage cost |
| **BR-11** | Cloudinary AI moderation — auto-filter NSFW content |
| **BR-12** | Ảnh xóa vĩnh viễn khi Review bị xóa — GDPR compliance |
| **BR-13** | Helpful vote toggle behavior — dễ thay đổi quyết định |
| **BR-14** | Helpful votes là social proof — nổi bật review chất lượng |
| **BR-15** | Mỗi customer chỉ vote 1 lần/review |
| **BR-16** | Admin response — giải đáp thắc mắc và xây dựng thương hiệu |
| **BR-17** | Target 48h cho review <3 sao — giảm customer churn |
| **BR-18** | Admin response hiển thị rõ ràng — không confusion với Review |
| **BR-19** | 100% review auto-approve — public access luôn đầy đủ |
| **BR-20** | Summary stats cached 5 phút — performance optimization |

---

### 10.4 Review Status Lifecycle

```
Order Created (status = PENDING)
    ↓
Order Shipped (status = SHIPPED)
    ↓
Order Delivered (status = DELIVERED) ← Mời đánh giá
    ↓
Customer creates Review (status = APPROVED) ← Auto-approve
    ↓
Customer edits Review (within 30 days) ← Optional
    ↓
After 30 days → Review locked (cannot edit)
```

**Alternative paths:**
- Customer deletes Review → OrderItem có thể đánh giá lại
- Admin deletes Review (vi phạm) → Không thể đánh giá lại
- Helpful vote added/removed → Toggle behavior
- Admin response added/edited/deleted → Admin action

---

### 10.5 API Endpoints Summary

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/reviews` | POST | CUSTOMER+ | Tạo review mới |
| `/reviews/:id` | PUT | CUSTOMER+ (owner) | Sửa review (30 ngày) |
| `/reviews/:id` | DELETE | CUSTOMER+ (owner) | Xóa review vĩnh viễn |
| `/reviews/:id/helpful` | POST | CUSTOMER+ | Toggle helpful vote |
| `/reviews/:id/response` | POST | ADMIN | Tạo admin response |
| `/reviews/:id/response` | PUT | ADMIN | Sửa admin response |
| `/reviews/:id/response` | DELETE | ADMIN | Xóa admin response |
| `/products/:id/reviews` | GET | Public | Danh sách review của sản phẩm |
| `/products/:id/reviews/summary` | GET | Public | Thống kê tóm tắt |
| `/reviews/:id` | GET | Public | Chi tiết review |
| `/admin/reviews` | GET | ADMIN | Admin dashboard |

---

### 10.6 Database Relationships

```
User (1) ←→ (N) Order
Order (1) ←→ (N) OrderItem
OrderItem (1) ←→ (1) Review
Review (1) ←→ (N) ReviewPhoto
Review (1) ←→ (N) HelpfulVote
Review (1) ←→ (1) AdminResponse
Product (1) ←→ (N) Review
User (1) ←→ (N) Review (owner)
User (1) ←→ (N) HelpfulVote
```

**Key constraints:**
- `OrderItem.reviewId` — UNIQUE (1 orderItem → 1 review)
- `Review.userId` — FK → User.id
- `Review.productId` — FK → Product.id
- `HelpfulVote.userId` — UNIQUE per reviewId (1 vote/review/user)
- `AdminResponse.reviewId` — UNIQUE (1 response/review)

---

### 10.7 Example Review Payload

```json
{
  "id": "rev_123456789",
  "rating": 5,
  "comment": "Sản phẩm rất tốt, giao hàng nhanh, đóng gói cẩn thận. Sẽ ủng hộ shop dài dài!",
  "photos": [
    {
      "url": "https://res.cloudinary.com/mobivexa/image/upload/v1234567/abc1.jpg",
      "publicId": "mobivexa/reviews/abc1"
    },
    {
      "url": "https://res.cloudinary.com/mobivexa/image/upload/v1234567/abc2.jpg",
      "publicId": "mobivexa/reviews/abc2"
    }
  ],
  "helpfulCount": 12,
  "hasHelpfulFromCurrentUser": true,
  "adminResponse": {
    "content": "Cảm ơn bạn đã đánh giá 5 sao! Mobivexa luôn nỗ lực mang lại trải nghiệm tốt nhất cho khách hàng.",
    "createdAt": "2026-06-20T10:30:00Z",
    "updatedAt": "2026-06-20T10:30:00Z"
  },
  "user": {
    "id": "user_456",
    "name": "Nguyễn Văn A",
    "avatar": "https://res.cloudinary.com/mobivexa/image/upload/v1234567/avatar456.jpg"
  },
  "orderItem": {
    "id": "oi_789",
    "productName": "iPhone 15 Pro Max 256GB",
    "variant": "Titanium Blue",
    "orderCode": "ORD-123456"
  },
  "status": "APPROVED",
  "canEdit": true,
  "canDelete": true,
  "editWindowEndsAt": "2026-07-20T00:00:00Z",
  "createdAt": "2026-06-20T08:00:00Z",
  "updatedAt": "2026-06-20T08:00:00Z"
}
```

---

### 10.8 Example Summary Stats Payload

```json
{
  "averageRating": 4.3,
  "totalReviews": 156,
  "ratingDistribution": {
    "5": 89,
    "4": 42,
    "3": 18,
    "2": 5,
    "1": 2
  },
  "ratingPercentage": {
    "5": 57.05,
    "4": 26.92,
    "3": 11.54,
    "2": 3.21,
    "1": 1.28
  },
  "withPhotos": 23,
  "verifiedPurchaseRate": 100.0,
  "lastUpdated": "2026-06-20T12:00:00Z"
}
```

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-20  
> **Next Review:** After Phase 1 completion  
> **Approvals Needed:** Tech Lead, Product Owner, Business Owner
