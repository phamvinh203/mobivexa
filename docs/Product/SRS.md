# Software Requirements Specification
## Module: Product
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Routes

### Public

| Method | Path | Auth | Validator |
|---|---|---|---|
| GET | `/api/products` | — | — |
| GET | `/api/products/featured` | — | — |
| GET | `/api/products/:slug` | — | — |

### Admin (STAFF+)

| Method | Path | Middleware | Validator |
|---|---|---|---|
| GET | `/api/admin/products` | authenticate, authorize(STAFF+) | — |
| GET | `/api/admin/products/:id` | authenticate, authorize(STAFF+) | — |
| POST | `/api/admin/products` | authenticate, authorize(STAFF+), uploadImage.array('images',10) | `validateCreateProduct` |
| PUT | `/api/admin/products/:id` | authenticate, authorize(STAFF+), uploadImage.array('images',10) | `validateUpdateProduct` |
| DELETE | `/api/admin/products/:id` | authenticate, authorize(STAFF+) | — |
| PATCH | `/api/admin/products/:id/status` | authenticate, authorize(STAFF+) | — |
| PATCH | `/api/admin/products/:id/featured` | authenticate, authorize(STAFF+) | — |
| POST | `/api/admin/products/:id/images` | authenticate, authorize(STAFF+), uploadImage.array('images',10) | — |
| DELETE | `/api/admin/products/:id/images/:imageId` | authenticate, authorize(STAFF+) | — |
| PATCH | `/api/admin/products/:id/images/:imageId/cover` | authenticate, authorize(STAFF+) | — |
| PUT | `/api/admin/products/:id/specs` | authenticate, authorize(STAFF+) | `validateReplaceSpecs` |
| POST | `/api/admin/products/:id/variants` | authenticate, authorize(STAFF+) | `validateVariant` |
| PUT | `/api/admin/products/:id/variants/:variantId` | authenticate, authorize(STAFF+) | `validateUpdateVariant` |
| DELETE | `/api/admin/products/:id/variants/:variantId` | authenticate, authorize(STAFF+) | — |
| PATCH | `/api/admin/products/:id/variants/:variantId/stock` | authenticate, authorize(STAFF+) | `validateUpdateStock` |

**Lưu ý riêng:** Không có route GET `/api/admin/inventory` riêng — inventory nằm trong `product.service` nhưng route cụ thể cần kiểm tra controller/router khác (nếu có).

---

## 2. Functional Requirements

### FR-01: GET /products (listProducts)

- Public: `where = { isActive: true }`; Admin: `where = {}`
- Query params:
  - `category` (slug), `brand` (slug)
  - `search` → FTS: `to_tsvector('simple', name) @@ to_tsquery('simple', tsQuery)`
  - `tag` (slug) — chỉ public
  - `minPrice`, `maxPrice` — chỉ public; lọc theo salePrice variant; NaN/Infinite → 400; âm → 400; min > max → 400
  - `isActive=true/false`, `isFeatured=true/false` — chỉ admin
  - `sort`: `newest`(default), `oldest`, `name_asc`, `name_desc`
  - `page`, `limit` (default `LIMITS.PRODUCT`; admin có thêm `LIMITS.MAX`)
- Include: category(id,name,slug), brand(id,name,slug), variants(isActive filter cho public), images(isCover=true, take:1)
- Admin: `omit: { description }` — tránh payload nặng

### FR-02: GET /products/featured

- `where = { isActive: true, isFeatured: true }`; `take = limit param (default 8)`
- Include: brand, variants(isActive=true), images(isCover=true, take:1)

### FR-03: GET /products/:slug (public detail)

- `findUnique WHERE slug`; `!product || !product.isActive` → 404
- Include: `PRODUCT_DETAIL_INCLUDE` = category, brand, variants(orderBy salePrice asc), productTags+tag, images(orderBy sortOrder asc), specs(orderBy sortOrder asc)

### FR-04: GET /admin/products/:id (admin detail)

- `findUnique WHERE id`; `!product` → 404
- Bao gồm cả sản phẩm `isActive=false`
- Include: `PRODUCT_DETAIL_INCLUDE`

### FR-05: POST /admin/products (createProduct)

1. Parallel: assertCategoryExists + assertBrandExists + assertTagsExist + assertSkusAvailable
2. `generateUniqueSlug(slug || name, slugTaken)` — slug unique
3. Upload ảnh parallel (nếu có files)
4. `product.create` với variants, specs, productTags, images trong cùng 1 câu
5. Ảnh đầu tiên: `isCover = true`

### FR-06: PUT /admin/products/:id (updateProduct)

1. `findProductOrThrow(id)` → 404 nếu không có
2. Conditional checks (chỉ check nếu field được gửi lên)
3. Slug rỗng → sinh lại từ `name` (current hoặc mới)
4. Nếu `tagIds` có → transaction: deleteMany tags cũ + createMany tags mới + update product
5. Nếu files → upload song song + count existing images để tính sortOrder đúng (isCover=false)

