# Sequence Diagram — Luồng API
## Module: Auth
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Đăng ký

```mermaid
sequenceDiagram
    participant C as Client
    participant R as AuthRouter
    participant V as validateRegister
    participant S as auth.service
    participant DB as Database

    C->>R: POST /auth/register {email, fullName, password}
    R->>V: validateRegister
    alt validation lỗi
        V-->>C: 400 Bad Request
    end
    R->>S: registerService(body)
    S->>DB: user.findUnique WHERE email
    alt email tồn tại
        S-->>C: 409 Email đã được sử dụng
    end
    S->>S: hashPassword(password)
    S->>DB: user.create {email, fullName, passwordHash}
    DB-->>S: user record
    S-->>C: 200 {id, email, fullName, role, createdAt}
```

---

## 2. Đăng nhập

```mermaid
sequenceDiagram
    participant C as Client
    participant S as auth.service
    participant DB as Database

    C->>S: POST /auth/login {email, password}
    S->>DB: user.findUnique WHERE email
    alt !user || !passwordHash
        S-->>C: 401 (same message)
    end
    alt !isActive
        S-->>C: 403 Tài khoản bị vô hiệu hóa
    end
    S->>S: verifyPassword(password, passwordHash)
    alt sai password
        S-->>C: 401
    end
    S->>S: signAccessToken + signRefreshToken
    S->>DB: refreshToken.create {token, userId, expiresAt: now+7d}
    S-->>C: 200 {accessToken, refreshToken, user}
```

---

## 3. Refresh Token (rotation)

```mermaid
sequenceDiagram
    participant C as Client
    participant S as auth.service
    participant DB as Database

    C->>S: POST /auth/refresh {refreshToken}
    S->>S: verifyRefreshToken(token)
    alt JWT invalid
        S-->>C: 401
    end
    S->>DB: refreshToken.findUnique WHERE token
    alt isRevoked || expiresAt < now || !found
        S-->>C: 401
    end
    S->>S: signAccessToken + signRefreshToken (mới)
    S->>DB: Transaction
    Note over DB: update isRevoked=true (cũ)<br/>create refreshToken mới
    S-->>C: 200 {accessToken, refreshToken}
```

---

## 4. Quên mật khẩu

```mermaid
sequenceDiagram
    participant C as Client
    participant S as auth.service
    participant DB as Database
    participant Mail as EmailService

    C->>S: POST /auth/forgot-password {email}
    S->>DB: user.findUnique WHERE email
    alt !user
        S-->>C: 200 (silent return)
    end
    S->>S: generate OTP 6 số
    S->>S: hashResetToken(otp) = SHA-256(otp)
    S->>DB: user.update {resetPasswordToken: hash, resetPasswordExpires: now+15m}
    S->>Mail: sendResetPasswordEmail(email, otp gốc)
    S-->>C: 200
```

---

## 5. Đặt lại mật khẩu

```mermaid
sequenceDiagram
    participant C as Client
    participant S as auth.service
    participant DB as Database

    C->>S: POST /auth/reset-password {otp, newPassword}
    S->>S: hashResetToken(otp)
    S->>DB: user.findFirst WHERE resetPasswordToken=hash AND resetPasswordExpires>now
    alt !user
        S-->>C: 400 Token không hợp lệ hoặc đã hết hạn
    end
    S->>S: hashPassword(newPassword)
    S->>DB: Transaction
    Note over DB: user.update {passwordHash mới, token=null, expires=null}<br/>refreshToken.updateMany {isRevoked=true} WHERE userId
    S-->>C: 200
```

---

## 6. Đăng xuất

```mermaid
sequenceDiagram
    participant C as Client
    participant S as auth.service
    participant DB as Database

    C->>S: POST /auth/logout {refreshToken}
    S->>DB: refreshToken.updateMany WHERE token AND isRevoked=false SET isRevoked=true
    Note over DB: Idempotent — count=0 nếu đã revoke trước đó
    S-->>C: 200
```

---

## 7. authenticate Middleware (luồng điển hình)

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as authenticate
    participant H as Handler

    C->>MW: Request với Authorization: Bearer <token>
    MW->>MW: verifyAccessToken(token)
    alt token invalid / expired
        MW-->>C: 401
    end
    MW->>MW: req.user = {userId, email, role}
    MW->>H: next()
    H-->>C: Response từ handler
```
