# Sequence Diagram — Luồng API
## Module: Brand
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## SD-01: Xem danh sách brand (Public)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as BrandService
    participant DB as PostgreSQL

    C->>S: GET /api/brands
    S->>DB: brand.findMany WHERE isActive=true ORDER BY name ASC
    DB-->>S: Brand[]
    S-->>C: 200 { brands: [...] }
```

---

## SD-02: Xem chi tiết brand theo slug (Public)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as BrandService
    participant DB as PostgreSQL

    C->>S: GET /api/brands/:slug
    S->>DB: brand.findUnique WHERE slug=?
    DB-->>S: brand | null
    alt Không tìm thấy
        S-->>C: 404 Thương hiệu không tồn tại
    else Tìm thấy
        S-->>C: 200 { brand }
    end
```

---

## SD-03: Tạo thương hiệu

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Auth as Middleware Auth
    participant Multer as Multer
    participant V as Validator
    participant S as BrandService
    participant CDN as Cloudinary
    participant DB as PostgreSQL

    C->>Auth: POST /api/admin/brands (multipart)
    Auth-->>C: 401/403 (nếu không có quyền)
    Auth->>Multer: parse file logo
    Multer->>V: validateCreateBrand
    V-->>C: 400 (name < 2 ký tự)
    V->>S: createBrand(body, file)
    S->>DB: brand.findUnique WHERE name=trimmedName
    DB-->>S: existing | null
    alt Tên đã tồn tại
        S-->>C: 409 Tên thương hiệu đã tồn tại
    else Tên còn trống
        S->>S: generateUniqueSlug(slug || name)
        Note over S: Loop: slugify → check DB → thêm -N nếu trùng
        alt Có file logo
            S->>CDN: uploadEntityImage(buffer, 'brands')
            CDN-->>S: { url, publicId }
        end
        S->>DB: brand.create({ name, slug, description, isActive, logoUrl?, logoPublicId? })
        DB-->>S: Brand record
        S-->>C: 201 { message, brand }
    end
```

---

## SD-04: Cập nhật thương hiệu (có logo mới)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Auth as Middleware Auth
    participant S as BrandService
    participant CDN as Cloudinary
    participant DB as PostgreSQL

    C->>Auth: PUT /api/admin/brands/:id (multipart)
    Auth-->>C: 401/403
    Auth->>S: updateBrand(id, body, file)
    S->>DB: brand.findUnique WHERE id=?
    DB-->>S: brand | null
    alt Không tìm thấy
        S-->>C: 404 Thương hiệu không tồn tại
    else Tìm thấy
        opt Gửi name
            S->>DB: brand.findUnique WHERE name=? AND id!=brandId
            DB-->>S: conflict | null
            alt Tên trùng
                S-->>C: 409 Tên thương hiệu đã tồn tại
            end
        end
        opt Gửi slug
            S->>S: generateUniqueSlug(slug, excludeId=id)
        end
        opt Có file logo mới
            S->>CDN: uploadEntityImage(buffer, 'brands')
            CDN-->>S: { url: newUrl, publicId: newPid }
            S->>CDN: destroyImage(brand.logoPublicId) [background, non-blocking]
        end
        S->>DB: brand.update({ id, ...data })
        DB-->>S: Updated brand
        S-->>C: 200 { message, brand }
    end
```

---

## SD-05: Xóa thương hiệu

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Auth as Middleware Auth
    participant S as BrandService
    participant CDN as Cloudinary
    participant DB as PostgreSQL

    C->>Auth: DELETE /api/admin/brands/:id
    Auth-->>C: 401/403
    Auth->>S: deleteBrand(id)
    S->>DB: brand.findUnique WHERE id=?
    DB-->>S: brand | null
    alt Không tìm thấy
        S-->>C: 404 Thương hiệu không tồn tại
    else Tìm thấy
        S->>DB: product.count WHERE brandId=id
        DB-->>S: count
        alt count > 0
            S-->>C: 409 Không thể xóa: thương hiệu còn chứa sản phẩm
        else count = 0
            S->>DB: brand.delete WHERE id=?
            DB-->>S: OK
            opt brand có logoPublicId
                S->>CDN: destroyImage(logoPublicId) [background]
            end
            S-->>C: 200 Xóa thương hiệu thành công
        end
    end
```

---

## SD-06: Toggle trạng thái

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as BrandService
    participant DB as PostgreSQL

    C->>S: PATCH /api/admin/brands/:id/status
    S->>DB: brand.findUnique WHERE id=?
    DB-->>S: brand | null
    alt Không tìm thấy
        S-->>C: 404
    else Tìm thấy
        S->>DB: brand.update SET isActive = NOT brand.isActive
        DB-->>S: Updated brand
        S-->>C: 200 { message, brand }
    end
```