### FR-07: DELETE /admin/products/:id

1. Lấy publicId ảnh TRƯỚC khi xóa
2. `product.delete` (cascade xóa variants, images, specs, tags)
3. `destroyImage` async (fire-and-forget)

### FR-08: PATCH /admin/products/:id/status (toggleProductStatus)

- Toggle `isActive`: `findProductOrThrow` → flip → `update`

### FR-09: PATCH /admin/products/:id/featured (toggleProductFeatured)

- Toggle `isFeatured`: `findProductOrThrow` → flip → `update`

### FR-10: POST /admin/products/:id/images (addProductImages)

1. `findProductOrThrow`
2. Parallel: upload files + count existing images
3. `productImage.createMany`; nếu `existingCount === 0 && i === 0` → `isCover = true`

### FR-11: DELETE /admin/products/:id/images/:imageId

1. `productImage.findUnique WHERE id`; check `productId` ownership → 404
2. `productImage.delete`; `destroyImage` async
3. Nếu `image.isCover = true` → tìm ảnh đầu tiên còn lại → set `isCover = true`

### FR-12: PATCH /admin/products/:id/images/:imageId/cover (setProductImageCover)

1. Ownership check → 404
2. Transaction: `updateMany WHERE productId SET isCover=false` + `update WHERE id SET isCover=true`
3. Trả danh sách ảnh sắp xếp theo `sortOrder`

### FR-13: PUT /admin/products/:id/specs (replaceProductSpecs)

1. `findProductOrThrow`
2. Transaction: `deleteMany WHERE productId` + `createMany` (nếu mảng không rỗng)
3. Mảng rỗng → xóa sạch toàn bộ thông số
4. `sortOrder = index` trong mảng

### FR-14: POST /admin/products/:id/variants (addVariant)

1. `findProductOrThrow`; `assertSkusAvailable([sku])`
2. `productVariant.create`

### FR-15: PUT /admin/products/:id/variants/:variantId (updateVariant)

1. `findOwnedVariant(productId, variantId)` → 404 nếu không tìm thấy hoặc sai ownership
2. Partial update: chỉ ghi field được gửi lên
3. Cross-validate giá sau merge: `nextSale > nextOriginal` → 400

### FR-16: PATCH /admin/products/:id/variants/:variantId/stock (updateVariantStock)

1. `findOwnedVariant`
2. `expectedStock` tùy chọn: `variant.stock !== expectedStock` → 409 (optimistic lock)
3. `productVariant.update { stock }`

### FR-17: DELETE /admin/products/:id/variants/:variantId

1. Parallel: `findUnique variant` + `count(WHERE productId)`
2. Ownership check → 404; `totalCount <= 1` → 409
3. `productVariant.delete`

### FR-18: GET /admin/inventory (getInventory)

- Query: `search`, `brandSlug`, `stockStatus` (out_of_stock/low_stock/in_stock), `lowThreshold` (default 5), `page`, `limit`
- `stockStatus` filter map → `{ stock: { equals: 0 } }` / `{ stock: { gt:0, lte:threshold } }` / `{ stock: { gt: threshold } }`
- Parallel: variants + count + `getInventorySummary(threshold)` (in-memory cache 60s)
- Summary: `{ totalVariants, totalStock, outOfStock, lowStock, inStock }`

---

## 3. Validation

| Validator | Rules |
|---|---|
| `validateCreateProduct` | Parse JSON: variants, tagIds, specs từ form-data; name (checkName); categoryId truthy; brandId truthy; variants non-empty array; each variant: sku non-empty, originalPrice integer > 0, salePrice integer >= 0, salePrice <= originalPrice; specs: max 60 dòng, label <= 100, value <= 500 |
| `validateUpdateProduct` | Parse JSON: tagIds; name optional (checkName) |
| `validateReplaceSpecs` | `req.body.specs` là array; checkSpecs (max 60, label/value non-empty, length limits) |
| `validateVariant` | checkVariant: sku, originalPrice integer>0, salePrice integer>=0, salePrice<=originalPrice |
| `validateUpdateVariant` | checkVariantPatch: fields optional, stock integer>=0 nếu có |
| `validateUpdateStock` | stock integer>=0; expectedStock integer>=0 nếu có |

---

## 4. Constants

| Hằng | Giá trị |
|---|---|
| `MAX_SPECS` | 60 |
| `MAX_SPEC_LABEL` | 100 ký tự |
| `MAX_SPEC_VALUE` | 500 ký tự |
| `DEFAULT_LOW_THRESHOLD` | 5 |
| `SUMMARY_CACHE_TTL_MS` | 60,000 ms (60 giây) |
| Upload limit | 10 files/request (`uploadImage.array('images', 10)`) |
