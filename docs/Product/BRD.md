# BRD — Business Requirement Document
## Module: Product (Sản phẩm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Người soạn:** Tự động sinh từ source code  

---

## 1. Bối cảnh kinh doanh

Mobivexa là nền tảng thương mại điện tử bán thiết bị di động và phụ kiện. Module Product là **core nghiệp vụ** của hệ thống, quản lý toàn bộ thông tin sản phẩm được bán trên platform.

Mỗi sản phẩm có thể có nhiều phiên bản (variant) với các thông số khác nhau (màu sắc, bộ nhớ, RAM, giá, tồn kho). Variant là đơn vị lưu giá và tồn kho — không phải Product.

Hệ thống phục vụ 2 nhóm người dùng chính cho module Product:

| Nhóm | Mô tả |
|---|---|
| **Khách hàng (Public)** | Xem danh sách, tìm kiếm, filter sản phẩm; xem chi tiết |
| **Nhân viên (Staff+)** | Quản lý sản phẩm, upload ảnh, quản lý variant, tồn kho |

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường thành công |
|---|---|---|
| BG-01 | Khách hàng tìm kiếm và lọc sản phẩm nhanh chóng | Thời gian load danh sách < 1 giây (có cache) |
| BG-02 | Hỗ trợ nhiều variant cho mỗi sản phẩm (màu, bộ nhớ, RAM) | 100% sản phẩm có ≥ 1 variant; SKU unique toàn hệ thống |
| BG-03 | Quản lý tồn kho chính xác, tránh overselling | Tồn kho DB = tồn kho thực tế; báo cáo tồn kho real-time |
| BG-04 | Ảnh sản phẩm chất lượng cao, hỗ trợ nhiều ảnh | Tối đa 10 ảnh/sản phẩm; auto-promote ảnh bìa khi xóa |
| BG-05 | Admin quản lý sản phẩm hiệu quả với UI/UX tốt | CRUD nhanh; filter admin đầy đủ; batch upload ảnh |
| BG-06 | Hiệu suất cao với caching thông minh | Redis cache cho public (5 phút TTL); admin luôn đọc DB tươi |

---

## 3. Các bên liên quan (Stakeholders)

| Stakeholder | Vai trò | Kỳ vọng |
|---|---|---|
| **Khách hàng** | Người mua hàng | Tìm kiếm dễ dàng, filter theo nhu cầu (giá, thương hiệu, danh mục), xem ảnh chi tiết |
| **Nhân viên kho** | Quản lý tồn kho | Cập nhật tồn kho nhanh, báo cáo hết hàng/sắp hết hàng chính xác |
| **Marketing** | Tạo nội dung sản phẩm | Upload ảnh dễ dàng, đặt sản phẩm nổi bật, gắn tag |
| **Dev team** | Xây dựng & bảo trì | API rõ ràng, dễ tích hợp với Cart/Order module |
| **Performance team** | Đảm bảo hiệu suất | Cache hiệu quả, không DB overload, Full-text search nhanh |

---

## 4. Yêu cầu kinh doanh

### 4.1 Quản lý sản phẩm (Product Management)

**Mô tả:** Admin có thể tạo, sửa, xóa, bật/tắt sản phẩm. Mỗi sản phẩm thuộc 1 Category và 1 Brand, có thể gán nhiều Tag.

| Yêu cầu | Chi tiết |
|---|---|
| **CRUD sản phẩm** | Tạo, xem, sửa, xóa sản phẩm |
| **Toggle trạng thái** | Bật/tắt `isActive` (hiển thị/ẩn) |
| **Sản phẩm nổi bật** | Toggle `isFeatured` để hiển thị ở trang chủ |
| **Thông tin bắt buộc** | `name` (≥ 2 ký tự), `categoryId`, `brandId`, `variants` (≥ 1) |
| **Thông tin tùy chọn** | `description`, `tagIds`, `images` |
| **Slug tự sinh** | Tự động sinh từ `name` nếu không cung cấp; unique |

**Ràng buộc:**
- Tên sản phẩm phải có ít nhất 2 ký tự
- Phải chọn Category và Brand tồn tại
- Phải có ít nhất 1 Variant khi tạo mới
- Tags được gửi thì phải tồn tại trong DB

---

### 4.2 Quản lý phiên bản (Variant Management)

**Mô tả:** Mỗi sản phẩm có nhiều variant với các thông số khác nhau. Variant là đơn vị lưu giá và tồn kho.

| Yêu cầu | Chi tiết |
|---|---|
| **Thông tin variant** | `sku` (unique), `color`, `storage`, `ram`, `originalPrice`, `salePrice`, `stock`, `isActive` |
| **Giá bán ≤ giá gốc** | `salePrice` phải ≤ `originalPrice` |
| **SKU unique** | Không trùng trong cả payload lẫn DB |
| **Tồn kho non-negative** | `stock` ≥ 0 |
| **CRUD variant** | Thêm, sửa, xóa variant riêng (không qua Product endpoint) |
| **Tối thiểu 1 variant** | Không thể xóa variant cuối cùng của sản phẩm |

