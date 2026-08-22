# Sequence Diagram — Luồng API
## Module: Product
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Listing sản phẩm public (với search)

```mermaid
sequenceDiagram
    participant C as Client
    participant S as product.service
    participant DB as Database

    C->>S: GET /products?search=iphone&minPrice=10000000
    S->>S: parsePriceParam(minPrice, maxPrice)
    S->>DB: $queryRaw — to_tsvector FTS trên products.name
    DB-->>S: [{id}, ...]
    S->>DB: Promise.all — findMany + count WHERE id IN [...]
    DB-->>S: products[], total
    S-->>C: 200 {products, pagination}
```

---

## 2. Tạo sản phẩm (multipart/form-data)

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as Multer + Validator
    participant S as product.service
    participant DB as Database
    participant CDN as Cloudinary

    C->>MW: POST /admin/products (multipart) files + body
    MW->>MW: parseJsonField(variants, tagIds, specs)
    MW->>MW: checkVariant for each variant
    MW-->>S: body + files

    S->>DB: Promise.all [assertCategory, assertBrand, assertTags, assertSkusAvailable]
    alt lỗi
        DB-->>C: 400/409
    end
    S->>S: generateUniqueSlug(slug || name)
    S->>CDN: uploadEntityImage parallel (nếu có files)
    CDN-->>S: [{url, publicId}, ...]
    S->>DB: product.create {variants, specs, tags, images}
    DB-->>S: product + PRODUCT_DETAIL_INCLUDE
    S-->>C: 201 product
```

---

## 3. Cập nhật sản phẩm với tags

```mermaid
sequenceDiagram
    participant C as Client
    participant S as product.service
    participant DB as Database

    C->>S: PUT /admin/products/:id {tagIds: [...]}
    S->>DB: findProductOrThrow(id)
    alt không tồn tại
        DB-->>C: 404
    end
    S->>DB: assertTags([...])
    S->>DB: Transaction
    Note over DB: productTag.deleteMany WHERE productId<br/>productTag.createMany<br/>product.update
    DB-->>S: updated product
    S-->>C: 200 product
```

---

## 4. Xóa ảnh cover → auto-set cover tiếp theo

```mermaid
sequenceDiagram
    participant C as Client
    participant S as product.service
    participant DB as Database
    participant CDN as Cloudinary

    C->>S: DELETE /admin/products/:id/images/:imageId
    S->>DB: productImage.findUnique WHERE id
    alt !image || image.productId !== productId
        S-->>C: 404
    end
    S->>DB: productImage.delete WHERE id
    S->>CDN: destroyImage(publicId) — async fire-and-forget
    alt image.isCover
        S->>DB: productImage.findFirst WHERE productId orderBy sortOrder ASC
        alt có ảnh tiếp theo
            S->>DB: productImage.update {isCover: true}
        end
    end
    S-->>C: 200
```

---

## 5. Cập nhật tồn kho (optimistic lock)

```mermaid
sequenceDiagram
    participant C as Client
    participant S as product.service
    participant DB as Database

    C->>S: PATCH /variants/:variantId/stock {stock: 10, expectedStock: 15}
    S->>DB: findOwnedVariant(productId, variantId)
    alt không tìm thấy
        S-->>C: 404
    end
    alt variant.stock !== expectedStock (15 ≠ 15)
        S-->>C: 409 Tồn kho đã thay đổi (hiện tại X)
    end
    S->>DB: productVariant.update {stock: 10}
    S-->>C: 200 variant
```

---

## 6. Thay thế specs (replace-all transaction)

```mermaid
sequenceDiagram
    participant C as Client
    participant S as product.service
    participant DB as Database

    C->>S: PUT /admin/products/:id/specs {specs: [{label, value}, ...]}
    S->>DB: findProductOrThrow(id)
    S->>DB: $transaction
    Note over DB: productSpec.deleteMany WHERE productId<br/>productSpec.createMany (nếu specs.length > 0)<br/>productSpec.findMany ORDER BY sortOrder
    DB-->>S: specs[]
    S-->>C: 200 specs[]
```

---

## 7. Inventory report (với cache)

```mermaid
sequenceDiagram
    participant C as Client
    participant S as product.service
    participant Cache as In-memory cache
    participant DB as Database

    C->>S: GET /admin/inventory?stockStatus=low_stock&lowThreshold=5
    S->>Cache: getInventorySummary(threshold=5)
    alt cache hit (< 60s và cùng threshold)
        Cache-->>S: summary cached
    else cache miss
        S->>DB: Promise.all [aggregate, count outOfStock, count lowStock]
        DB-->>S: summary
        S->>Cache: set cache (expiresAt = now+60s)
    end
    S->>DB: Promise.all [findMany variants (filtered), count]
    DB-->>S: variants[], total
    S-->>C: 200 {variants, summary {+inStock}, pagination}
```
