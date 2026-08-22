# Activity Diagram — Luồng xử lý
## Module: Product
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Listing sản phẩm (public)

```mermaid
flowchart TD
    A([GET /products]) --> B{search param?}
    B -- Có --> C[toTsQuery — FTS GIN index]
    C --> D{Kết quả?}
    D -- Rỗng --> Z1[Trả products=[] pagination]
    D -- Có --> E[where.id = in ids]
    B -- Không --> E2[where = isActive:true]
    E --> F[Áp filter: category/brand/tag/price]
    E2 --> F
    F --> G{minPrice & maxPrice?}
    G -- minPrice > maxPrice --> ERR1[400]
    G -- OK --> H[parsePriceParam validate]
    H --> I[Promise.all: findMany + count]
    I --> J[200 products + pagination]
```

---

## 2. Tạo sản phẩm (admin)

```mermaid
flowchart TD
    A([POST /admin/products]) --> B[validateCreateProduct — parse JSON fields]
    B --> C{Hợp lệ?}
    C -- Không --> ERR1[400]
    C -- Có --> D[Promise.all: assertCategory + assertBrand + assertTags + assertSkusAvailable]
    D --> E{Mọi check pass?}
    E -- Không --> ERR2[400/409]
    E -- Có --> F[generateUniqueSlug slug||name]
    F --> G{Files?}
    G -- Có --> H[uploadEntityImage parallel]
    G -- Không --> I
    H --> I[product.create variants+specs+tags+images]
    I --> J[Ảnh đầu tiên isCover=true]
    J --> K[201 PRODUCT_DETAIL_INCLUDE]
```

---

## 3. Cập nhật sản phẩm (admin)

```mermaid
flowchart TD
    A([PUT /admin/products/:id]) --> B[findProductOrThrow]
    B --> C{Tồn tại?}
    C -- Không --> ERR1[404]
    C -- Có --> D[assertCategory/Brand/Tags nếu có]
    D --> E{tagIds gửi lên?}
    E -- Có --> F[Transaction: deleteMany tags + createMany + product.update]
    E -- Không --> G[product.update trực tiếp]
    F --> H[200 PRODUCT_DETAIL_INCLUDE]
    G --> H
```

---

## 4. Xóa ảnh sản phẩm

```mermaid
flowchart TD
    A([DELETE /:id/images/:imageId]) --> B[productImage.findUnique]
    B --> C{Tồn tại và đúng productId?}
    C -- Không --> ERR1[404]
    C -- Có --> D[productImage.delete]
    D --> E[destroyImage async]
    E --> F{isCover?}
    F -- Có --> G[findFirst còn lại orderBy sortOrder asc]
    G --> H{Có ảnh?}
    H -- Có --> I[update isCover=true]
    H -- Không --> J[200]
    I --> J
    F -- Không --> J
```

---

## 5. Cập nhật tồn kho (optimistic lock)

```mermaid
flowchart TD
    A([PATCH /variants/:variantId/stock]) --> B[findOwnedVariant]
    B --> C{Tìm thấy?}
    C -- Không --> ERR1[404]
    C -- Có --> D{expectedStock có?}
    D -- Có --> E{variant.stock === expectedStock?}
    E -- Không --> ERR2[409 Tồn kho đã thay đổi]
    E -- Có --> F[productVariant.update stock]
    D -- Không --> F
    F --> G[200 variant]
```

---

## 6. Xóa variant (guard variant cuối)

```mermaid
flowchart TD
    A([DELETE /:id/variants/:variantId]) --> B[Promise.all: findUnique + count]
    B --> C{Tìm thấy và đúng productId?}
    C -- Không --> ERR1[404]
    C -- Có --> D{totalCount <= 1?}
    D -- Có --> ERR2[409 Phải có ít nhất 1 variant]
    D -- Không --> E[productVariant.delete]
    E --> F[200]
```

---

## 7. Thay thế specs (replace-all)

```mermaid
flowchart TD
    A([PUT /:id/specs]) --> B[validateReplaceSpecs]
    B --> C{Hợp lệ?}
    C -- Không --> ERR1[400]
    C -- Có --> D[findProductOrThrow]
    D --> E[Transaction]
    E --> E1[deleteMany WHERE productId]
    E --> E2{specs.length > 0?}
    E2 -- Có --> E3[createMany sortOrder = index]
    E2 -- Không --> E4[Xóa sạch xong]
    E1 --> F[findMany WHERE productId orderBy sortOrder]
    E3 --> F
    E4 --> F
    F --> G[200 specs array]
```
