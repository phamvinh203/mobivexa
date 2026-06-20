# Activity Diagram — Luồng xử lý
## Module: Category
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## AD-01: Tạo danh mục

```mermaid
flowchart TD
    A([Start: POST /admin/categories]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401 hoặc 403/]
    B -->|OK| C[uploadImage.single image - Multer]
    C --> D[validateCreateCategory]
    D -->|name < 2 ký tự| E1[/400: Tên danh mục phải có ít nhất 2 ký tự/]
    D -->|OK| E{Có parentId?}
    E -->|Có| F[assertParentExists parentId]
    F -->|parent không tồn tại| E2[/400: Danh mục cha không tồn tại/]
    F -->|OK| G[generateUniqueSlug từ slug hoặc name]
    E -->|Không| G
    G --> H{Có file image?}
    H -->|Có| I[uploadEntityImage buffer - folder categories]
    I -->|Lỗi| E3[/500/]
    I -->|OK| J[prisma.category.create với imageUrl + imagePublicId]
    H -->|Không| K[prisma.category.create imageUrl=null]
    J --> L[/201 + category mới/]
    K --> L
    ERR0 --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
    L --> Z
```

---

## AD-02: Cập nhật danh mục

```mermaid
flowchart TD
    A([Start: PUT /admin/categories/:id]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401/403/]
    B -->|OK| C[validateUpdateCategory - name optional]
    C -->|name gửi và < 2 ký tự| E1[/400/]
    C -->|OK| D[findCategoryOrThrow id]
    D -->|Không tìm thấy| E2[/404: Danh mục không tồn tại/]
    D -->|OK| E{Gửi parentId khác null?}
    E -->|Có| F{parentId = id?}
    F -->|Có| E3[/400: Danh mục không thể là cha của chính nó/]
    F -->|Không| G[assertParentExists parentId]
    G -->|Không tồn tại| E4[/400: Danh mục cha không tồn tại/]
    G -->|OK| H{Gửi slug?}
    E -->|Không| H
    H -->|Có| I[generateUniqueSlug exclude id]
    H -->|Không| J
    I --> J{Có file image mới?}
    J -->|Có| K[uploadEntityImage]
    K --> L[data.imageUrl + imagePublicId = mới]
    L --> M[destroyImage oldPublicId - background]
    M --> N[prisma.category.update data]
    J -->|Không| N
    N --> O[/200 + category đã cập nhật/]
    ERR0 --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
    E4 --> Z
    O --> Z
```

---

## AD-03: Xóa danh mục

```mermaid
flowchart TD
    A([Start: DELETE /admin/categories/:id]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401/403/]
    B -->|OK| C[findCategoryOrThrow id]
    C -->|Không tìm thấy| E1[/404: Danh mục không tồn tại/]
    C -->|OK| D[Promise.all: category.count WHERE parentId=id AND product.count WHERE categoryId=id]
    D --> E{childCount > 0?}
    E -->|Có| F[/409: Không thể xóa: danh mục còn chứa danh mục con/]
    E -->|Không| G{productCount > 0?}
    G -->|Có| H[/409: Không thể xóa: danh mục còn chứa sản phẩm/]
    G -->|Không| I[prisma.category.delete id]
    I --> J{Có imagePublicId?}
    J -->|Có| K[destroyImage imagePublicId - background]
    K --> L[/200: Xóa danh mục thành công/]
    J -->|Không| L
    ERR0 --> Z([End])
    E1 --> Z
    F --> Z
    H --> Z
    L --> Z
```

---

## AD-04: Toggle trạng thái

```mermaid
flowchart TD
    A([Start: PATCH /admin/categories/:id/status]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401/403/]
    B -->|OK| C[findCategoryOrThrow id]
    C -->|Không tìm thấy| E1[/404/]
    C -->|OK| D[prisma.category.update isActive = NOT category.isActive]
    D --> E[/200 + category với isActive mới/]
    ERR0 --> Z([End])
    E1 --> Z
    E --> Z
```

---

## AD-05: Kiểm tra parent hợp lệ (assertParentExists)

```mermaid
flowchart TD
    A([Input: parentId, selfId?]) --> B{parentId === selfId?}
    B -->|Có| E1[/400: Danh mục không thể là cha của chính nó/]
    B -->|Không| C[prisma.category.findUnique WHERE id=parentId]
    C --> D{Tìm thấy?}
    D -->|Không| E2[/400: Danh mục cha không tồn tại/]
    D -->|Có| F[/OK - continue/]
    E1 --> Z([End])
    E2 --> Z
    F --> Z
```

---

## AD-06: Xem chi tiết theo slug (Public — bao gồm children)

```mermaid
flowchart TD
    A([Start: GET /categories/:slug]) --> B[prisma.category.findUnique WHERE slug=?]
    B -->|include: children WHERE isActive=true ORDER sortOrder ASC| C{Tìm thấy?}
    C -->|Không| E1[/404: Danh mục không tồn tại/]
    C -->|Có| D[/200 + category + children/]
    E1 --> Z([End])
    D --> Z
```
