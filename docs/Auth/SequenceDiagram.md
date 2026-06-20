# Sequence Diagram — Luồng API
## Module: Authentication
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Ghi chú:** Sử dụng cú pháp Mermaid sequenceDiagram

---

## SD-01: Đăng ký tài khoản

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant RL as RateLimiter
    participant V as Validator
    participant S as AuthService
    participant DB as PostgreSQL

    C->>RL: POST /api/auth/register
    RL-->>C: 429 (nếu vượt 10 req/15 phút)
    RL->>V: validateRegister
    V-->>C: 400 (nếu email/fullName/password không hợp lệ)
    V->>S: registerService(body)
    S->>DB: findUnique WHERE email = ?
    DB-->>S: user | null
    alt Email đã tồn tại
        S-->>C: 409 Email đã được sử dụng
    else Email chưa tồn tại
        S->>S: bcrypt.hash(password, 12)
        S->>DB: user.create({ email, fullName, passwordHash, phone })
        DB-->>S: User record
        S-->>C: 201 { id, email, fullName, role, createdAt }
    end
```

---

## SD-02: Đăng nhập

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant RL as RateLimiter
    participant V as Validator
    participant S as AuthService
    participant DB as PostgreSQL
    participant JWT as TokenManager

    C->>RL: POST /api/auth/login
    RL-->>C: 429 (nếu vượt rate limit)
    RL->>V: validateLogin
    V-->>C: 400 (nếu thiếu email/password)
    V->>S: loginService(body)
    S->>DB: findUnique WHERE email = ?
    DB-->>S: user | null
    alt Không tìm thấy user
        S-->>C: 401 Email hoặc mật khẩu không đúng
    else Tìm thấy user
        alt isActive = false
            S-->>C: 403 Tài khoản đã bị khóa
        else isActive = true
            S->>S: bcrypt.compare(password, passwordHash)
            alt Password sai
                S-->>C: 401 Email hoặc mật khẩu không đúng
            else Password đúng
                S->>JWT: signAccessToken(payload) — TTL 15m
                JWT-->>S: accessToken
                S->>JWT: signRefreshToken(payload) — TTL 7d
                JWT-->>S: refreshToken
                S->>DB: refreshToken.create({ token, userId, expiresAt })
                DB-->>S: OK
                S-->>C: 200 { accessToken, refreshToken, user }
            end
        end
    end
```

---

## SD-03: Làm mới phiên đăng nhập (Refresh Token Rotation)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant RL as RateLimiter
    participant V as Validator
    participant S as AuthService
    participant JWT as TokenManager
    participant DB as PostgreSQL

    C->>RL: POST /api/auth/refresh { refreshToken }
    RL-->>C: 429 (nếu vượt rate limit)
    RL->>V: validateRefreshToken
    V-->>C: 400 Thiếu refresh token
    V->>S: refreshTokenService(token)
    S->>JWT: verifyRefreshToken(token)
    alt JWT sai chữ ký / hết hạn
        JWT-->>S: throw error
        S-->>C: 401 Refresh token không hợp lệ hoặc đã hết hạn
    else JWT hợp lệ
        JWT-->>S: payload { userId, email, role }
        S->>DB: refreshToken.findUnique WHERE token = ?
        DB-->>S: stored | null
        alt Không tìm thấy / isRevoked / hết hạn
            S-->>C: 401 Refresh token không hợp lệ
        else Hợp lệ
            S->>DB: $transaction([revoke cũ, create mới])
            Note over S,DB: Atomic: revoke old token + create new token
            DB-->>S: OK
            S->>JWT: signAccessToken(newPayload)
            JWT-->>S: newAccessToken
            S->>JWT: signRefreshToken(newPayload)
            JWT-->>S: newRefreshToken
            S-->>C: 200 { accessToken: new, refreshToken: new }
        end
    end
```

---

## SD-04: Quên mật khẩu

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant RL as RateLimiter
    participant V as Validator
    participant S as AuthService
    participant DB as PostgreSQL
    participant Mail as MailServer

    C->>RL: POST /api/auth/forgot-password { email }
    RL-->>C: 429 (nếu vượt rate limit)
    RL->>V: validateForgotPassword
    V-->>C: 400 Email không hợp lệ
    V->>S: forgotPasswordService(email)
    S->>DB: findUnique WHERE email = ?
    DB-->>S: user | null
    alt Email không tồn tại
        S-->>C: 200 (im lặng — không leak)
    else Email tồn tại
        S->>S: Sinh OTP 6 chữ số
        S->>S: SHA-256 hash OTP
        S->>S: Tính expires = now + 15 phút
        S->>DB: user.update({ resetPasswordToken: hash, resetPasswordExpires: expires })
        DB-->>S: OK
        S->>Mail: sendResetPasswordEmail(email, otp_gốc)
        Mail-->>S: Sent
        S-->>C: 200
    end
```

