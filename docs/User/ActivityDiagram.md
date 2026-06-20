# Activity Diagram — Luồng xử lý
## Module: User
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> Render bằng Mermaid (GitHub, Obsidian, VSCode Mermaid Preview)

---

## AD-01: Cập nhật hồ sơ

```mermaid
flowchart TD
    A([Start: PUT /users/me]) --> B{Có fullName hoặc phone?}
    B -->|Không| E1[/400: Vui lòng cung cấp ít nhất một trường/]
    B -->|Có| C{Gửi fullName?}
    C -->|Có| D{fullName >= 2 ký tự?}
    D -->|Không| E2[/400: Họ tên phải có ít nhất 2 ký tự/]
    D -->|Đúng| E
    C -->|Không| E{Gửi phone?}
    E -->|Có| F{phone đúng định dạng VN?}
    F -->|Không| E3[/400: Số điện thoại không hợp lệ/]
    F -->|Đúng| G{phone rỗng?}
    G -->|Không| H{Phone đã dùng bởi user khác?}
    H -->|Có| E4[/409: Số điện thoại đã được sử dụng/]
    H -->|Không| I[Cập nhật DB - chỉ trường được gửi]
    G -->|Có| I2[Lưu phone = null]
    I2 --> J
    E -->|Không| I
    I --> J[/200 + user profile mới/]
    J --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
    E4 --> Z
```

---

## AD-02: Đổi mật khẩu

```mermaid
flowchart TD
    A([Start: PUT /users/me/password]) --> B{currentPassword có mặt?}
    B -->|Không| E1[/400: Vui lòng nhập mật khẩu hiện tại/]
    B -->|Có| C{newPassword >= 8 ký tự?}
    C -->|Không| E2[/400: Mật khẩu mới phải có ít nhất 8 ký tự/]
    C -->|Đúng| D{newPassword != currentPassword?}
    D -->|Bằng nhau| E3[/400: Mật khẩu mới phải khác mật khẩu hiện tại/]
    D -->|Khác nhau| E[Lấy user từ DB]
    E --> F{user có passwordHash?}
    F -->|Không| E4[/400: Tài khoản không dùng mật khẩu/]
    F -->|Có| G[bcrypt.compare currentPassword vs hash]
    G -->|Sai| E5[/400: Mật khẩu hiện tại không đúng/]
    G -->|Đúng| H[bcrypt.hash newPassword - cost=12]
    H --> I[UPDATE user SET passwordHash]
    I --> J[/200: Đổi mật khẩu thành công/]
    J --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
    E4 --> Z
    E5 --> Z
```

---

## AD-03: Upload ảnh đại diện

```mermaid
flowchart TD
    A([Start: POST /users/me/avatar]) --> RL{Vượt rate limit\n10 uploads/giờ?}
    RL -->|Có| E0[/429: Quá nhiều lần upload/]
    RL -->|Không| B{Có file avatar?}
    B -->|Không| E1[/400: Không có file ảnh/]
    B -->|Có| C{Định dạng hợp lệ?\njpg/png/webp}
    C -->|Không| E2[/400: Chỉ chấp nhận file ảnh/]
    C -->|Đúng| D{Kích thước <= 5MB?}
    D -->|Không| E3[/400: Kích thước file tối đa là 5MB/]
    D -->|Đúng| F[Cloudinary upload\npublic_id=user_userId\noverwrite=true\ncrop 400x400 gravity face]
    F -->|Lỗi| E4[/500: Lỗi upload ảnh/]
    F -->|Thành công| G[UPDATE user avatarUrl + avatarPublicId]
    G --> H[/200 + avatarUrl + avatarPublicId/]
    H --> Z([End])
    E0 --> Z
    E1 --> Z
    E2 --> Z
    E3 --> Z
    E4 --> Z
```

---

## AD-04: Thêm địa chỉ mới

```mermaid
flowchart TD
    A([Start: POST /users/me/addresses]) --> B[Validate tất cả trường bắt buộc]
    B -->|Lỗi| E1[/400: Thông báo validate/]
    B -->|Hợp lệ| C{User đã có địa chỉ nào?}
    C -->|Chưa có| D[shouldBeDefault = true]
    C -->|Đã có| E{Gửi isDefault = true?}
    E -->|Không| F[shouldBeDefault = false]
    E -->|Có| D
    D --> G[Prisma Transaction:\nunset all defaults\ncreate address isDefault=true]
    F --> H[prisma.address.create isDefault=false]
    G --> I[/201 + địa chỉ mới/]
    H --> I
    I --> Z([End])
    E1 --> Z
```

---

## AD-05: Xóa địa chỉ

```mermaid
flowchart TD
    A([Start: DELETE /users/me/addresses/:id]) --> B[findOwnedAddress userId + addressId]
    B -->|Không tìm thấy| E1[/404: Địa chỉ không tồn tại/]
    B -->|Tìm thấy| C[prisma.address.delete]
    C --> D{Địa chỉ vừa xóa\nlà mặc định?}
    D -->|Không| Z2[/200: Xóa thành công/]
    D -->|Có| E[Tìm địa chỉ gần nhất còn lại\ncreatedAt DESC]
    E -->|Không còn địa chỉ nào| Z2
    E -->|Tìm thấy| F[UPDATE address SET isDefault=true]
    F --> Z2
    Z2 --> Z([End])
    E1 --> Z
```

---

## AD-06: Đặt địa chỉ mặc định

```mermaid
flowchart TD
    A([Start: PATCH /users/me/addresses/:id/default]) --> B[findOwnedAddress]
    B -->|404| E1[/404: Địa chỉ không tồn tại/]
    B -->|OK| C{Đã là mặc định?}
    C -->|Có| D[/200: Không cần thay đổi - idempotent/]
    C -->|Không| E[Prisma Transaction:\nUPDATE others SET isDefault=false\nUPDATE this SET isDefault=true]
    E --> F[/200: Đặt mặc định thành công/]
    D --> Z([End])
    F --> Z
    E1 --> Z
```