**Ràng buộc:**
- SKU không được để trống
- Giá không âm (≥ 0)
- Khi xóa variant: phải còn ít nhất 1 variant khác

---

### 4.3 Quản lý ảnh sản phẩm (Image Management)

**Mô tả:** Hỗ trợ nhiều ảnh mỗi sản phẩm, tự động quản lý ảnh bìa và thứ tự hiển thị.

| Yêu cầu | Chi tiết |
|---|---|
| **Số lượng ảnh** | Tối đa 10 ảnh mỗi lần upload |
| **Định dạng** | JPG, JPEG, PNG, WebP |
| **Kích thước** | Tối đa 5 MB/ảnh |
| **Lưu trữ** | Cloudinary, folder `products` |
| **Ảnh bìa (Cover)** | Chỉ 1 ảnh/sản phẩm; ảnh đầu tiên auto thành bìa |
| **Xóa ảnh bìa** | Tự promote ảnh kế tiếp làm bìa mới |
| **Thứ tự hiển thị** | `sortOrder` tự tăng theo thứ tự upload |

**Ràng buộc:**
- Ảnh đầu tiên khi tạo sản phẩm tự thành `isCover = true`
- Xóa ảnh bìa → ảnh kế tiếp (`sortOrder ASC`) thành bìa mới
- Đặt ảnh bìa → atomic transaction (bỏ cover tất cả → set cover mới)

---

### 4.4 Tìm kiếm & Filter (Search & Filter)

**Mô tả:** Khách hàng có thể tìm kiếm, lọc sản phẩm theo nhiều tiêu chí.

| Yêu cầu | Chi tiết |
|---|---|
| **Full-text search** | Tìm theo tên sản phẩm (PostgreSQL FTS + GIN index) |
| **Filter** | Category (slug), Brand (slug), Tag (slug), khoảng giá (`minPrice`–`maxPrice`) |
| **Sort** | `newest`, `oldest`, `name_asc`, `name_desc` |
| **Phân trang** | `page` (default: 1), `limit` (default: 12, max: 50) |
| **Chỉ sản phẩm active** | Public chỉ thấy `isActive = true` |

**Ràng buộc:**
- Public chỉ xem sản phẩm và variant active
- Admin xem tất cả (có thể filter thêm `isActive`, `isFeatured`)

---

### 4.5 Sản phẩm nổi bật (Featured Products)

**Mô tả:** Hiển thị danh sách sản phẩm nổi bật ở trang chủ.

| Yêu cầu | Chi tiết |
|---|---|
| **Điều kiện** | `isActive = true` AND `isFeatured = true` |
| **Sắp xếp** | `createdAt DESC` (mới nhất lên đầu) |
| **Mặc định** | Lấy 8 sản phẩm (có thể config qua query param) |
| **Cache** | TTL 10 phút ( lâu hơn list thường vì ít thay đổi) |

---

### 4.6 Báo cáo tồn kho (Inventory Report)

**Mô tả:** Admin xem báo cáo tồn kho tổng quan và chi tiết.

| Yêu cầu | Chi tiết |
|---|---|
| **Summary** | Tổng variants, tổng stock, số hết hàng, số sắp hết, số còn hàng |
| **Trạng thái tồn kho** | `out_of_stock` (stock = 0), `low_stock` (0 < stock ≤ threshold), `in_stock` (stock > threshold) |
| **Filter** | `search` (tên sản phẩm), `stockStatus`, `brandSlug`, `lowThreshold` (default: 5) |
| **Sắp xếp** | Hết hàng lên đầu (`stock ASC`) |
| **Phân trang** | `page`, `limit` (max: 100) |

**Ràng buộc:**
- Summary dùng in-memory cache (60s TTL)
- Danh sách variants không cache (real-time)

---

### 4.7 Hiệu suất & Caching (Performance)

**Mô tả:** Tối ưu hiệu suất với Redis cache cho public API.

| Cache key | TTL | Bust khi |
|---|---|---|
| `products:list:*` | 5 phút | Tạo/sửa/xóa sản phẩm, sửa variant (giá/stock/isActive) |
| `products:slug:{slug}` | 5 phút | Cập nhật hoặc xóa sản phẩm có slug đó |
| `products:featured:*` | 10 phút | Tạo/sửa/xóa sản phẩm |

**Ràng buộc:**
- Cache chỉ áp dụng cho public — admin luôn đọc DB
- Cache failure không ảnh hưởng response (silent catch)
- Cache bust dùng Redis SCAN (an toàn với production)

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Yêu cầu | Giá trị |
|---|---|
| Thời gian response danh sách (public) | < 1 giây (có cache) |
| Thời gian response danh sách (admin) | < 2 giây (không cache) |
| Thời gian response chi tiết sản phẩm | < 500ms (có cache) |
| Upload ảnh (tối đa 10 ảnh) | < 10 giây |

---

### 5.2 Scalability

| Yêu cầu | Chi tiết |
|---|---|
| Sản phẩm tối đa | 10,000+ sản phẩm |
| Variant tối đa | 5 variant/sản phẩm → 50,000+ variants |
| Ảnh tối đa | 10 ảnh/sản phẩm → 100,000+ ảnh |
| Full-text search | PostgreSQL GIN index hỗ trợ FTS |

