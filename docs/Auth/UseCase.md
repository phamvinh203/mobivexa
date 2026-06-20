# Use Case Document
## Module: Authentication
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Tham chiếu:** [BRD.md](./BRD.md) | [SRS.md](./SRS.md)

---

## 1. Actors

| Actor | Mô tả | Role |
|---|---|---|
| **Guest** | Người dùng chưa đăng nhập | — |
| **Customer** | Khách hàng đã đăng nhập | `CUSTOMER` |
| **Staff** | Nhân viên đã đăng nhập | `STAFF` |
| **Admin** | Quản trị viên đã đăng nhập | `ADMIN` |
| **Email Server** | Hệ thống gửi email (SMTP) | Hệ thống ngoài |
| **Auth System** | Module xác thực (backend) | Hệ thống nội bộ |

---

## 2. Danh sách Use Case

| ID | Tên Use Case | Actor chính | Độ ưu tiên |
|---|---|---|---|
| UC-01 | Đăng ký tài khoản | Guest | Cao |
| UC-02 | Đăng nhập | Guest | Cao |
| UC-03 | Làm mới phiên đăng nhập | Customer / Staff / Admin | Cao |
| UC-04 | Quên mật khẩu — yêu cầu OTP | Guest | Trung bình |
| UC-05 | Đặt lại mật khẩu bằng OTP | Guest | Trung bình |
| UC-06 | Đăng xuất | Customer / Staff / Admin | Trung bình |
| UC-07 | Truy cập tài nguyên bảo vệ | Customer / Staff / Admin | Cao |

---

## 3. Chi tiết Use Case

---

### UC-01: Đăng ký tài khoản

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Guest |
| **Mục tiêu** | Tạo tài khoản mới để mua hàng |
| **Tiền điều kiện** | Guest chưa có tài khoản với email này |
| **Hậu điều kiện** | Tài khoản được tạo, role = CUSTOMER, isActive = true |
| **Trigger** | Guest nhấn "Đăng ký" và điền form |

**Luồng chính (Happy Path):**

1. Guest nhập `email`, `fullName`, `password` (và tùy chọn `phone`)
2. Hệ thống kiểm tra định dạng email hợp lệ
3. Hệ thống kiểm tra `fullName` ≥ 2 ký tự
4. Hệ thống kiểm tra `password` ≥ 8 ký tự
5. Hệ thống kiểm tra email chưa tồn tại trong DB
6. Hệ thống hash password với bcrypt (cost=12)
7. Hệ thống tạo bản ghi User
8. Hệ thống trả về `201` + thông tin user (không có password)

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Email sai định dạng | Trả `400` — `Email không hợp lệ` |
| 3 | fullName < 2 ký tự | Trả `400` — `Họ tên phải có ít nhất 2 ký tự` |
| 4 | password < 8 ký tự | Trả `400` — `Mật khẩu phải có ít nhất 8 ký tự` |
| 5 | Email đã tồn tại | Trả `409` — `Email đã được sử dụng` |
| Bất kỳ | Vượt rate limit (10 req/15 phút) | Trả `429` |

---

### UC-02: Đăng nhập

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Guest |
| **Mục tiêu** | Xác thực danh tính và nhận token truy cập |
| **Tiền điều kiện** | Đã có tài khoản, tài khoản đang active |
| **Hậu điều kiện** | Client nhận được `accessToken` (15 phút) + `refreshToken` (7 ngày) |
| **Trigger** | Guest nhập email + mật khẩu và nhấn "Đăng nhập" |

**Luồng chính (Happy Path):**

