# BRD — Business Requirements Document
## Module: Chat (Chatbot tư vấn mua sắm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01

---

## 1. Mục tiêu kinh doanh

Chatbot tư vấn điện thoại hoạt động như nhân viên tại quầy: hiểu nhu cầu/ngân sách, tra giá — tồn kho — đánh giá thật từ hệ thống, trả lời chính sách, hỗ trợ tra đơn và mã giảm giá cho thành viên. Mục tiêu là giảm tải cho bộ phận CSKH và giữ khách ở lại website ngoài giờ hành chính.

---

## 2. Bối cảnh & Vấn đề

| Vấn đề | Tác động |
|---|---|
| Khách mới cần tư vấn chọn máy nhưng không biết hỏi gì | Bỏ giữa chừng, mất đơn hàng tiềm năng |
| Câu hỏi lặp lại về chính sách bảo hành/đổi trả/vận chuyển chiếm hết thời gian CSKH | Chi phí vận hành cao |
| Khách muốn biết đơn hàng đang ở đâu mà phải mở app/email | Trải nghiệm chậm |
| LLM tự do sinh lời văn có thể bịa model/giá | Mất uy tín cửa hàng nếu báo sai |

---

## 3. Yêu cầu kinh doanh

### BR-01: Chat dùng được cho cả guest lẫn thành viên
- Không bắt buộc đăng nhập mới được hỏi — rào cản tư vấn phải bằng 0
- Thành viên đăng nhập được thêm quyền tra đơn hàng, kiểm mã giảm giá của chính mình
- Guest đăng nhập giữa chừng: lịch sử chat đi theo tài khoản (claim session), không mất mạch hội thoại

### BR-02: Chỉ tư vấn dựa trên dữ liệu thật của cửa hàng
- Model, giá, tồn kho, đánh giá phải đến từ kết quả tra cứu (tool) — tuyệt đối không bịa số liệu
- Không tìm thấy máy thỏa → nói thật, gợi ý phương án gần nhất
- Chính sách (bảo hành, đổi trả, vận chuyển, thanh toán) trả lời đúng từ khối nội dung do cửa hàng quản lý

### BR-03: Trải nghiệm trả lời tức thời
- Câu trả lời hiển thị dần từng đoạn (streaming), không đợi nguyên câu
- Card sản phẩm (ảnh, giá) hiện kèm ngay khi tra được, không đợi hết câu chữ
- LLM quá tải → tự rơi xuống model dự phòng, chat không chết theo một model duy nhất

### BR-04: Kiểm soát chi phí và chống lạm dụng
- Mỗi tin nhắn tốn tiền gọi LLM theo token — hạn mức tách theo vai: thành viên (10/phút + 50/ngày), guest (5/phút + 20/ngày)
- Sàn ngày chặn cháy quota buổi đêm; feature flag tắt nhanh khi sự cố
- Tool riêng tư (đơn hàng, mã giảm giá) chỉ chạy cho người đã đăng nhập, dữ liệu luôn bám theo tài khoản trên server

### BR-05: An toàn nội dung
- Không tiết lộ hướng dẫn hệ thống, API key hay cấu trúc dữ liệu nội bộ, kể cả khi bị lừa "bỏ qua hướng dẫn trước đó"
- Câu hỏi ngoài chủ đề mua sắm → từ chối lịch sự
- Khiếu nại / trả góp phức tạp → đề xuất kết nối nhân viên thật

---

## 4. Người dùng

| Actor | Vai trò |
|---|---|
| **Guest** | Chat tư vấn, tra sản phẩm/bài viết/đánh giá; hạn mức thấp hơn |
| **Customer** (đăng nhập) | Thêm tra đơn hàng và mã giảm giá của mình; hạn mức cao hơn |
| **Admin / Staff** | Quản lý nội dung chính sách qua mã nguồn; không có giao diện quản lý phiên chat |

---

## 5. Ngoài phạm vi

- Giao diện admin xem/lọc phiên chat của khách
- Người dùng tự xoá hoặc sửa tin nhắn của mình
- Gửi ảnh/tệp trong chat; chuyển tiếp chat cho nhân viên (chỉ có nút mời "Kết nối nhân viên")
- Chatbot gọi tool đổi đơn hàng, huỷ đơn hay áp mã thay người dùng — chỉ tra cứu

---

## 6. Định nghĩa thành công

| KPI | Mục tiêu |
|---|---|
| Số phiên chat/tuần (sau 1 tháng chạy) | Đo và theo dõi nền so sánh |
| Tỷ lệ lượt chat dẫn tới xem trang sản phẩm | ≥ 20% |
| Tỷ lệ câu trả lời bị chạm fallback "chưa xử lý được" | ≤ 5% |
| Sự cố cháy quota LLM trong ngày | 0 |
| Lộ thông tin đơn hàng của người khác | 0 (nghiêm trọng) |
