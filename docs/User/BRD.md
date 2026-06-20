# BRD — Business Requirement Document
## Module: User (Người dùng & Hồ sơ cá nhân)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [Auth/BRD.md](../Auth/BRD.md)

---

## 1. Bối cảnh kinh doanh

Sau khi xác thực danh tính qua module Auth, người dùng cần quản lý thông tin cá nhân của mình. Module User phục vụ 2 nhu cầu cốt lõi:

1. **Quản lý hồ sơ** — tên, số điện thoại, ảnh đại diện
2. **Quản lý địa chỉ giao hàng** — thêm/sửa/xóa nhiều địa chỉ, chọn địa chỉ mặc định để tự động điền khi đặt hàng

Module này không có chức năng dành cho admin (admin dùng `/api/admin/users` — xem [Admin/BRD.md](../Admin/BRD.md)). Toàn bộ endpoint thuộc phạm vi **người dùng tự quản lý tài khoản của chính mình**.

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường |
|---|---|---|
| BG-01 | Người dùng tự cập nhật thông tin cá nhân mà không cần hỗ trợ | Giảm ticket support về thông tin tài khoản |
| BG-02 | Trải nghiệm thanh toán nhanh nhờ địa chỉ được lưu sẵn | Tỷ lệ hoàn tất đơn hàng tăng; thời gian checkout giảm |
| BG-03 | Bảo mật tài khoản — đổi mật khẩu bất kỳ lúc nào | Người dùng chủ động bảo vệ tài khoản |
| BG-04 | Ảnh đại diện cá nhân hóa trải nghiệm mua sắm | Tăng cảm giác gắn kết với nền tảng |

---

## 3. Các bên liên quan

| Stakeholder | Kỳ vọng |
|---|---|
| **Khách hàng** | Cập nhật thông tin dễ, lưu nhiều địa chỉ, ảnh đại diện đẹp |
| **Vận hành** | Thông tin địa chỉ chính xác để giao hàng đúng nơi |
| **Dev team** | API rõ ràng, ownership check chặt chẽ |

---

## 4. Yêu cầu kinh doanh

### BR-01: Xem hồ sơ cá nhân

> Người dùng phải xem được thông tin tài khoản của mình (tên, email, phone, role, avatar).

### BR-02: Cập nhật hồ sơ

> Người dùng được phép cập nhật `fullName` và/hoặc `phone`. Email không được đổi (dùng để đăng nhập).

- Số điện thoại phải theo định dạng Việt Nam (`0xxxxxxxxx` hoặc `+84xxxxxxxxx`)
- Số điện thoại phải là duy nhất toàn hệ thống (không trùng với user khác)
- Có thể xóa số điện thoại (gửi `phone: ""`)

### BR-03: Đổi mật khẩu

> Người dùng đang đăng nhập được đổi mật khẩu bằng cách xác nhận mật khẩu hiện tại.

- Phải nhập đúng mật khẩu hiện tại
- Mật khẩu mới tối thiểu 8 ký tự
- Mật khẩu mới phải khác mật khẩu hiện tại

### BR-04: Upload ảnh đại diện

> Người dùng được phép tải lên ảnh đại diện cá nhân.

- Định dạng: JPG, JPEG, PNG, WebP — tối đa 5MB
- Ảnh được crop 400×400 pixel, gravity = face (tự nhận diện khuôn mặt)
- Giới hạn 10 lần upload / giờ

### BR-05: Quản lý địa chỉ giao hàng

> Người dùng có thể lưu nhiều địa chỉ giao hàng và chỉ định 1 địa chỉ mặc định.

- Mỗi user có thể có nhiều địa chỉ (không giới hạn số lượng)
- Chỉ có **đúng 1 địa chỉ mặc định** tại bất kỳ thời điểm nào
- Địa chỉ đầu tiên tự động trở thành mặc định
- Khi xóa địa chỉ mặc định, hệ thống tự chọn địa chỉ gần nhất làm mặc định mới
- Mỗi địa chỉ cần: tên người nhận, SĐT, tỉnh/thành, quận/huyện, phường/xã, chi tiết đường

---

## 5. Quy tắc kinh doanh

| ID | Quy tắc |
|---|---|
| BRU-01 | Toàn bộ endpoint yêu cầu đăng nhập — không có thao tác nào là public |
| BRU-02 | User chỉ được xem/sửa địa chỉ **của chính mình** — không truy cập địa chỉ người khác |
| BRU-03 | Phone unique toàn hệ thống — gửi phone trùng trả `409` |
| BRU-04 | Mật khẩu mới phải khác mật khẩu hiện tại — kiểm tra ở validator |
| BRU-05 | Avatar dùng `public_id = user_{userId}` + `overwrite = true` — không sinh file thừa trên Cloudinary |
| BRU-06 | Địa chỉ mặc định: xóa → tự động kế thừa; thêm mới với `isDefault=true` → revoke địa chỉ mặc định cũ |
| BRU-07 | Địa chỉ đầu tiên của user luôn là mặc định (dù không gửi `isDefault: true`) |

---

## 6. Giả định & Ràng buộc

- Cloudinary được cấu hình sẵn; nếu upload lỗi → request thất bại (không có fallback)
- Email không thể thay đổi sau khi đăng ký (MVP)
- Không có xác minh số điện thoại qua OTP (MVP)
- Không có chức năng xóa tài khoản tự phục vụ (user phải liên hệ admin)

---

## 7. Tiêu chí chấp nhận

| ID | Tiêu chí |
|---|---|
| AC-01 | `GET /me` trả về đầy đủ thông tin user, không có `passwordHash` |
| AC-02 | Cập nhật profile chỉ thay đổi trường được gửi, không reset trường khác |
| AC-03 | Đổi mật khẩu thành công không làm mất phiên đăng nhập hiện tại |
| AC-04 | Upload avatar cùng userId luôn ghi đè ảnh cũ, không tạo file mới |
| AC-05 | Luôn có tối đa 1 địa chỉ `isDefault = true` per user |
| AC-06 | Xóa địa chỉ mặc định → địa chỉ còn lại gần nhất tự trở thành mặc định |
| AC-07 | Truy cập địa chỉ không thuộc mình trả về `404` |
