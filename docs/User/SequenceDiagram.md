# Sequence Diagram — Luồng API
## Module: User
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## SD-01: Xem hồ sơ cá nhân

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant M as Middleware: authenticate
    participant S as UserService
    participant DB as PostgreSQL

    C->>M: GET /api/users/me\nAuthorization: Bearer <token>
    M->>M: verifyAccessToken → req.user = { userId, ... }
    M-->>C: 401 (nếu token không hợp lệ)
    M->>S: getProfile(userId)
    S->>DB: user.findUnique WHERE id=userId SELECT public fields
    DB-->>S: User record
    S-->>C: 200 { id, email, fullName, phone, avatarUrl, role, ... }
```

---

## SD-02: Cập nhật hồ sơ

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant V as Validator
    participant S as UserService
    participant DB as PostgreSQL

    C->>V: PUT /api/users/me { fullName?, phone? }
    V->>V: Kiểm tra ít nhất 1 trường
    V->>V: Validate fullName (≥2 ký tự)
    V->>V: Validate phone (regex VN)
    V-->>C: 400 (nếu validate fail)
    V->>S: updateProfile(userId, body)
    alt Gửi phone không rỗng
        S->>DB: user.findFirst WHERE phone=? AND id!=userId
        DB-->>S: existing | null
        alt Phone đã tồn tại
            S-->>C: 409 Số điện thoại đã được sử dụng
        end
    end
    S->>DB: user.update WHERE id=userId\nSET fullName?, phone?
    DB-->>S: Updated user
    S-->>C: 200 + user profile mới
```

---

## SD-03: Đổi mật khẩu

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant V as Validator
    participant S as UserService
    participant DB as PostgreSQL

    C->>V: PUT /api/users/me/password\n{ currentPassword, newPassword }
    V->>V: Validate currentPassword có mặt
    V->>V: Validate newPassword ≥ 8 ký tự
    V->>V: Validate newPassword != currentPassword
    V-->>C: 400 (nếu fail)
    V->>S: changePassword(userId, body)
    S->>DB: user.findUnique WHERE id=userId
    DB-->>S: user (có passwordHash)
    alt Không có passwordHash
        S-->>C: 400 Tài khoản không dùng mật khẩu
    end
    S->>S: bcrypt.compare(currentPassword, passwordHash)
    alt Sai mật khẩu
        S-->>C: 400 Mật khẩu hiện tại không đúng
    end
    S->>S: bcrypt.hash(newPassword, 12)
    S->>DB: user.update SET passwordHash=newHash
    DB-->>S: OK
    S-->>C: 200 Đổi mật khẩu thành công
```

---

## SD-04: Upload ảnh đại diện

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant RL as RateLimiter (10/hr)
    participant Multer as Multer (file parse)
    participant S as UserService
    participant CDN as Cloudinary
    participant DB as PostgreSQL

    C->>RL: POST /api/users/me/avatar (multipart)
    RL-->>C: 429 (nếu vượt 10/giờ)
    RL->>Multer: parse file
    Multer->>Multer: Validate định dạng + kích thước ≤5MB
    Multer-->>C: 400 (nếu fail)
    Multer->>S: uploadAvatar(userId, buffer, mimetype)
    S->>CDN: upload(buffer, { folder: users/avatars, public_id: user_userId, overwrite: true, crop: fill 400x400 face })
    Note over S,CDN: Ảnh cũ bị ghi đè tại chỗ (cùng public_id)
    CDN-->>S: { secure_url, public_id }
    S->>DB: user.update SET avatarUrl=secure_url, avatarPublicId=public_id
    DB-->>S: OK
    S-->>C: 200 { avatarUrl, avatarPublicId }
```

---

## SD-05: Thêm địa chỉ mới (có isDefault=true)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant V as Validator
    participant S as UserService
    participant DB as PostgreSQL

    C->>V: POST /api/users/me/addresses { fullName, phone, province, ..., isDefault: true }
    V->>V: Validate tất cả trường bắt buộc
    V-->>C: 400 (nếu fail)
    V->>S: createAddress(userId, body)
    S->>DB: address.findFirst WHERE userId=userId
    DB-->>S: existing | null
    Note over S: shouldBeDefault = isDefault OR existing===null
    alt shouldBeDefault = true
        S->>DB: $transaction([<br/>  address.updateMany SET isDefault=false,<br/>  address.create isDefault=true<br/>])
        Note over S,DB: Atomic: unset old default → create new default
        DB-->>S: New address
    else shouldBeDefault = false
        S->>DB: address.create isDefault=false
        DB-->>S: New address
    end
    S-->>C: 201 + địa chỉ mới
```

---

## SD-06: Xóa địa chỉ mặc định

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as UserService
    participant DB as PostgreSQL

    C->>S: DELETE /api/users/me/addresses/:id
    S->>DB: address.findUnique WHERE id=addressId
    DB-->>S: address | null
    alt Không tìm thấy hoặc userId không khớp
        S-->>C: 404 Địa chỉ không tồn tại
    end
    S->>DB: address.delete WHERE id=addressId
    DB-->>S: deleted address (isDefault=true)
    alt address.isDefault = true
        S->>DB: address.findFirst WHERE userId ORDER BY createdAt DESC
        DB-->>S: nextAddress | null
        alt Còn địa chỉ khác
            S->>DB: address.update SET isDefault=true WHERE id=nextAddress.id
            DB-->>S: OK
        end
    end
    S-->>C: 200 Xóa địa chỉ thành công
```

---

## SD-07: Đặt địa chỉ mặc định

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as UserService
    participant DB as PostgreSQL

    C->>S: PATCH /api/users/me/addresses/:id/default
    S->>DB: address.findUnique WHERE id=addressId
    DB-->>S: address | null
    alt Không tìm thấy hoặc userId không khớp
        S-->>C: 404 Địa chỉ không tồn tại
    end
    alt address.isDefault = true
        S-->>C: 200 (idempotent — đã là mặc định rồi)
    else
        S->>DB: $transaction([<br/>  address.updateMany SET isDefault=false WHERE userId,<br/>  address.update SET isDefault=true WHERE id<br/>])
        DB-->>S: OK
        S-->>C: 200 Đặt địa chỉ mặc định thành công
    end
```
