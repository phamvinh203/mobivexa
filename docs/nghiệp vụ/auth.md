# Nghiệp vụ Authentication & Authorization — Mobivexa

> **Phạm vi:** Module `src/services/auth.service.ts`, `src/controllers/auth.controller.ts`, `src/routes/auth.route.ts`, `src/middlewares/auth.middleware.ts`, `src/middlewares/authorize.middleware.ts`
>
> **Cập nhật:** 2026-06-19

---

## 1. Tổng quan

Hệ thống xác thực của Mobivexa sử dụng mô hình **JWT dual-token** (Access Token + Refresh Token) kết hợp với **Refresh Token Rotation** để đảm bảo bảo mật. Toàn bộ endpoint auth được bảo vệ bởi **Rate Limiting**.

### Các chức năng chính

| STT | Chức năng | Endpoint |
|-----|-----------|----------|
| 1 | Đăng ký tài khoản | `POST /api/auth/register` |
| 2 | Đăng nhập | `POST /api/auth/login` |
| 3 | Làm mới Access Token | `POST /api/auth/refresh` |
| 4 | Quên mật khẩu (gửi OTP) | `POST /api/auth/forgot-password` |
| 5 | Đặt lại mật khẩu (xác nhận OTP) | `POST /api/auth/reset-password` |
| 6 | Đăng xuất | `POST /api/auth/logout` |

---

## 2. Chính sách & Ràng buộc nghiệp vụ

### 2.1 Chính sách Token

| Loại token | Thời hạn mặc định | Secret | Thuật toán |
|---|---|---|---|
| Access Token | 15 phút (`JWT_ACCESS_EXPIRES`) | `JWT_ACCESS_SECRET` (≥ 32 ký tự) | HS256 |
| Refresh Token | 7 ngày (`JWT_REFRESH_EXPIRES`) | `JWT_REFRESH_SECRET` (≥ 32 ký tự) | HS256 |

- **Fail-fast:** Server từ chối khởi động nếu thiếu hoặc JWT secret < 32 ký tự.
- **Refresh Token Rotation:** Mỗi lần làm mới, token cũ bị **revoke** và token mới được tạo trong cùng 1 database transaction (atomic).
- Refresh Token được lưu trong bảng `RefreshToken` ở DB, có trường `isRevoked` và `expiresAt`.

### 2.2 Chính sách Mật khẩu

| Quy tắc | Giá trị |
|---|---|
| Độ dài tối thiểu | 8 ký tự |
| Thuật toán hash | bcrypt, cost factor = 12 |

### 2.3 Chính sách OTP (Quên mật khẩu)

| Quy tắc | Giá trị |
|---|---|
| Định dạng OTP | 6 chữ số nguyên (`100000` – `999999`) |
| Thời hạn hiệu lực | 15 phút |
| Lưu trữ | Hash SHA-256 của OTP (không lưu bản gốc) |
| Kênh gửi | Email (SMTP / Nodemailer) |

### 2.4 Chính sách Rate Limiting

| Quy tắc | Giá trị |
|---|---|
| Cửa sổ thời gian | 15 phút |
| Số request tối đa | 10 request / IP / 15 phút |
| Áp dụng cho | `register`, `login`, `refresh`, `forgot-password`, `reset-password` |
| Bỏ qua trong | `NODE_ENV === 'test'` |
| Không áp dụng cho | `logout` |

### 2.5 Phân quyền (Role)

| Role | Mô tả |
|---|---|
| `CUSTOMER` | Người dùng thông thường (mặc định khi đăng ký) |
| `STAFF` | Nhân viên — có quyền quản trị catalog, đơn hàng |
| `ADMIN` | Quản trị viên — toàn quyền |

Nhóm `STAFF_ROLES = [ADMIN, STAFF]` được dùng để phân quyền các route quản trị.

---

## 3. Luồng nghiệp vụ chi tiết

### 3.1 Đăng ký tài khoản

```
Client → [Rate Limiter] → [Validate] → Service → DB → Response
```

**Happy Path:**
1. Client gửi `{ email, fullName, password, phone? }`
2. Validate: email hợp lệ, `fullName ≥ 2 ký tự`, `password ≥ 8 ký tự`
3. Kiểm tra email đã tồn tại trong DB chưa
4. Hash mật khẩu bằng bcrypt (cost=12)
5. Tạo bản ghi User mới
6. Trả về `201` + thông tin user (không có `passwordHash`)

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Email sai định dạng | 400 | `Email không hợp lệ` |
| Họ tên < 2 ký tự | 400 | `Họ tên phải có ít nhất 2 ký tự` |
| Mật khẩu < 8 ký tự | 400 | `Mật khẩu phải có ít nhất 8 ký tự` |
| Email đã tồn tại | 409 | `Email đã được sử dụng` |
| Rate limit vượt ngưỡng | 429 | `Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút` |

