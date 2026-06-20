# Activity Diagram — Luồng xử lý
## Module: Banner
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## AD-01: Tạo banner (có rollback Cloudinary)

```mermaid
flowchart TD
    A([Start: POST /admin/banners]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401 hoặc 403/]
    B -->|OK| C[Multer parse file image]
    C --> D[validateCreateBanner]
    D -->|Không có file| E1[/400: Ảnh banner là bắt buộc/]
    D -->|alt < 2 ký tự| E2[/400: Alt text phải có ít nhất 2 ký tự/]
    D -->|position thiếu| E3[/400: Vị trí banner là bắt buộc/]
    D -->|position sai enum| E4[/400: Vị trí banner không hợp lệ/]
    D -->|OK| F[uploadEntityImage buffer - folder banners]
    F -->|Lỗi upload| E5[/500/]
    F -->|OK - image.url + publicId| G[prisma.banner.create data]
    G -->|DB OK| H[/201 + banner mới/]
    G -->|DB FAIL| I[catch: destroyImage image.publicId - đồng bộ]
    I --> J[/500: Lỗi server/]
    ERR0 --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
    E4 --> Z
    E5 --> Z
    H --> Z
    J --> Z
```

> Khác Brand/Category: Banner có **rollback đồng bộ** trong `catch` khi DB fail sau upload.

---

## AD-02: Cập nhật banner

```mermaid
flowchart TD
    A([Start: PUT /admin/banners/:id]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401/403/]
    B -->|OK| C[validateUpdateBanner - alt và position optional]
    C -->|alt gửi < 2 ký tự| E1[/400/]
    C -->|position gửi sai enum| E2[/400/]
    C -->|OK| D[findBannerOrThrow id]
    D -->|Không tìm thấy| E3[/404: Banner không tồn tại/]
    D -->|OK| E[Build data object từ trường được gửi]
    E --> F{href gửi rỗng?}
    F -->|Có| G[data.href = /products]
    F -->|Không| H
    G --> H{Có file image mới?}
    H -->|Có| I[uploadEntityImage buffer - banners]
    I --> J[data.imageUrl = mới, data.imagePublicId = mới]
    J --> K[destroyImage oldPublicId - background]
    K --> L[prisma.banner.update data]
    H -->|Không| L
    L --> M[/200 + banner đã cập nhật/]
    ERR0 --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
    M --> Z
```

---

## AD-03: Xóa banner

```mermaid
flowchart TD
    A([Start: DELETE /admin/banners/:id]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401/403/]
    B -->|OK| C[findBannerOrThrow id]
    C -->|Không tìm thấy| E1[/404: Banner không tồn tại/]
    C -->|OK| D[prisma.banner.delete id]
    D --> E[destroyImage imagePublicId - background]
    E --> F[/200: Xóa banner thành công/]
    ERR0 --> Z([End])
    E1 --> Z
    F --> Z
```

---

## AD-04: Toggle trạng thái

```mermaid
flowchart TD
    A([Start: PATCH /admin/banners/:id/status]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401/403/]
    B -->|OK| C[findBannerOrThrow id]
    C -->|Không tìm thấy| E1[/404/]
    C -->|OK| D[prisma.banner.update isActive = NOT banner.isActive]
    D --> E[/200 + banner với isActive mới/]
    ERR0 --> Z([End])
    E1 --> Z
    E --> Z
```

---

## AD-05: Xem danh sách banner (Public — lọc theo position)

```mermaid
flowchart TD
    A([Start: GET /banners]) --> B{Query param position?}
    B -->|Có| C[WHERE isActive=true AND position=?]
    B -->|Không| D[WHERE isActive=true]
    C --> E[ORDER BY sortOrder ASC, createdAt DESC]
    D --> E
    E --> F[/200 + banners/]
    F --> Z([End])
```

---

## AD-06: Validate position enum

```mermaid
flowchart TD
    A([Input: position, optional]) --> B{position === undefined?}
    B -->|Có và optional=true| C[/return OK/]
    B -->|Có và optional=false| D[/400: Vị trí banner là bắt buộc/]
    B -->|Không| E{Nằm trong HERO, LEFT, RIGHT, HORIZONTAL?}
    E -->|Có| F[/return OK/]
    E -->|Không| G[/400: Vị trí banner không hợp lệ/]
    C --> Z([End])
    D --> Z
    F --> Z
    G --> Z
```
