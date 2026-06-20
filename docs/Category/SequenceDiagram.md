# Sequence Diagram — Luồng API
## Module: Category
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## SD-01: Xem danh sách danh mục (Public)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as CategoryService
    participant DB as PostgreSQL

    C->>S: GET /api/categories
    S->>DB: category.findMany WHERE isActive=true ORDER BY sortOrder ASC, name ASC
    DB-->>S: Category[]
    S-->>C: 200 { categories: [...] }
```

---

## SD-02: Xem chi tiết danh mục theo slug (có children)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as CategoryService
    participant DB as PostgreSQL

    C->>S: GET /api/categories/:slug
    S->>DB: category.findUnique WHERE slug=? INCLUDE children WHERE isActive=true ORDER sortOrder
    DB-->>S: category (+ children[]) | null
    alt Không tìm thấy
        S-->>C: 404 Danh mục không tồn tại
    else Tìm thấy
        S-->>C: 200 { category, children: [...] }
    end
```

---

## SD-03: Tạo danh mục

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Auth as Middleware Auth
    participant Multer as Multer
    participant V as Validator
    participant S as CategoryService
    participant CDN as Cloudinary
    participant DB as PostgreSQL

    C->>Auth: POST /api/admin/categories (multipart)
    Auth-->>C: 401/403 nếu không có quyền
    Auth->>Multer: parse file image
    Multer->>V: validateCreateCategory
    V-->>C: 400 (name < 2 ký tự)
    V->>S: createCategory(body, file)

    opt Có parentId
        S->>DB: category.findUnique WHERE id=parentId
        DB-->>S: parent | null
        alt parent không tồn tại
            S-->>C: 400 Danh mục cha không tồn tại
        end
    end

    S->>S: generateUniqueSlug(slug || name)
    Note over S: slugTaken loop — check DB mỗi vòng

    opt Có file image
        S->>CDN: uploadEntityImage(buffer, 'categories')
        CDN-->>S: { url, publicId }
    end

    S->>DB: category.create({ name, slug, description, parentId, sortOrder, isActive, imageUrl? })
    DB-->>S: Category record
    S-->>C: 201 { message, category }
```

---

## SD-04: Cập nhật danh mục

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as CategoryService
    participant CDN as Cloudinary
    participant DB as PostgreSQL

    C->>S: PUT /api/admin/categories/:id (multipart)
    S->>DB: category.findUnique WHERE id=?
    DB-->>S: category | null
    alt Không tìm thấy
        S-->>C: 404 Danh mục không tồn tại
    else Tìm thấy
        opt Gửi parentId không null
            alt parentId === id (self-reference)
                S-->>C: 400 Danh mục không thể là cha của chính nó
            else
                S->>DB: category.findUnique WHERE id=parentId
                DB-->>S: parent | null
                alt Không tồn tại
                    S-->>C: 400 Danh mục cha không tồn tại
                end
            end
        end
        opt Gửi slug
            S->>S: generateUniqueSlug(slug, excludeId=id)
        end
        opt Có file image mới
            S->>CDN: uploadEntityImage(buffer, 'categories')
            CDN-->>S: { url: newUrl, publicId: newPid }
            S->>CDN: destroyImage(category.imagePublicId) [background]
        end
        S->>DB: category.update({ id, ...data })
        DB-->>S: Updated category
        S-->>C: 200 { message, category }
    end
```

---

## SD-05: Xóa danh mục

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as CategoryService
    participant CDN as Cloudinary
    participant DB as PostgreSQL

    C->>S: DELETE /api/admin/categories/:id
    S->>DB: category.findUnique WHERE id=?
    DB-->>S: category | null
    alt Không tìm thấy
        S-->>C: 404 Danh mục không tồn tại
    else Tìm thấy
        par Check parallel
            S->>DB: category.count WHERE parentId=id
            DB-->>S: childCount
        and
            S->>DB: product.count WHERE categoryId=id
            DB-->>S: productCount
        end
        alt childCount > 0
            S-->>C: 409 Không thể xóa: danh mục còn chứa danh mục con
        else productCount > 0
            S-->>C: 409 Không thể xóa: danh mục còn chứa sản phẩm
        else Không vướng
            S->>DB: category.delete WHERE id=?
            DB-->>S: OK
            opt Có imagePublicId
                S->>CDN: destroyImage(imagePublicId) [background]
            end
            S-->>C: 200 Xóa danh mục thành công
        end
    end
```

---

## SD-06: Toggle trạng thái

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as CategoryService
    participant DB as PostgreSQL

    C->>S: PATCH /api/admin/categories/:id/status
    S->>DB: category.findUnique WHERE id=?
    DB-->>S: category | null
    alt Không tìm thấy
        S-->>C: 404
    else Tìm thấy
        S->>DB: category.update SET isActive = NOT category.isActive
        DB-->>S: Updated category
        S-->>C: 200 { message, category }
    end
```