1. Guest nhập `email` và `password`
2. Hệ thống validate định dạng
3. Hệ thống tìm user theo email
4. Hệ thống kiểm tra `isActive = true`
5. Hệ thống so khớp password với bcrypt hash
6. Hệ thống sinh Access Token (payload: userId, email, role; TTL: 15 phút)
7. Hệ thống sinh Refresh Token (payload: userId, email, role; TTL: 7 ngày)
8. Hệ thống lưu Refresh Token vào DB với `expiresAt = now + 7 ngày`
9. Hệ thống trả về `200` + `{ accessToken, refreshToken, user }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | Email sai định dạng | Trả `400` |
| 3 | Email không tồn tại | Trả `401` — `Email hoặc mật khẩu không đúng` (**không phân biệt**) |
| 4 | isActive = false | Trả `403` — `Tài khoản đã bị khóa` |
| 5 | Password sai | Trả `401` — `Email hoặc mật khẩu không đúng` |

---

### UC-03: Làm mới phiên đăng nhập

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer / Staff / Admin (đã đăng nhập trước đó) |
| **Mục tiêu** | Lấy Access Token mới khi token cũ hết hạn, không cần đăng nhập lại |
| **Tiền điều kiện** | Client đang giữ Refresh Token hợp lệ, chưa bị revoke |
| **Hậu điều kiện** | Client có Access Token mới + Refresh Token mới; token cũ bị thu hồi |
| **Trigger** | API call trả về 401 (Access Token hết hạn) — client tự động gọi refresh |

**Luồng chính (Happy Path):**

1. Client gửi `refreshToken` hiện tại
2. Hệ thống verify chữ ký JWT
3. Hệ thống tra DB: tìm token, kiểm tra `isRevoked = false` và `expiresAt > now`
4. Hệ thống bắt đầu transaction nguyên tử:
   - Revoke token cũ (`isRevoked = true`)
   - Tạo Access Token mới
   - Tạo Refresh Token mới
   - Lưu Refresh Token mới vào DB
5. Hệ thống trả về `200` + `{ accessToken, refreshToken }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 1 | Thiếu refreshToken | Trả `400` — `Thiếu refresh token` |
| 2 | Sai chữ ký hoặc hết hạn JWT | Trả `401` — `Refresh token không hợp lệ hoặc đã hết hạn` |
| 3 | Token đã bị revoke | Trả `401` — `Refresh token không hợp lệ` |
| 3 | Token không tìm thấy DB | Trả `401` — `Refresh token không hợp lệ` |

---

### UC-04: Quên mật khẩu — yêu cầu OTP

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Guest (đã quên mật khẩu) |
| **Mục tiêu** | Nhận OTP qua email để khôi phục mật khẩu |
| **Tiền điều kiện** | Guest có email đã đăng ký và có thể truy cập hộp thư |
| **Hậu điều kiện** | OTP được gửi đến email (nếu email tồn tại); DB cập nhật hash OTP |
| **Trigger** | Guest nhấn "Quên mật khẩu" và nhập email |

**Luồng chính (Happy Path):**

1. Guest nhập `email`
2. Hệ thống validate định dạng email
3. Hệ thống tìm user theo email
4. *(Nếu không tìm thấy → kết thúc im lặng, trả `200` — không leak)*
5. Hệ thống sinh OTP 6 chữ số ngẫu nhiên (`Math.floor(100000 + Math.random() * 900000)`)
6. Hệ thống hash OTP bằng SHA-256
7. Hệ thống lưu `resetPasswordToken = hash`, `resetPasswordExpires = now + 15 phút`
8. Hệ thống gửi email chứa OTP gốc
9. Hệ thống trả về `200` (luôn — bất kể email có tồn tại hay không)

**Ghi chú bảo mật:** Bước 4 là cố ý — ngăn attacker dùng endpoint này để liệt kê email hệ thống.

---

### UC-05: Đặt lại mật khẩu bằng OTP

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Guest (đã nhận OTP từ UC-04) |
| **Mục tiêu** | Đặt mật khẩu mới bằng OTP |
| **Tiền điều kiện** | Đã thực hiện UC-04 và nhận được OTP, OTP còn trong thời hạn 15 phút |
| **Hậu điều kiện** | Mật khẩu mới được lưu; toàn bộ session cũ bị thu hồi |
| **Trigger** | Guest nhập OTP và mật khẩu mới vào form |