---

### 5.3 Security

| Yêu cầu | Chi tiết |
|---|---|
| Admin API | Yêu cầu authenticate + authorize (STAFF+) |
| Public API | Không cần xác thực |
| Upload ảnh | Validate định dạng, kích thước; Cloudinary upload |
| SQL Injection | Prisma ORM ngăn ngừa |
| XSS prevention | Prisma escape input; không render raw HTML |

---

### 5.4 Availability

| Yêu cầu | Giá trị |
|---|---|
| Uptime target | 99.5% |
| Cache failure fallback | Degrade gracefully — fallback to DB |

---

## 6. Dependencies

| Module | Dependency | Chi tiết |
|---|---|---|
| **Product ↔ Category** | FK | `categoryId` → Category.id |
| **Product ↔ Brand** | FK | `brandId` → Brand.id |
| **Product ↔ Tag** | N:N qua ProductTag | Gán/bỏ tag cho sản phẩm |
| **Product → Cart** | 1:1 | User có 1 Cart (tương lai) |
| **Product → Order** | 1:N | Product có nhiều OrderItem |
| **Product → Review** | 1:N | Product có nhiều Review |
| **Variant → CartItem** | 1:N | Variant có nhiều CartItem |
| **Variant → OrderItem** | 1:N | Variant có nhiều OrderItem |

---

## 7. Risks & Assumptions

### 7.1 Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | SKU conflict khi nhiều admin tạo cùng lúc | Cao | DB unique constraint; validate ở cả payload và DB |
| R-02 | Cache stale khi tồn kho thay đổi liên tục | Trung bình | Cache bust khi stock thay đổi; admin luôn đọc DB |
| R-03 | Cloudinary downtime → không upload ảnh | Trung bình | Fallback: trả lỗi rõ ràng; retry mechanism |
| R-04 | Sản phẩm trong đơn hàng bị xóa | Cao | Xử lý ở tầng Order: giữ snapshot product info |
| R-05 | Full-text search slow với data lớn | Trung bình | GIN index; monitor query time |

---

### 7.2 Assumptions

| ID | Assumption |
|---|---|
| A-01 | Cloudinary luôn available cho upload ảnh |
| A-02 | Redis available cho cache (fallback gracefully nếu không) |
| A-03 | Category và Brand được tạo trước Product |
| A-04 | SKU được admin nhập thủ công (không auto-gen) |
| A-05 | 10 ảnh/sản phẩm là đủ cho nhu cầu hiện tại |

---

## 8. Success Metrics

| Metric | Target | How to measure |
|---|---|---|
| **Product creation time** | < 2 phút/sản phẩm (admin) | Track time từ start form đến submit |
| **Image upload success rate** | > 98% | Monitor Cloudinary upload errors |
| **Search latency (p95)** | < 500ms | APM monitoring |
| **Cache hit rate** | > 70% | Redis monitor |
| **Zero stock products** | < 5% tổng variants | DB query hàng ngày |

---

## 9. Timeline & Phases

### Phase 1: MVP (Week 1-2)
- ✅ CRUD Product cơ bản
- ✅ CRUD Variant
- ✅ Upload tối đa 5 ảnh
- ✅ Danh sách sản phẩm public (filter cơ bản)

### Phase 2: Enhanced (Week 3-4)
- ✅ Full-text search
- ✅ Featured products
- ✅ Báo cáo tồn kho
- ✅ Redis cache
- ✅ Tăng lên 10 ảnh/sản phẩm

### Phase 3: Advanced (Future)
- ⏳ Bulk import products (CSV/Excel)
- ⏳ Product variants grouping (color family)
- ⏳ Auto-suggest SKU
- ⏳ Product analytics (views, conversion)

---

## 10. Appendix

### 10.1 Terminology

| Term | Definition |
|---|---|
| **Product** | Thông tin chung về sản phẩm (tên, mô tả, category, brand) |
| **Variant** | Phiên bản cụ thể của sản phẩm (màu, bộ nhớ, RAM, giá, tồn kho) |
| **SKU** | Stock Keeping Unit — mã unique cho mỗi variant |
| **Cover image** | Ảnh đại diện cho sản phẩm (hiện đầu tiên trong listing) |
| **Full-text search** | Tìm kiếm thông minh hỗ trợ tiếng Việt (PostgreSQL FTS) |

---

### 10.2 Related Documents

| Document | Link |
|---|---|
| SRS - Software Requirements | [SRS.md](./SRS.md) |
| Use Case Document | [UseCase.md](./UseCase.md) |
| API Specification | [APISpec.md](./APISpec.md) |
| Activity Diagram | [ActivityDiagram.md](./ActivityDiagram.md) |
| Sequence Diagram | [SequenceDiagram.md](./SequenceDiagram.md) |
| ERD | [ERD.md](./ERD.md) |
| Test Cases | [TestCase.md](./TestCase.md) |

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Next Review:** After MVP completion
