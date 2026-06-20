# Activity Diagram — Luồng xử lý
## Module: Product (Sản phẩm)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Ghi chú:** Sử dụng cú pháp Mermaid — render trên GitHub, GitLab, Obsidian, VSCode (Markdown Preview Mermaid)

---

## AD-01: Danh sách sản phẩm (Public)

```mermaid
flowchart TD
    A([Start: Guest/Customer gửi GET /api/products]) --> B[Parse query params]
    B --> C{Check Redis cache}
    C -->|Cache hit| H[/Trả về cached response/]
    C -->|Cache miss| D[Build where clause]
    D --> E[Query PostgreSQL với pagination]
    E --> F[Filter: isActive = true]
    F --> G[Include variants active + ảnh bìa]
    G --> I[Cache result - TTL 5 phút]
    I --> J[/Trả về 200 + products + pagination/]
    H --> Z([End])
    J --> Z
```

---

## AD-02: Chi tiết sản phẩm (Public - theo slug)

```mermaid
flowchart TD
    A([Start: Guest/Customer gửi GET /api/products/:slug]) --> B{Check Redis cache}
    B -->|Cache hit| E[/Trả về cached response/]
    B -->|Cache miss| C[Find product by slug]
    C -->|Không tồn tại| E1[/Trả về 404 - Sản phẩm không tồn tại/]
    C -->|Tồn tại| D{isActive = true?}
    D -->|false| E1
    D -->|true| F[Include: category, brand, tags, variants active, images]
    F --> G[Sort variants by salePrice ASC]
    G --> H[Sort images by sortOrder ASC]
    H --> I[Cache result - TTL 5 phút]
    I --> J[/Trả về 200 + product full detail/]
    E --> Z([End])
    E1 --> Z
    J --> Z
```

---

## AD-03: Tạo sản phẩm (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi POST /api/admin/products]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Parse form-data: variants + tagIds từ JSON]
    C --> D[Validate: name ≥ 2, categoryId, brandId, variants ≥ 1]
    D -->|Validation fail| E2[/Trả về 400 + message lỗi/]
    D -->|Validation pass| F{Check song song}
    F --> G[Category tồn tại?]
    F --> H[Brand tồn tại?]
    F --> I[Tags tồn tại?]
    F --> J[SKUs unique?]
    G -->|Không| E3[/Trả về 400 - Category không tồn tại/]
    H -->|Không| E4[/Trả về 400 - Brand không tồn tại/]
    I -->|Không| E5[/Trả về 400 - Tag không tồn tại/]
    J -->|Trùng| E6[/Trả về 409 - SKU đã tồn tại/]
    G -->|Có| K[Sinh slug duy nhất]
    H -->|Có| K
    I -->|Có| K
    J -->|Unique| K
    K --> L[Upload tất cả ảnh song song lên Cloudinary]
    L -->|Upload fail| E7[/Trả về 500 - Không thể upload ảnh/]
    L -->|Upload success| M[Tạo Product + Variants + Tags + Images - transaction]
    M --> N[Bust toàn bộ cache: list + featured]
    N --> O[/Trả về 201 + product full detail/]
    E1 --> Z([End])
    E2 --> Z
    E3 --> Z
    E4 --> Z
    E5 --> Z
    E6 --> Z
    E7 --> Z
    O --> Z
```

---

## AD-04: Cập nhật sản phẩm (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi PUT /api/admin/products/:id]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Find product by ID]
    C -->|Không tồn tại| E2[/Trả về 404/]
    C -->|Tồn tại| D[Parse form-data: variants + tagIds từ JSON nếu có]
    D --> E{Có file ảnh mới?}
    E -->|Có| F[Upload song song lên Cloudinary]
    E -->|Không| H{Có tagIds?}
    F -->|Upload fail| E3[/Trả về 500/]
    F -->|Upload success| G[Thêm vào sau ảnh hiện có]
    G --> H
    H -->|Có| I[Transaction: xóa hết tag cũ → tạo lại tag mới]
    H -->|Không| J[Partial update các field được gửi]
    I --> J
    J --> K[Bust cache: list + slug]
    K --> L[/Trả về 200 + product full detail/]
    E1 --> Z([End])
    E2 --> Z
    E3 --> Z
    L --> Z
```

