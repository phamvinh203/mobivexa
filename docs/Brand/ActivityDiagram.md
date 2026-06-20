# Activity Diagram — Luồng xử lý
## Module: Brand
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19

---

## AD-01: Tạo thương hiệu

```mermaid
flowchart TD
    A([Start: POST /admin/brands]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401 hoặc 403/]
    B -->|OK| C[uploadImage.single logo - Multer parse file]
    C --> D[validateCreateBrand]
    D -->|name < 2 ký tự| E1[/400: Tên thương hiệu phải có ít nhất 2 ký tự/]
    D -->|OK| F[assertNameAvailable - trim name]
    F -->|Tên đã tồn tại| E2[/409: Tên thương hiệu đã tồn tại/]
    F -->|OK| G[generateUniqueSlug từ slug hoặc name]
    G --> H{Có file logo?}
    H -->|Có| I[uploadEntityImage buffer - folder brands]
    I -->|Lỗi Cloudinary| E3[/500: Lỗi upload/]
    I -->|OK| J[prisma.brand.create với logoUrl + logoPublicId]
    H -->|Không| K[prisma.brand.create logoUrl=null]
    J --> L[/201 + brand mới/]
    K --> L
    ERR0 --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
    L --> Z
```

---

## AD-02: Cập nhật thương hiệu

```mermaid
flowchart TD
    A([Start: PUT /admin/brands/:id]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401/403/]
    B -->|OK| C[validateUpdateBrand - name optional]
    C -->|name gửi và < 2 ký tự| E1[/400/]
    C -->|OK| D[findBrandOrThrow id]
    D -->|Không tìm thấy| E2[/404: Thương hiệu không tồn tại/]
    D -->|OK| E{Gửi name?}
    E -->|Có| F[assertNameAvailable - exclude brandId]
    F -->|Trùng brand khác| E3[/409: Tên thương hiệu đã tồn tại/]
    F -->|OK| G{Gửi slug?}
    E -->|Không| G
    G -->|Có| H[generateUniqueSlug - exclude brandId]
    G -->|Không| I
    H --> I{Có file logo mới?}
    I -->|Có| J[uploadEntityImage buffer - folder brands]
    J --> K[data.logoUrl = mới\ndata.logoPublicId = mới]
    K --> L[destroyImage oldPublicId - background]
    L --> M[prisma.brand.update data]
    I -->|Không| M
    M --> N[/200 + brand đã cập nhật/]
    ERR0 --> Z([End])
    E1 --> Z
    E2 --> Z
    E3 --> Z
    N --> Z
```

---

## AD-03: Xóa thương hiệu

```mermaid
flowchart TD
    A([Start: DELETE /admin/brands/:id]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401/403/]
    B -->|OK| C[findBrandOrThrow id]
    C -->|Không tìm thấy| E1[/404: Thương hiệu không tồn tại/]
    C -->|OK| D[prisma.product.count WHERE brandId=id]
    D -->|count > 0| E2[/409: Không thể xóa: thương hiệu còn chứa sản phẩm/]
    D -->|count = 0| E[prisma.brand.delete id]
    E --> F{Brand có logoPublicId?}
    F -->|Có| G[destroyImage logoPublicId - background]
    G --> H[/200: Xóa thương hiệu thành công/]
    F -->|Không| H
    ERR0 --> Z([End])
    E1 --> Z
    E2 --> Z
    H --> Z
```

---

## AD-04: Toggle trạng thái

```mermaid
flowchart TD
    A([Start: PATCH /admin/brands/:id/status]) --> B[authenticate + authorize STAFF+]
    B -->|401/403| ERR0[/401/403/]
    B -->|OK| C[findBrandOrThrow id]
    C -->|Không tìm thấy| E1[/404: Thương hiệu không tồn tại/]
    C -->|OK brand| D[prisma.brand.update isActive = NOT brand.isActive]
    D --> E[/200 + brand với isActive mới/]
    ERR0 --> Z([End])
    E1 --> Z
    E --> Z
```

---

## AD-05: Sinh Slug duy nhất

```mermaid
flowchart TD
    A([Input: base string]) --> B[slugify: bỏ dấu, lower, chỉ giữ a-z0-9-]
    B --> C[slug = root]
    C --> D{slugTaken - slug đã tồn tại trong DB?}
    D -->|Không| E[/Return slug/]
    D -->|Có| F[slug = root + - + counter\ncounter++]
    F --> D
```

> Vòng lặp chạy đến khi tìm được slug unique. Không có hard limit nhưng thực tế hiếm khi vượt quá 3-4 lần.
