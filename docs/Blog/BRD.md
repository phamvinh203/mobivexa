# BRD — Business Requirements Document
## Module: Blog (Nội dung & SEO)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01

---

## 1. Mục tiêu kinh doanh

Xây kênh nội dung (tin công nghệ, review, so sánh, thủ thuật, tư vấn mua hàng) để kéo traffic organic từ Google về sàn, dẫn khách tới trang sản phẩm và tăng tỷ lệ chuyển đổi. Blog là nền tảng SEO của hệ thống: sitemap, RSS, canonical, meta đầy đủ ngay từ API.

---

## 2. Bối cảnh & Vấn đề

| Vấn đề | Tác động |
|---|---|
| Sàn bán hàng thiếu nội dung tư vấn | Không có thứ hạng tìm kiếm cho các truy vấn "nên mua máy gì" |
| Nội dung chèn được HTML tùy ý là cửa vào script/XSS | Nguy cơ an toàn nghiêm trọng nếu tin vào dữ liệu biên tập viên |
| Hẹn giờ đăng bài phải nhờ người bấm đúng giờ | Đăng chậm, lệch khung giờ vàng |
| Bài chưa đăng bị dò được URL | Rò rỉ thông tin khuyến mãi trước giờ G |
| Domain sản phẩm và nội dung dùng chung danh mục/tag | Quản lý trộn lẫn, xoá tag sản phẩm làm gãy bài |

---

## 3. Yêu cầu kinh doanh

### BR-01: Nội dung quản trị được trọn gói
- Biên tập viên tạo/sửa bài với tiêu đề, tóm tắt, nội dung HTML, ảnh đại diện, danh mục (tối đa 2 cấp), tag, FAQ, sản phẩm liên quan, bài liên quan
- 14 loại nội dung cố định (tin, review, so sánh, hướng dẫn, thủ thuật, tư vấn, khuyến mãi...) để phân loại và lọc
- Tên hiển thị tác giả độc lập với tài khoản (viết bài chung tên "Đội ngũ Mobivexa" được)

### BR-02: Vòng đời xuất bản có kiểm soát
- Trạng thái: Nháp → Hẹn lịch → Đã xuất bản → Lưu trữ, chuyển đổi theo bảng luật duy nhất, chuyển trái phép bị từ chối
- Hẹn giờ đăng tự chạy (lazy publish) — không cần người bấm đúng giờ
- Bài đăng/khớp lịch bắt buộc đủ: tiêu đề, slug, nội dung, danh mục, loại nội dung, ảnh đại diện — thiếu thì hệ thống chỉ đích danh trường thiếu
- Xuất bản lại sau khi gỡ không đổi ngày công bố đầu tiên

### BR-03: Nháp phải kín trước khi ra mắt
- Bài chưa xuất bản không xem được bằng đường public dù đoán được slug
- Xem trước chỉ qua liên kết preview token do hệ thống cấp, hạn 1 giờ, không dùng được như token đăng nhập
- Bài xoá là xoá mềm (khôi phục được) nhưng slug vẫn không tái sử dụng

### BR-04: An toàn nội dung
- HTML nội dung luôn được làm sạch ở server theo whitelist thẻ; script, style, event handler, thuộc tính lạ bị loại tuyệt đối
- Ảnh trong bài chỉ chấp nhận nguồn Cloudinary của chính hệ thống — chặn nhúng ảnh ngoài
- Mọi ảnh upload đi qua kiểm định dạng (JPG/PNG/WebP) và giới hạn kích thước

### BR-05: SEO chuẩn mặc định
- Sitemap XML và RSS 2.0 sinh tự động, chỉ chứa nội dung công khai, có cache CDN
- Mỗi bài có title/description/canonical/ogImage tính sẵn — biên tập viên ghi đè được từng trường
- Bài cross-post từ nguồn khác (canonical trỏ origin khác) không tự quảng bá trong sitemap của mình
- Lượt xem đếm nguyên tử, không làm nghịch lastmod sitemap

### BR-06: Dữ liệu liên kết bền vững
- Danh mục, tag blog tách hẳn khỏi hệ thống sản phẩm — xoá một bên không làm gãy bên kia
- Danh mục còn bài sống hoặc còn con thì không được xoá
- Xoá tag tự gỡ khỏi mọi bài; xoá sản phẩm không làm hỏng bài đang nhắc tới nó

---

## 4. Người dùng

| Actor | Vai trò |
|---|---|
| **Guest / Customer** | Đọc danh sách, tìm kiếm, đọc bài, đếm lượt xem; không thấy bài nháp |
| **Admin / Staff** | Toàn bộ quản trị nội dung: bài, danh mục, tag, ảnh, preview |
| **Bot SEO / RSS reader** | Đọc sitemap.xml và rss.xml |

---

## 5. Ngoài phạm vi

- Bình luận trên bài viết
- Nhiều tác giả trong một bài; phân quyền biên tập theo nhóm nội dung (mọi ADMIN/STAFF cùng quyền)
- Đa ngôn ngữ; A/B test tiêu đề
- Lên lịch đăng lại (recurring schedule) — chỉ hẹn một thời điểm đăng một lần

---

## 6. Định nghĩa thành công

| KPI | Mục tiêu |
|---|---|
| Số bài công khai (3 tháng đầu) | ≥ 30 bài, đủ các loại nội dung chính |
| Traffic organic tới trang tin tức | Tăng ổn định theo tháng (đo qua Search Console) |
| Lỗi sitemap/RSS (503) sau khi cấu hình domain | 0 |
| Sự cố XSS qua nội dung bài viết | 0 (nghiêm trọng) |
| Bài nháp lộ qua đường public | 0 |