---

## AD-05: Xóa sản phẩm (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi DELETE /api/admin/products/:id]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Song song: lấy images + slug]
    C --> D[Xóa product khỏi DB - cascade]
    D --> E[Xóa tất cả ảnh trên Cloudinary - nền]
    E --> F[Bust cache: list + featured + slug]
    F --> G[/Trả về 200 + message/]
    E1 --> Z([End])
    G --> Z
```

---

## AD-06: Thêm variant vào sản phẩm (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi POST /api/admin/products/:id/variants]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Find product by ID]
    C -->|Không tồn tại| E2[/Trả về 404/]
    C -->|Tồn tại| D[Validate variant: sku unique, salePrice ≤ originalPrice]
    D -->|Validation fail| E3[/Trả về 400/]
    D -->|SKU trùng DB| E4[/Trả về 409 - SKU đã tồn tại/]
    D -->|Validation pass| E[Tạo variant với isActive=true, stock=0 nếu không gửi]
    E --> F[Bust cache: list + slug]
    F --> G[/Trả về 201 + variant object/]
    E1 --> Z([End])
    E2 --> Z
    E3 --> Z
    E4 --> Z
    G --> Z
```

---

## AD-07: Xóa variant (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi DELETE /api/admin/products/:id/variants/:variantId]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Kiểm tra variant thuộc product]
    C -->|Không thuộc| E2[/Trả về 404/]
    C -->|Thuộc| D[Đếm tổng số variant của product]
    D --> E{Chỉ còn 1 variant?}
    E -->|Có| E3[/Trả về 409 - Không thể xóa variant cuối/]
    E -->|Có ≥ 2| F[Xóa variant]
    F --> G[Bust cache: list + slug]
    G --> H[/Trả về 200 + message/]
    E1 --> Z([End])
    E2 --> Z
    E3 --> Z
    H --> Z
```

---

## AD-08: Cập nhật tồn kho nhanh (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi PATCH /api/admin/products/:id/variants/:variantId/stock]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Validate: stock là số nguyên ≥ 0]
    C -->|Validation fail| E2[/Trả về 400 - Tồn kho phải là số nguyên không âm/]
    C -->|Validation pass| D[Update chỉ trường stock]
    D --> E[Bust cache: list + slug]
    E --> F[/Trả về 200 + variant object/]
    E1 --> Z([End])
    E2 --> Z
    F --> Z
```

---

## AD-09: Thêm ảnh vào sản phẩm (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi POST /api/admin/products/:id/images]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Find product by ID]
    C -->|Không tồn tại| E2[/Trả về 404/]
    C -->|Tồn tại| D[Upload song song tất cả ảnh lên Cloudinary]
    D -->|Upload fail| E3[/Trả về 500/]
    D -->|Upload success| E{Tạo ProductImage records}
    E --> F[sortOrder = existingCount + i]
    E --> G{Product chưa có ảnh?}
    G -->|Có| H[Ảnh đầu tiên: isCover = true]
    G -->|Không| I[isCover = false]
    H --> J[Bust cache: list + slug]
    I --> J
    J --> K[/Trả về 201 + images array/]
    E1 --> Z([End])
    E2 --> Z
    E3 --> Z
    K --> Z
```

---

## AD-10: Xóa ảnh khỏi sản phẩm (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi DELETE /api/admin/products/:id/images/:imageId]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Kiểm tra ảnh thuộc product]
    C -->|Không thuộc| E2[/Trả về 404/]
    C -->|Thuộc| D[Xóa ảnh khỏi DB]
    D --> E{Ảnh bị xóa là isCover?}
    E -->|Có| F[Tìm ảnh kế tiếp sortOrder ASC]
    E -->|Không| H[Xóa trên Cloudinary - nền]
    F --> G[Set ảnh kế tiếp làm bìa mới]
    G --> H
    H --> I[Bust cache: list + slug]
    I --> J[/Trả về 200 + message/]
    E1 --> Z([End])
    E2 --> Z
    J --> Z
```

