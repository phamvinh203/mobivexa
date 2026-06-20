# Activity Diagram — Luồng xử lý
## Module: Authentication
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Ghi chú:** Sử dụng cú pháp Mermaid — render trên GitHub, GitLab, Obsidian, VSCode (Markdown Preview Mermaid)

---

## AD-01: Đăng ký tài khoản

```mermaid
flowchart TD
    A([Start: Guest gửi POST /register]) --> B[Validate email format]
    B -->|Sai| E1[/Return 400: Email không hợp lệ/]
    B -->|Đúng| C[Validate fullName ≥ 2 ký tự]
    C -->|Sai| E2[/Return 400: Họ tên phải có ít nhất 2 ký tự/]
    C -->|Đúng| D[Validate password ≥ 8 ký tự]
    D -->|Sai| E3[/Return 400: Mật khẩu phải có ít nhất 8 ký tự/]
    D -->|Đúng| F{Email đã tồn tại?}
    F -->|Có| E4[/Return 409: Email đã được sử dụng/]
    F -->|Chưa| G[bcrypt hash password - cost=12]
    G --> H[prisma.user.create - role=CUSTOMER, isActive=true]
    H --> I[/Return 201 + user info/]
    I --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
    E4 --> Z
```

---

## AD-02: Đăng nhập

```mermaid
flowchart TD
    A([Start: Guest gửi POST /login]) --> B[Validate email + password]
    B -->|Thiếu/Sai format| E1[/Return 400/]
    B -->|Hợp lệ| C[Tìm user theo email trong DB]
    C -->|Không tìm thấy| E2[/Return 401: Email hoặc mật khẩu không đúng/]
    C -->|Tìm thấy| D{isActive?}
    D -->|false| E3[/Return 403: Tài khoản đã bị khóa/]
    D -->|true| F[bcrypt.compare password vs passwordHash]
    F -->|Sai| E2
    F -->|Đúng| G[signAccessToken - TTL 15m]
    G --> H[signRefreshToken - TTL 7d]
    H --> I[prisma.refreshToken.create - expiresAt = now+7d]
    I --> J[/Return 200 + accessToken + refreshToken + user/]
    J --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
```

---

## AD-03: Làm mới phiên đăng nhập (Refresh Token Rotation)

```mermaid
flowchart TD
    A([Start: Client gửi POST /refresh]) --> B{Có refreshToken?}
    B -->|Không| E1[/Return 400: Thiếu refresh token/]
    B -->|Có| C[verifyRefreshToken - kiểm tra chữ ký JWT]
    C -->|Sai/Hết hạn| E2[/Return 401: Refresh token không hợp lệ hoặc đã hết hạn/]
    C -->|Hợp lệ| D[Tìm token trong DB theo chuỗi token]
    D -->|Không thấy| E3[/Return 401: Refresh token không hợp lệ/]
    D -->|Tìm thấy| E{isRevoked = false\nVÀ expiresAt > now?}
    E -->|Không| E3
    E -->|Có| F[Bắt đầu Prisma Transaction]
    F --> G[Revoke token cũ - isRevoked = true]
    G --> H[Sign Access Token mới]
    H --> I[Sign Refresh Token mới]
    I --> J[Lưu Refresh Token mới vào DB]
    J --> K[Commit Transaction]
    K --> L[/Return 200 + accessToken mới + refreshToken mới/]
    L --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
```

---

## AD-04: Quên mật khẩu

```mermaid
flowchart TD
    A([Start: Guest gửi POST /forgot-password]) --> B[Validate email format]
    B -->|Sai| E1[/Return 400: Email không hợp lệ/]
    B -->|Đúng| C[Tìm user theo email trong DB]
    C -->|Không tìm thấy| SILENT[Return 200 - im lặng, không leak]
    C -->|Tìm thấy| D[Sinh OTP 6 chữ số ngẫu nhiên]
    D --> E[SHA-256 hash OTP]
    E --> F[Tính expires = now + 15 phút]
    F --> G[prisma.user.update - lưu hashedOtp + expires]
    G --> H[Gửi email chứa OTP gốc]
    H --> I[/Return 200/]
    I --> Z([End])
    SILENT --> Z
    E1 --> Z
```

---

## AD-05: Đặt lại mật khẩu

```mermaid
flowchart TD
    A([Start: Guest gửi POST /reset-password]) --> B[Validate OTP - đúng 6 chữ số]
    B -->|Sai| E1[/Return 400: OTP phải là 6 chữ số/]
    B -->|Đúng| C[Validate newPassword ≥ 8 ký tự]
    C -->|Sai| E2[/Return 400: Mật khẩu mới phải có ít nhất 8 ký tự/]
    C -->|Đúng| D[SHA-256 hash OTP đầu vào]
    D --> E[Tìm user có resetPasswordToken = hash\nVÀ resetPasswordExpires > now]
    E -->|Không tìm thấy| E3[/Return 400: Token không hợp lệ hoặc đã hết hạn/]
    E -->|Tìm thấy| F[bcrypt hash newPassword]
    F --> G[Bắt đầu Prisma Transaction]
    G --> G1[Cập nhật passwordHash]
    G1 --> G2[Xóa resetPasswordToken và resetPasswordExpires]
    G2 --> G3[Revoke toàn bộ RefreshToken của user]
    G3 --> H[Commit Transaction]
    H --> I[/Return 200: Đặt lại mật khẩu thành công/]
    I --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
```

---

## AD-06: Đăng xuất

```mermaid
flowchart TD
    A([Start: User gửi POST /logout]) --> B{Có refreshToken trong body?}
    B -->|Không| E1[/Return 400: Thiếu refresh token/]
    B -->|Có| C[prisma.refreshToken.updateMany\nisRevoked = true WHERE token = input]
    C --> D[/Return 200: Đăng xuất thành công/]
    D --> Z([End])
    E1 --> Z
```

> **Ghi chú:** Access Token không được vô hiệu hóa — hết hạn tự nhiên sau ≤ 15 phút.

---

## AD-07: Xác thực request (Middleware Authenticate)

```mermaid
flowchart TD
    A([Request đến protected route]) --> B{Header Authorization\nbắt đầu bằng Bearer?}
    B -->|Không| E1[/Return 401: Không có token xác thực/]
    B -->|Có| C[Trích xuất token từ header]
    C --> D[verifyAccessToken - kiểm tra chữ ký + expiry]
    D -->|Lỗi| E2[/Return 401: Token không hợp lệ hoặc đã hết hạn/]
    D -->|Hợp lệ| E[Gán req.user = payload JWT]
    E --> F([Tiếp tục đến Middleware/Controller tiếp theo])
    E1 --> Z([End])
    E2 --> Z
```

---

## AD-08: Phân quyền theo Role (Middleware Authorize)

```mermaid
flowchart TD
    A([Request sau authenticate]) --> B{req.user tồn tại?}
    B -->|Không| E1[/Return 401: Chưa xác thực/]
    B -->|Có| C{req.user.role\nnằm trong allowed roles?}
    C -->|Không| E2[/Return 403: Bạn không có quyền thực hiện thao tác này/]
    C -->|Có| D([Tiếp tục đến Controller])
    E1 --> Z([End])
    E2 --> Z
```