---

### 3.2 Đăng nhập

```
Client → [Rate Limiter] → [Validate] → Service → DB → Sign Tokens → DB (lưu RT) → Response
```

**Happy Path:**
1. Client gửi `{ email, password }`
2. Validate: email hợp lệ, password không rỗng
3. Tra cứu user theo email
4. Kiểm tra tài khoản có bị khóa (`isActive = false`) không
5. So sánh mật khẩu với `passwordHash` bằng bcrypt
6. Tạo `accessToken` (15 phút) và `refreshToken` (7 ngày)
7. Lưu `refreshToken` vào bảng `RefreshToken` trong DB
8. Trả về `200` + `{ accessToken, refreshToken, user }` — user **không có** `passwordHash`, `resetPasswordToken`, `resetPasswordExpires`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Email không tồn tại | 401 | `Email hoặc mật khẩu không đúng` |
| Sai mật khẩu | 401 | `Email hoặc mật khẩu không đúng` |
| Tài khoản bị khóa | 403 | `Tài khoản đã bị khóa` |

> **Bảo mật:** Cùng thông báo lỗi cho "không tìm thấy email" và "sai mật khẩu" để tránh User Enumeration Attack.

---

### 3.3 Làm mới Access Token (Token Refresh)

```
Client → [Rate Limiter] → [Validate] → Service → Verify JWT → DB check → Rotate → Response
```

**Happy Path:**
1. Client gửi `{ refreshToken }`
2. Verify chữ ký JWT của refresh token
3. Tra cứu token trong DB (`RefreshToken` table)
4. Kiểm tra: token không bị revoke (`isRevoked = false`) và chưa hết hạn (`expiresAt > now`)
5. **Atomic rotation** trong 1 transaction:
   - Đánh dấu token cũ: `isRevoked = true`
   - Tạo cặp token mới (`accessToken` + `refreshToken`)
6. Trả về `200` + `{ accessToken, refreshToken }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Thiếu `refreshToken` | 400 | `Thiếu refresh token` |
| JWT không hợp lệ / hết hạn | 401 | `Refresh token không hợp lệ hoặc đã hết hạn` |
| Token bị revoke hoặc không tồn tại trong DB | 401 | `Refresh token không hợp lệ` |

---

### 3.4 Quên mật khẩu — Gửi OTP

```
Client → [Rate Limiter] → [Validate] → Service → DB → Hash OTP → DB (lưu) → Email → Response
```

**Happy Path:**
1. Client gửi `{ email }`
2. Validate email hợp lệ
3. Tra cứu user theo email
4. Nếu **không tìm thấy** → vẫn trả `200` (không xử lý thêm)
5. Nếu tìm thấy:
   - Sinh OTP ngẫu nhiên 6 chữ số
   - Hash OTP bằng SHA-256 trước khi lưu DB
   - Cập nhật `resetPasswordToken` (hashed) và `resetPasswordExpires` (now + 15 phút) vào bảng User
   - Gửi OTP gốc qua email
6. Trả về `200` + `{ message: 'Nếu email tồn tại, mã OTP đã được gửi' }`

> **Bảo mật:** Luôn trả `200` dù email có tồn tại hay không — tránh **User Enumeration Attack**. OTP gốc không bao giờ lưu vào DB.

---

### 3.5 Đặt lại mật khẩu — Xác nhận OTP

```
Client → [Rate Limiter] → [Validate] → Service → Hash OTP → DB check → Reset → Revoke all RT → Response
```

**Happy Path:**
1. Client gửi `{ otp, newPassword }`
2. Validate: OTP đúng 6 chữ số, `newPassword ≥ 8 ký tự`
3. Hash OTP nhận được bằng SHA-256
4. Tra cứu user có `resetPasswordToken = hash(otp)` VÀ `resetPasswordExpires > now`
5. **Atomic transaction:**
   - Hash `newPassword` bằng bcrypt (cost=12)
   - Cập nhật `passwordHash` mới, xóa `resetPasswordToken` và `resetPasswordExpires`
   - Revoke **toàn bộ** refresh token còn hiệu lực của user đó
6. Trả về `200` + `{ message: 'Đặt lại mật khẩu thành công' }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| OTP không phải 6 chữ số | 400 | `OTP phải là 6 chữ số` |
| Mật khẩu mới < 8 ký tự | 400 | `Mật khẩu mới phải có ít nhất 8 ký tự` |
| OTP sai hoặc hết hạn | 400 | `Token không hợp lệ hoặc đã hết hạn` |

> **Bảo mật:** Sau khi đổi mật khẩu thành công, tất cả session cũ (refresh token) bị vô hiệu hóa để bảo vệ tài khoản khỏi bị chiếm đoạt.

---

### 3.6 Đăng xuất

```
Client → [Validate] → Service → DB (revoke RT) → Response
```