---

## SD-05: Đặt lại mật khẩu

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant RL as RateLimiter
    participant V as Validator
    participant S as AuthService
    participant DB as PostgreSQL

    C->>RL: POST /api/auth/reset-password { otp, newPassword }
    RL-->>C: 429 (nếu vượt rate limit)
    RL->>V: validateResetPassword
    V-->>C: 400 (OTP không phải 6 chữ số hoặc password < 8 ký tự)
    V->>S: resetPasswordService(otp, newPassword)
    S->>S: SHA-256 hash OTP đầu vào
    S->>DB: findFirst WHERE resetPasswordToken = hash AND resetPasswordExpires > now
    DB-->>S: user | null
    alt Không tìm thấy / hết hạn
        S-->>C: 400 Token không hợp lệ hoặc đã hết hạn
    else Hợp lệ
        S->>S: bcrypt.hash(newPassword, 12)
        S->>DB: $transaction([<br/>  user.update(passwordHash, clearOTP),<br/>  refreshToken.updateMany(isRevoked=true)<br/>])
        Note over S,DB: Atomic: đổi password + revoke toàn bộ session
        DB-->>S: OK
        S-->>C: 200 Đặt lại mật khẩu thành công
    end
```

---

## SD-06: Đăng xuất

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant V as Validator
    participant S as AuthService
    participant DB as PostgreSQL

    C->>V: POST /api/auth/logout { refreshToken }
    Note over C,V: Không có RateLimiter cho logout
    V-->>C: 400 Thiếu refresh token
    V->>S: logoutService(token)
    S->>DB: refreshToken.updateMany({ isRevoked: true }) WHERE token = ?
    DB-->>S: { count: 0 | 1 }
    S-->>C: 200 Đăng xuất thành công
    Note over C: Access Token vẫn còn hiệu lực tối đa 15 phút
```

---

## SD-07: Truy cập API bảo vệ (Protected Route)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Auth as Middleware: authenticate
    participant Authz as Middleware: authorize
    participant Ctrl as Controller

    C->>Auth: GET /api/... Authorization: Bearer <accessToken>
    alt Không có header Bearer
        Auth-->>C: 401 Không có token xác thực
    else Có header
        Auth->>Auth: verifyAccessToken(token)
        alt Token sai / hết hạn
            Auth-->>C: 401 Token không hợp lệ hoặc đã hết hạn
        else Token hợp lệ
            Auth->>Auth: req.user = { userId, email, role }
            Auth->>Authz: next() [nếu route có authorize]
            alt Role không đủ quyền
                Authz-->>C: 403 Bạn không có quyền thực hiện thao tác này
            else Role hợp lệ
                Authz->>Ctrl: next()
                Ctrl-->>C: 200 + data
            end
        end
    end
```

---

## SD-08: Toàn cảnh luồng Token trong 1 phiên người dùng

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant API as API Server
    participant DB as PostgreSQL

    Note over C,DB: ── Bước 1: Đăng nhập ──
    C->>API: POST /login
    API->>DB: Lưu RefreshToken
    API-->>C: accessToken (15m) + refreshToken (7d)

    Note over C,DB: ── Bước 2: Dùng API bình thường ──
    C->>API: GET /api/protected Bearer accessToken
    API-->>C: 200 data

    Note over C,DB: ── Bước 3: Access Token hết hạn ──
    C->>API: GET /api/protected Bearer accessToken (hết hạn)
    API-->>C: 401

    Note over C,DB: ── Bước 4: Tự động refresh ──
    C->>API: POST /refresh { refreshToken }
    API->>DB: Revoke token cũ + lưu token mới
    API-->>C: accessToken mới + refreshToken mới

    Note over C,DB: ── Bước 5: Tiếp tục dùng ──
    C->>API: GET /api/protected Bearer accessToken mới
    API-->>C: 200 data

    Note over C,DB: ── Bước 6: Đăng xuất ──
    C->>API: POST /logout { refreshToken }
    API->>DB: isRevoked = true
    API-->>C: 200
```
