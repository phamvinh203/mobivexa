# BRD — Business Requirement Document
## Module: Authentication (Xác thực & Phân quyền)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Người soạn:** Tự động sinh từ source code  

---

## 1. Bối cảnh kinh doanh

Mobivexa là nền tảng thương mại điện tử bán thiết bị di động và phụ kiện. Hệ thống phục vụ 3 nhóm người dùng:

| Nhóm | Mô tả |
|---|---|
| **Khách hàng (Customer)** | Người mua hàng trực tuyến — đăng ký, đặt hàng, thanh toán |
| **Nhân viên (Staff)** | Quản lý sản phẩm, đơn hàng, nội dung |
| **Quản trị viên (Admin)** | Toàn quyền hệ thống, quản lý nhân viên |

Module Authentication là cổng vào duy nhất của toàn bộ hệ thống. Mọi nghiệp vụ khác đều phụ thuộc vào module này để xác định **"ai đang thao tác"** và **"được phép làm gì"**.

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường thành công |
|---|---|---|
| BG-01 | Bảo vệ dữ liệu người dùng và đơn hàng khỏi truy cập trái phép | 0 incident data breach trong 12 tháng đầu |
| BG-02 | Trải nghiệm đăng nhập nhanh, ít ma sát | Thời gian đăng nhập < 2 giây; tỷ lệ đăng nhập thành công > 95% |
| BG-03 | Hỗ trợ khách quên mật khẩu tự phục hồi không cần hỗ trợ | Tỷ lệ reset thành công > 85%; giảm ticket support về password |
| BG-04 | Phân quyền rõ ràng giữa Customer / Staff / Admin | 0 lần Staff truy cập dữ liệu Admin và ngược lại |
| BG-05 | Duy trì phiên đăng nhập dài mà không hy sinh bảo mật | Session kéo dài 7 ngày với Refresh Token Rotation |

---

## 3. Các bên liên quan (Stakeholders)

| Stakeholder | Vai trò | Kỳ vọng |
|---|---|---|
| **Khách hàng** | Người dùng cuối | Đăng nhập dễ dàng, quên mật khẩu tự phục hồi, không bị mất session |
| **Nhân viên vận hành** | Dùng admin panel | Đăng nhập an toàn, session đủ dài để làm việc |
| **Quản trị viên** | Toàn quyền | Kiểm soát được account, thấy được ai đang đăng nhập |
| **Dev team** | Xây dựng & bảo trì | API rõ ràng, dễ tích hợp với các module khác |
| **Security team** | Đảm bảo an ninh | Không lộ thông tin nhạy cảm, có rate limiting |

---

## 4. Yêu cầu kinh doanh

### 4.1 Đăng ký tài khoản (BR-01)

> **Phát biểu:** Khách hàng mới phải có khả năng tự tạo tài khoản bằng email và mật khẩu.

- Email là định danh duy nhất — không được trùng
- Mật khẩu tối thiểu 8 ký tự
- Họ tên tối thiểu 2 ký tự
- Tài khoản mới mặc định role `CUSTOMER`, trạng thái `isActive = true`
- Không yêu cầu xác minh email (MVP phase)

### 4.2 Đăng nhập (BR-02)

> **Phát biểu:** Người dùng đã có tài khoản phải đăng nhập được bằng email + mật khẩu.

- Xác thực đúng → cấp Access Token (15 phút) + Refresh Token (7 ngày)
- Tài khoản bị khóa → từ chối rõ ràng
- Sai email/mật khẩu → thông báo chung, không tiết lộ email có tồn tại hay không
- Giới hạn 10 lần thử trong 15 phút (rate limiting)

### 4.3 Duy trì phiên đăng nhập (BR-03)

> **Phát biểu:** Người dùng không nên bị đăng xuất bắt buộc sau 15 phút.

- Refresh Token cho phép lấy Access Token mới mà không cần đăng nhập lại
- Refresh Token Rotation: mỗi lần refresh → token cũ bị thu hồi, cấp token mới
- Refresh Token hết hạn hoặc bị thu hồi → yêu cầu đăng nhập lại