**Luồng chính (Happy Path):**

1. Guest nhập `otp` (6 chữ số) và `newPassword`
2. Hệ thống validate: OTP đúng 6 chữ số, password ≥ 8 ký tự
3. Hệ thống hash OTP bằng SHA-256
4. Hệ thống tìm user có `resetPasswordToken = hash` và `resetPasswordExpires > now`
5. Hệ thống bắt đầu transaction nguyên tử:
   - Hash mật khẩu mới bằng bcrypt
   - Cập nhật `passwordHash`
   - Xóa `resetPasswordToken` và `resetPasswordExpires`
   - Revoke toàn bộ Refresh Token của user
6. Hệ thống trả về `200` + `{ message: 'Đặt lại mật khẩu thành công' }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | OTP không phải 6 chữ số | Trả `400` — `OTP phải là 6 chữ số` |
| 2 | password < 8 ký tự | Trả `400` — `Mật khẩu mới phải có ít nhất 8 ký tự` |
| 4 | OTP sai hoặc hết hạn | Trả `400` — `Token không hợp lệ hoặc đã hết hạn` |

---

### UC-06: Đăng xuất

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer / Staff / Admin |
| **Mục tiêu** | Kết thúc phiên đăng nhập hiện tại |
| **Tiền điều kiện** | Client đang giữ Refresh Token |
| **Hậu điều kiện** | Refresh Token bị revoke; Access Token hết hạn tự nhiên |
| **Trigger** | Người dùng nhấn "Đăng xuất" |

**Luồng chính (Happy Path):**

1. Client gửi `refreshToken`
2. Hệ thống validate có refreshToken
3. Hệ thống cập nhật `isRevoked = true` cho token trong DB
4. Hệ thống trả về `200` + `{ message: 'Đăng xuất thành công' }`

**Ghi chú:** Access Token không bị vô hiệu hóa ngay lập tức — sẽ tự hết hạn sau tối đa 15 phút.

---

### UC-07: Truy cập tài nguyên bảo vệ

| Thuộc tính | Nội dung |
|---|---|
| **Actor** | Customer / Staff / Admin |
| **Mục tiêu** | Gọi API cần xác thực |
| **Tiền điều kiện** | Client đang giữ Access Token hợp lệ |
| **Hậu điều kiện** | Request được xử lý bởi controller tương ứng |
| **Trigger** | Client gửi bất kỳ request nào đến protected route |

**Luồng chính (Happy Path):**

1. Client gửi request với header `Authorization: Bearer <accessToken>`
2. Middleware `authenticate` đọc và verify JWT
3. Middleware gán `req.user = { userId, email, role }`
4. (Nếu route yêu cầu role cụ thể) Middleware `authorize` kiểm tra role
5. Request đến Controller

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 1 | Không có header Authorization | `401` — `Không có token xác thực` |
| 2 | Token sai/hết hạn | `401` — `Token không hợp lệ hoặc đã hết hạn` |
| 4 | Role không đủ quyền | `403` — `Bạn không có quyền thực hiện thao tác này` |

---

## 4. Mối quan hệ giữa Use Cases

```
UC-01 (Register) ──────────────────────► Tạo tài khoản
                                              │
                                              ▼
UC-02 (Login) ─────────────────────────► Cấp token ─────► UC-07 (Truy cập)
     │                                        │
     │                              Access Token hết hạn
     │                                        │
     │                                        ▼
     │                              UC-03 (Refresh) ───► UC-07 (Truy cập)
     │
     ├──────────────────────────────► UC-06 (Logout) ──► Revoke token
     │
     └── Quên mật khẩu ──────────── UC-04 (Forgot) ──► UC-05 (Reset) ──► UC-02 (Login lại)
```