---

## AD-11: Đặt ảnh bìa (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi PATCH /api/admin/products/:id/images/:imageId/cover]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Kiểm tra ảnh thuộc product]
    C -->|Không thuộc| E2[/Trả về 404/]
    C -->|Thuộc| D[Atomic transaction]
    D --> E[Bỏ isCover tất cả ảnh của product]
    E --> F[Set isCover = true cho ảnh được chọn]
    F --> G[Bust cache: list + slug]
    G --> H[/Trả về 200 + images array/]
    E1 --> Z([End])
    E2 --> Z
    H --> Z
```

---

## AD-12: Báo cáo tồn kho (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi GET /api/admin/inventory]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C{Check in-memory cache - TTL 60s}
    C -->|Cache hit| D[/Trả về cached summary/]
    C -->|Cache miss| F[Calculate summary]
    F --> G[totalVariants, totalStock, outOfStock, lowStock, inStock]
    G --> H[Cache summary - 60s TTL]
    H --> I[Query variants theo filter]
    I --> J[Sort by stock ASC - hết hàng lên đầu]
    J --> K[/Trả về 200 + variants + summary + pagination/]
    E1 --> Z([End])
    D --> L([End cho summary])
    K --> Z
```

---

## AD-13: Bật/tắt hiển thị sản phẩm (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi PATCH /api/admin/products/:id/status]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Find product by ID]
    C -->|Không tồn tại| E2[/Trả về 404/]
    C -->|Tồn tại| D[Update isActive]
    D --> E[Bust cache: list + featured]
    E --> F[/Trả về 200 + product object/]
    E1 --> Z([End])
    E2 --> Z
    F --> Z
```

---

## AD-14: Bật/tắt nổi bật sản phẩm (Admin)

```mermaid
flowchart TD
    A([Start: Admin gửi PATCH /api/admin/products/:id/featured]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Find product by ID]
    C -->|Không tồn tại| E2[/Trả về 404/]
    C -->|Tồn tại| D[Update isFeatured]
    D --> E[Bust cache: list + featured]
    E --> F[/Trả về 200 + product object/]
    E1 --> Z([End])
    E2 --> Z
    F --> Z
```

---

## AD-15: Full-text Search (Public)

```mermaid
flowchart TD
    A([Start: Guest/Customer gửi GET /api/products?search=keyword]) --> B[Parse search query]
    B --> C{Check Redis cache}
    C -->|Cache hit| E[/Trả về cached results/]
    C -->|Cache miss| D[PostgreSQL Full-text Search - GIN index]
    D --> F[Apply filter: category, brand, tag, price range]
    F --> G[Sort theo chosen: newest/oldest/name_asc/name_desc]
    G --> H[Paginate results]
    H --> I[Cache result - TTL 5 phút]
    I --> J[/Trả về 200 + products + pagination/]
    E --> Z([End])
    J --> Z
```

---

## AD-16: Cache Bust Flow

```mermaid
flowchart TD
    A([Start: Product/Variant/Image thay đổi]) --> B{Loại thay đổi?}
    B -->|Tạo/Xóa sản phẩm| C[Bust: products:list:* + products:featured:*]
    B -->|Cập nhật sản phẩm| D[Bust: products:list:* + products:slug:slug]
    B -->|Thay đổi variant giá/stock/isActive| E[Bust: products:list:* + products:slug:slug]
    B -->|Thêm/xóa ảnh| F[Bust: products:list:* + products:slug:slug]
    B -->|Toggle isFeatured| G[Bust: products:featured:*]
    
    C --> H[Redis SCAN pattern match]
    D --> H
    E --> H
    F --> H
    G --> H
    
    H --> I[Delete all matching keys]
    I --> J([Cache bust complete])
```

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Total Diagrams:** 16  
> **Next Review:** After implementation complete