### 4.4 Quên mật khẩu (BR-04)

> **Phát biểu:** Khách hàng quên mật khẩu phải tự phục hồi được qua email mà không cần liên hệ support.

- Nhập email → nhận OTP 6 chữ số qua email
- OTP có hiệu lực 15 phút
- OTP chỉ dùng một lần
- Không tiết lộ email có tồn tại trong hệ thống hay không

### 4.5 Đặt lại mật khẩu (BR-05)

> **Phát biểu:** Sau khi có OTP, người dùng đặt mật khẩu mới và toàn bộ phiên cũ bị thu hồi.

- Mật khẩu mới tối thiểu 8 ký tự
- Thành công → tất cả Refresh Token cũ bị revoke (bảo vệ nếu account bị chiếm)
- OTP được hash SHA-256 trước khi lưu DB

### 4.6 Đăng xuất (BR-06)

> **Phát biểu:** Người dùng phải có khả năng đăng xuất để vô hiệu hóa phiên hiện tại.

- Thu hồi Refresh Token hiện tại
- Access Token không bị thu hồi (hết hạn tự nhiên sau 15 phút)
- Không yêu cầu xác thực để logout (dùng refreshToken làm định danh)

---

## 5. Quy tắc kinh doanh (Business Rules)

| ID | Quy tắc |
|---|---|
| BRU-01 | Email là duy nhất toàn hệ thống — đăng ký trùng trả lỗi `409` |
| BRU-02 | Mật khẩu lưu dưới dạng bcrypt hash (cost=12) — không bao giờ lưu plain text |
| BRU-03 | Access Token TTL = 15 phút; Refresh Token TTL = 7 ngày |
| BRU-04 | Rate limit: 10 request / 15 phút cho các endpoint nhạy cảm (register, login, forgot, reset, refresh) |
| BRU-05 | OTP hash SHA-256 trước khi lưu DB; chỉ gửi bản gốc qua email |
| BRU-06 | Tài khoản `isActive = false` không được đăng nhập |
| BRU-07 | Refresh Token Rotation bắt buộc — không tái sử dụng token cũ |
| BRU-08 | JWT Secret tối thiểu 32 ký tự — server từ chối khởi động nếu không đủ |
| BRU-09 | Đổi mật khẩu thành công → revoke toàn bộ Refresh Token hiện có |

---

## 6. Giả định & Ràng buộc

### Giả định
- Người dùng có email hợp lệ có thể nhận được
- SMTP server hoạt động ổn định để gửi OTP
- Client (frontend/mobile) lưu trữ Refresh Token an toàn (localStorage hoặc HttpOnly cookie do client tự chọn)

### Ràng buộc
- MVP không có đăng nhập mạng xã hội (Google/Facebook OAuth)
- MVP không có xác minh email khi đăng ký
- MVP không có 2FA (Two-Factor Authentication)
- Không có cơ chế blacklist Access Token — phụ thuộc vào TTL ngắn (15 phút)

---

## 7. Tiêu chí chấp nhận (Acceptance Criteria)

| ID | Tiêu chí |
|---|---|
| AC-01 | Đăng ký thành công trả về `201` với thông tin user (không có password) |
| AC-02 | Đăng nhập thành công trả về `accessToken` + `refreshToken` + thông tin user |
| AC-03 | Sai mật khẩu trả về `401` với thông báo chung, không phân biệt sai email hay sai password |
| AC-04 | Tài khoản bị khóa trả về `403` khi đăng nhập |
| AC-05 | Refresh Token cũ bị thu hồi ngay sau khi refresh thành công |
| AC-06 | OTP hết hạn hoặc sai trả về `400` |
| AC-07 | Sau reset password, tất cả session cũ không còn dùng được |
| AC-08 | Rate limit vượt quá trả về `429` |
| AC-09 | Forgot password với email không tồn tại vẫn trả về `200` (không leak thông tin) |
