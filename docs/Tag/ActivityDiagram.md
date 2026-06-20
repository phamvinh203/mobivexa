# Activity Diagram — Luồng xử lý
## Module: Tag
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## AD-01: Xem danh sách tag

```mermaid
flowchart TD
    A([Start: GET /tags hoặc GET /admin/tags]) --> B{Admin route?}
    B -->|Có| C[authenticate + authorize STAFF+]
    C -->|401/403| ERR[/401 hoặc 403/]
    C -->|OK| D[getTags]
    B -->|Không - public| D
    D --> E[prisma.tag.findMany ORDER BY name ASC INCLUDE _count productTags]
    E --> F[/200 + tags với _count/]
    ERR --> Z([End])
    F --> Z
```

---

## AD-02: Tạo tag

```mermaid
flowchart TD
    A([Start: POST /admin/tags]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401 hoặc 403/]
    B -->|OK| C[validateCreateTag]
    C -->|name rỗng / < 1 ký tự| E1[/400: Tên tag phải có ít nhất 1 ký tự/]
    C -->|OK| D[name.trim]
    D --> E[prisma.tag.findUnique WHERE name=trimmed]
    E -->|Tìm thấy| E2[/409: Tag đã tồn tại/]
    E -->|Không tìm thấy| F[generateUniqueSlug từ slug hoặc name]
    F --> G[prisma.tag.create name slug]
    G --> H[/201 + tag mới/]
    ERR0 --> Z([End])
    E1 --> Z
    E2 --> Z
    H --> Z
```

---

## AD-03: Xóa tag

```mermaid
flowchart TD
    A([Start: DELETE /admin/tags/:id]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401 hoặc 403/]
    B -->|OK| C[prisma.tag.findUnique WHERE id=?]
    C -->|Không tìm thấy| E1[/404: Tag không tồn tại/]
    C -->|OK| D[prisma.tag.delete WHERE id=?]
    D --> E[DB CASCADE: ProductTag records WHERE tagId=id bị xóa tự động]
    E --> F[/200: Xóa tag thành công/]
    ERR0 --> Z([End])
    E1 --> Z
    F --> Z
```

---

## AD-04: Sinh Slug (dùng chung với Brand/Category)

```mermaid
flowchart TD
    A([Input: name hoặc slug]) --> B[slugify: bỏ dấu, lower, giữ a-z0-9-]
    B --> C[slug = root]
    C --> D{slug tồn tại trong DB?}
    D -->|Không| E[/Return slug/]
    D -->|Có| F[slug = root + - + counter, counter++]
    F --> D
```
