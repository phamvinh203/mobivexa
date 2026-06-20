# Sequence Diagram — Luồng API
## Module: Banner
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## SD-01: Xem danh sách banner (Public — có filter position)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as BannerService
    participant DB as PostgreSQL

    C->>S: GET /api/banners?position=HERO
    S->>DB: banner.findMany WHERE isActive=true AND position=HERO ORDER BY sortOrder ASC, createdAt DESC
    DB-->>S: Banner[]
    S-->>C: 200 { banners: [...] }
```

---

## SD-02: Xem danh sách vị trí (Static — không query DB)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Ctrl as Controller

    C->>Ctrl: GET /api/banners/positions
    Note over Ctrl: Không gọi DB — trả static enum BANNER_POSITIONS với BANNER_POSITION_LABEL
    Ctrl-->>C: 200 { positions: [{ value, label }, ...] }
```

---

## SD-03: Tạo banner (có rollback Cloudinary)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Auth as Middleware Auth
    participant V as Validator
    participant S as BannerService
    participant CDN as Cloudinary
    participant DB as PostgreSQL

    C->>Auth: POST /api/admin/banners (multipart)
    Auth-->>C: 401/403 nếu không có quyền
    Auth->>V: validateCreateBanner
    V-->>C: 400 nếu thiếu file / alt ngắn / position sai
    V->>S: createBanner(body, file)

    S->>CDN: uploadEntityImage(file.buffer, 'banners')
    CDN-->>S: { url, publicId }

    S->>DB: banner.create({ imageUrl, imagePublicId, alt, href, position, isActive, sortOrder })

    alt DB thành công
        DB-->>S: Banner record
        S-->>C: 201 { message, banner }
    else DB thất bại
        DB-->>S: Error
        Note over S: catch block — ROLLBACK
        S->>CDN: destroyImage(image.publicId) [đồng bộ trong catch]
        S-->>C: 500 Lỗi server
    end
```

> `destroyImage` trong `catch` là **đồng bộ** — đảm bảo rollback trước khi rethrow lỗi.

---

## SD-04: Cập nhật banner (đổi ảnh)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as BannerService
    participant CDN as Cloudinary
    participant DB as PostgreSQL

    C->>S: PUT /api/admin/banners/:id (multipart)
    S->>DB: banner.findUnique WHERE id=?
    DB-->>S: banner | null

    alt Không tìm thấy
        S-->>C: 404 Banner không tồn tại
    else Tìm thấy
        opt Có file ảnh mới
            S->>CDN: uploadEntityImage(buffer, 'banners')
            CDN-->>S: { url: newUrl, publicId: newPid }
            S->>CDN: destroyImage(banner.imagePublicId) [background]
        end
        S->>DB: banner.update({ id, ...data })
        DB-->>S: Updated banner
        S-->>C: 200 { message, banner }
    end
```

---

## SD-05: Xóa banner

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as BannerService
    participant CDN as Cloudinary
    participant DB as PostgreSQL

    C->>S: DELETE /api/admin/banners/:id
    S->>DB: banner.findUnique WHERE id=?
    DB-->>S: banner | null

    alt Không tìm thấy
        S-->>C: 404 Banner không tồn tại
    else Tìm thấy
        S->>DB: banner.delete WHERE id=?
        DB-->>S: OK
        S->>CDN: destroyImage(banner.imagePublicId) [background]
        S-->>C: 200 Xóa banner thành công
    end
```

---

## SD-06: Toggle trạng thái

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as BannerService
    participant DB as PostgreSQL

    C->>S: PATCH /api/admin/banners/:id/status
    S->>DB: banner.findUnique WHERE id=?
    DB-->>S: banner | null

    alt Không tìm thấy
        S-->>C: 404
    else Tìm thấy
        S->>DB: banner.update SET isActive = NOT banner.isActive
        DB-->>S: Updated banner
        S-->>C: 200 { message, banner }
    end
```
