# Activity Diagram — Luồng xử lý
## Module: Auth
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Đăng ký (register)

```mermaid
flowchart TD
    A([Start]) --> B[Validate email / fullName / password]
    B --> C{Hợp lệ?}
    C -- Không --> E1[400 Bad Request]
    C -- Có --> D[findUnique WHERE email]
    D --> E{Email tồn tại?}
    E -- Có --> E2[409 Conflict]
    E -- Không --> F[hashPassword]
    F --> G[user.create]
    G --> H[200 — user info không có passwordHash]
```

---

## 2. Đăng nhập (login)

```mermaid
flowchart TD
    A([Start]) --> B[Validate email + password]
    B --> C{Hợp lệ?}
    C -- Không --> E1[400]
    C -- Có --> D[findUnique WHERE email]
    D --> E{user tồn tại và có passwordHash?}
    E -- Không --> E2[401 — cùng message]
    E -- Có --> F{isActive?}
    F -- false --> E3[403]
    F -- true --> G[verifyPassword]
    G --> H{Đúng?}
    H -- Không --> E2
    H -- Có --> I[signAccessToken + signRefreshToken]
    I --> J[refreshToken.create expiresAt = now+7d]
    J --> K[200 accessToken refreshToken user]
```

---

## 3. Refresh Token (rotation)

```mermaid
flowchart TD
    A([Start]) --> B[Validate refreshToken truthy]
    B --> C[verifyRefreshToken JWT]
    C --> D{JWT hợp lệ?}
    D -- Không --> E1[401]
    D -- Có --> E[findUnique WHERE token]
    E --> F{isRevoked=false & expiresAt > now?}
    F -- Không --> E1
    F -- Có --> G[Tạo accessToken + refreshToken mới]
    G --> H[Transaction: revoke cũ + create mới]
    H --> I[200 accessToken refreshToken]
```

---

## 4. Quên mật khẩu (forgotPassword)

```mermaid
flowchart TD
    A([Start]) --> B[Validate email format]
    B --> C{Hợp lệ?}
    C -- Không --> E1[400]
    C -- Có --> D[findUnique WHERE email]
    D --> E{User tồn tại?}
    E -- Không --> Z[200 silent return]
    E -- Có --> F[Tạo OTP 6 số]
    F --> G[SHA-256 OTP]
    G --> H[user.update: hash + expires = now+15m]
    H --> I[sendResetPasswordEmail OTP gốc]
    I --> Z
```

---

## 5. Đặt lại mật khẩu (resetPassword)

```mermaid
flowchart TD
    A([Start]) --> B[Validate otp 6 số + newPassword >= 8]
    B --> C{Hợp lệ?}
    C -- Không --> E1[400]
    C -- Có --> D[hashResetToken otp]
    D --> E[findFirst WHERE token=hash AND expires > now]
    E --> F{Tìm thấy?}
    F -- Không --> E2[400 Token không hợp lệ]
    F -- Có --> G[hashPassword newPassword]
    G --> H[Transaction]
    H --> H1[user.update: passwordHash mới, clear token/expires]
    H --> H2[refreshToken.updateMany: isRevoked=true]
    H1 --> I[200]
    H2 --> I
```

---

## 6. Đăng xuất (logout)

```mermaid
flowchart TD
    A([Start]) --> B[Validate refreshToken truthy]
    B --> C{Hợp lệ?}
    C -- Không --> E1[400]
    C -- Có --> D[refreshToken.updateMany WHERE token AND isRevoked=false]
    D --> E[200 — idempotent count=0 không lỗi]
```

---

## 7. authenticate Middleware

```mermaid
flowchart TD
    A([Request]) --> B{Authorization header?}
    B -- Không --> E1[401 Không có token]
    B -- Có --> C[Tách Bearer token]
    C --> D[verifyAccessToken]
    D --> E{Hợp lệ?}
    E -- Không --> E2[401 Token không hợp lệ]
    E -- Có --> F[req.user = payload]
    F --> G([Next handler])
```
