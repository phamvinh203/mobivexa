# Sequence Diagram — Luồng API
## Module: Tag
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## SD-01: Xem danh sách tag (Public)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as TagService
    participant DB as PostgreSQL

    C->>S: GET /api/tags
    S->>DB: tag.findMany ORDER BY name ASC INCLUDE _count(productTags)
    DB-->>S: Tag[] (mỗi tag có _count.productTags)
    S-->>C: 200 { tags: [...] }
```

---

## SD-02: Xem danh sách tag (Admin — cùng response)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Auth as Middleware Auth
    participant S as TagService
    participant DB as PostgreSQL

    C->>Auth: GET /api/admin/tags
    Auth-->>C: 401/403 nếu không có quyền
    Auth->>S: listTags (cùng handler với public)
    S->>DB: tag.findMany ORDER BY name ASC INCLUDE _count(productTags)
    DB-->>S: Tag[]
    S-->>C: 200 { tags: [...] }
```

> Public và Admin nhận response giống hệt nhau — chỉ khác middleware auth.

---

## SD-03: Tạo tag

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Auth as Middleware Auth
    participant V as Validator
    participant S as TagService
    participant DB as PostgreSQL

    C->>Auth: POST /api/admin/tags { name, slug? }
    Auth-->>C: 401/403 nếu không có quyền
    Auth->>V: validateCreateTag
    V-->>C: 400 nếu name rỗng / < 1 ký tự
    V->>S: createTag(name, slug?)

    S->>S: trimmed = name.trim()
    S->>DB: tag.findUnique WHERE name=trimmed
    DB-->>S: existing | null

    alt Tên đã tồn tại
        S-->>C: 409 Tag đã tồn tại
    else Tên còn trống
        S->>S: generateUniqueSlug(slug || trimmed)
        Note over S: loop slugTaken → check DB → thêm -N nếu trùng
        S->>DB: tag.create({ name: trimmed, slug: finalSlug })
        DB-->>S: Tag record
        S-->>C: 201 { message, tag }
    end
```

---

## SD-04: Xóa tag (có Cascade)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Auth as Middleware Auth
    participant S as TagService
    participant DB as PostgreSQL

    C->>Auth: DELETE /api/admin/tags/:id
    Auth-->>C: 401/403 nếu không có quyền
    Auth->>S: deleteTag(id)

    S->>DB: tag.findUnique WHERE id=?
    DB-->>S: tag | null

    alt Không tìm thấy
        S-->>C: 404 Tag không tồn tại
    else Tìm thấy
        S->>DB: tag.delete WHERE id=?
        Note over DB: onDelete: Cascade kích hoạt
        DB->>DB: DELETE FROM product_tags WHERE tagId=id
        DB-->>S: OK
        S-->>C: 200 Xóa tag thành công
    end
```

> `onDelete: Cascade` xử lý ở DB level — không cần thêm query app-level.