**Happy Path:**
1. Client gửi `{ refreshToken }`
2. Validate: `refreshToken` không rỗng
3. Tìm và đánh dấu `isRevoked = true` cho token đó trong DB
4. Trả về `200` + `{ message: 'Đăng xuất thành công' }`

> **Lưu ý:** Logout **không** áp dụng Rate Limiting vì đây là hành động người dùng muốn thoát nhanh, không nên bị chặn.

---

## 4. Middleware xác thực & phân quyền

### 4.1 `authenticate` middleware

Áp dụng cho tất cả route cần đăng nhập.

```
Request → Header Authorization: Bearer <token> → verifyAccessToken → req.user = payload → next()
```

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Thiếu header `Authorization` hoặc không phải `Bearer` | 401 | `Không có token xác thực` |
| Token không hợp lệ / hết hạn | 401 | `Token không hợp lệ hoặc đã hết hạn` |

`req.user` sau khi xác thực chứa: `{ userId, email, role }`

### 4.2 `authorize(...roles)` middleware

Dùng **sau** `authenticate`, kiểm tra role của user.

```
authenticate → authorize(ADMIN, STAFF) → next() hoặc 403
```

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Chưa có `req.user` | 401 | `Chưa xác thực` |
| Role không nằm trong danh sách cho phép | 403 | `Bạn không có quyền thực hiện thao tác này` |

**Ví dụ sử dụng trong route:**
```typescript
router.get('/admin/users', authenticate, authorize(...STAFF_ROLES), handler)
```

---

## 5. Sơ đồ luồng tổng thể

```
                    ┌──────────────────────────────┐
                    │         CLIENT               │
                    └────────────┬─────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
         [Register]          [Login]           [Forgot PW]
              │                  │                  │
              ▼                  ▼                  ▼
         Validate            Validate           Validate
              │                  │                  │
         Hash PW            Check User         Tìm User
              │                  │                  │
         Create User        Check isActive      Hash OTP
              │                  │                  │
         201 + User         Verify PW          Lưu DB + Email
                                │                  │
                           Sign Tokens          200 (luôn)
                                │
                        Lưu RT vào DB
                                │
                      200 + {AT, RT, user}
                                │
                    ┌───────────┴───────────┐
                    │                       │
              [Access API]           [RT hết hạn]
              Bearer AT                    │
                    │               POST /refresh
              authenticate               │
                    │            Verify RT JWT
              authorize              │
                    │         DB: check isRevoked
              Handler            │
                             Rotate RT (atomic)
                                  │
                            200 + {newAT, newRT}
```

---

## 6. Bảng dữ liệu liên quan

### Bảng `User` (các trường liên quan auth)

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `email` | string | Unique, dùng để đăng nhập |
| `passwordHash` | string | bcrypt hash, cost=12 |
| `isActive` | boolean | `false` = tài khoản bị khóa |
| `role` | enum | `CUSTOMER` / `STAFF` / `ADMIN` |
| `resetPasswordToken` | string? | SHA-256 hash của OTP |
| `resetPasswordExpires` | DateTime? | Thời điểm hết hạn OTP |

### Bảng `RefreshToken`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `token` | string | JWT refresh token (unique) |
| `userId` | string | FK → User |
| `isRevoked` | boolean | `true` = đã bị thu hồi |
| `expiresAt` | DateTime | Thời điểm hết hạn (now + 7 ngày) |
| `createdAt` | DateTime | Thời điểm tạo |

---

## 7. Tác vụ dọn dẹp định kỳ

Hàm `cleanupExpiredTokens()` xóa các refresh token thỏa mãn:
- Đã hết hạn (`expiresAt < now`), **hoặc**
- Đã bị revoke và được tạo cách đây hơn 7 ngày

> Hàm này cần được gọi định kỳ (cron job) để tránh bảng `RefreshToken` phình to.

---

## 8. Tóm tắt các điểm bảo mật quan trọng

| # | Biện pháp | Mục đích |
|---|---|---|
| 1 | JWT dual-token + Rotation | Giảm thiểu rủi ro nếu Access Token bị lộ |
| 2 | bcrypt cost=12 | Chống brute-force mật khẩu |
| 3 | SHA-256 hash OTP trước khi lưu DB | OTP gốc không bao giờ ở trong DB |
| 4 | Rate Limit 10 req/15 phút | Chống brute-force đăng nhập / spam OTP |
| 5 | Cùng thông báo lỗi login | Tránh User Enumeration |
| 6 | Luôn `200` cho forgot-password | Tránh User Enumeration |
| 7 | Revoke tất cả RT khi đổi mật khẩu | Bảo vệ tài khoản sau khi bị xâm phạm |
| 8 | Atomic transaction cho rotation & reset | Tránh race condition / inconsistent state |
| 9 | Fail-fast khi thiếu JWT secret | Không cho server chạy ở trạng thái không an toàn |
