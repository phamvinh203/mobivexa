# Products Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng trang danh sách sản phẩm `/products` và trang chi tiết `/products/:slug` cho SPA khách hàng `mobivexa`.

**Architecture:** Trạng thái lọc sống trên URL (`useSearchParams`), một lớp `productQuery` chuẩn hoá URL ↔ object; object đó vừa là `queryKey` vừa là params gửi backend. Dữ liệu nạp bằng `useSuspenseQuery` với `queryOptions` khai báo sẵn. Mỗi domain một feature; API công khai của review mở rộng vào `features/reviews` đã có.

**Tech Stack:** React 19 · Vite 8 · TypeScript 6 · MUI v9 · TanStack Query v5 · react-router-dom v7 · axios · Vitest (mới thêm ở Task 2).

**Spec:** [2026-08-09-products-feature-design.md](../specs/2026-08-09-products-feature-design.md)

## Global Constraints

- Thư mục làm việc: `mobivexa/`. **Không sửa** `be_mobivexa/` hay `fe_mobivexa/`.
- `verbatimModuleSyntax: true` → import kiểu phải dùng `import type { X } from "..."`.
- `erasableSyntaxOnly: true` → **cấm `enum`**, cấm parameter property. Enum viết bằng `as const` object.
- `noUnusedLocals` và `noUnusedParameters` bật → biến thừa làm hỏng build.
- Mọi request đi qua `apiClient` (`src/lib/apiClient.ts`). Không gọi `axios` trần.
- Backend trả `Decimal` thành **chuỗi** → dùng `Money` từ `src/lib/format.ts`, hiển thị bằng `formatVND()`.
- Style bằng MUI `sx`. Không Tailwind, không shadcn.
- Comment tiếng Việt, giải thích **tại sao**, không mô tả lại code.
- Backend: `category` và `brand` nhận **slug**. `limit` mặc định 12. Sort chỉ có `newest|oldest|name_asc|name_desc`.
- Base URL API đã có sẵn trong `apiClient`, đường dẫn viết tương đối: `/products`, không phải `/api/products`.
- Làm việc trên nhánh `dev_fe`. **Không đụng** `be_mobivexa/src/app.ts` đang sửa dở ngoài staging area.
- Mỗi task kết thúc bằng **một commit** chỉ chứa file của task đó, message tiếng Anh dạng
  `feat(products): <việc đã làm>`. Chỉ `git add` những đường dẫn task này tạo/sửa.

**Chốt task (chạy ở cuối mọi task, trước khi commit):**

```bash
npm run build && npm run lint && npm run test
```

Cả ba phải sạch. `npm run test` chỉ tồn tại từ Task 2 trở đi — ở Task 1 chỉ chạy
`npm run build && npm run lint`.

Mọi lệnh npm chạy trong thư mục `mobivexa/`.

---

### Task 1: Kiểu dữ liệu feature products

**Files:**
- Create: `src/features/products/types/index.ts`

**Interfaces:**
- Consumes: `ListQuery`, `PaginationMeta` từ `src/lib/apiTypes.ts`; `Money` từ `src/lib/format.ts`
- Produces: `Product`, `ProductVariant`, `ProductImage`, `Tag`, `CategoryRef`, `BrandRef`, `ProductListQuery`, `ProductListResult`, `PRODUCT_SORTS`, `ProductSort`

- [ ] **Step 1: Tạo file kiểu**

`src/features/products/types/index.ts`:

```ts
import type { ListQuery, PaginationMeta } from "../../../lib/apiTypes";
import type { Money } from "../../../lib/format";

export type { PaginationMeta };

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  isCover: boolean;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  color: string | null;
  storage: string | null;
  ram: string | null;
  imageUrl: string | null;
  originalPrice: Money;
  salePrice: Money;
  stock: number;
  isActive: boolean;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

/** Danh sách sản phẩm chỉ kèm category/brand rút gọn (select id,name,slug bên backend). */
export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface BrandRef {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  brandId: string;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  category?: CategoryRef;
  brand?: BrandRef;
  images?: ProductImage[];
  /** CHÚ Ý: endpoint chi tiết trả cả variant isActive=false — luôn lọc qua
   *  activeVariants() trước khi hiển thị. Endpoint danh sách thì đã lọc sẵn. */
  variants?: ProductVariant[];
  /** Backend trả productTags[{ tag }], không phải mảng tag phẳng. */
  productTags?: { tag: Tag }[];
}

/** Bốn giá trị resolveSort() bên backend hiểu. Không có sort theo giá. */
export const PRODUCT_SORTS = [
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface ProductListQuery extends ListQuery {
  search?: string;
  /** slug, không phải id */
  category?: string;
  /** slug, không phải id */
  brand?: string;
  tag?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
}

export interface ProductListResult {
  products: Product[];
  pagination: PaginationMeta;
}
```

- [ ] **Step 2: Kiểm chứng**

Run: `npm run build && npm run lint`
Expected: PASS, không cảnh báo.

---

### Task 2: Vitest + lớp query string `productQuery`

**Files:**
- Modify: `package.json` (devDependency + script `test`)
- Modify: `vite.config.ts`
- Create: `src/features/products/utils/productQuery.ts`
- Test: `src/features/products/utils/productQuery.test.ts`

**Interfaces:**
- Consumes: `ProductListQuery`, `ProductSort`, `PRODUCT_SORTS` (Task 1)
- Produces: `parseProductQuery(params: URLSearchParams): ProductListQuery`, `toSearchParams(query: ProductListQuery): URLSearchParams`

Không cần jsdom: `URLSearchParams` là global sẵn của Node, hai module được test đều không chạm DOM.

- [ ] **Step 1: Cài Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Thêm script test**

Trong `package.json`, thêm vào `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Bật vitest trong vite.config.ts**

Thay toàn bộ `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Chỉ test module logic thuần (productQuery, variantMatrix) nên chạy môi
  // trường node — không cần jsdom, đỡ một dependency và nhanh hơn.
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Viết test đỏ**

`src/features/products/utils/productQuery.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseProductQuery, toSearchParams } from "./productQuery";

describe("parseProductQuery", () => {
  it("URL rỗng cho object rỗng", () => {
    expect(parseProductQuery(new URLSearchParams(""))).toEqual({});
  });

  // Đây là ràng buộc quan trọng nhất: hashKey của TanStack Query băm
  // { page: 1 } khác {} nên hai URL cùng nghĩa phải parse ra một object.
  it("chuẩn hoá giá trị mặc định về cùng một object", () => {
    const implicit = parseProductQuery(new URLSearchParams(""));
    const explicit = parseProductQuery(
      new URLSearchParams("page=1&sort=newest"),
    );
    expect(explicit).toEqual(implicit);
  });

  it("giữ đủ bộ lọc hợp lệ", () => {
    const params = new URLSearchParams(
      "search=iphone&category=dien-thoai&brand=apple&tag=hot&minPrice=1000&maxPrice=2000&sort=name_asc&page=3",
    );
    expect(parseProductQuery(params)).toEqual({
      search: "iphone",
      category: "dien-thoai",
      brand: "apple",
      tag: "hot",
      minPrice: 1000,
      maxPrice: 2000,
      sort: "name_asc",
      page: 3,
    });
  });

  it("bỏ giá trị rác thay vì làm vỡ trang", () => {
    const params = new URLSearchParams(
      "page=abc&sort=price_asc&minPrice=-5&search=%20%20",
    );
    expect(parseProductQuery(params)).toEqual({});
  });

  it("ép page về số nguyên tối thiểu 1", () => {
    expect(parseProductQuery(new URLSearchParams("page=0"))).toEqual({});
    expect(parseProductQuery(new URLSearchParams("page=2.7"))).toEqual({
      page: 2,
    });
  });
});

describe("toSearchParams", () => {
  it("bỏ field rỗng và giá trị mặc định", () => {
    const params = toSearchParams({
      search: "",
      page: 1,
      sort: "newest",
      brand: "apple",
    });
    expect(params.toString()).toBe("brand=apple");
  });

  it("khứ hồi parse → serialize → parse giữ nguyên", () => {
    const original = new URLSearchParams(
      "search=iphone&brand=apple&minPrice=1000&page=2",
    );
    const query = parseProductQuery(original);
    expect(parseProductQuery(toSearchParams(query))).toEqual(query);
  });
});
```

- [ ] **Step 5: Chạy test, xác nhận đỏ**

Run: `npm run test`
Expected: FAIL — `Failed to resolve import "./productQuery"`.

- [ ] **Step 6: Viết implementation**

`src/features/products/utils/productQuery.ts`:

```ts
import { PRODUCT_SORTS } from "../types";
import type { ProductListQuery, ProductSort } from "../types";

/** Mặc định của backend. Không ghi vào URL lẫn query object — xem parseSort. */
const DEFAULT_SORT: ProductSort = "newest";

/** Thứ tự đọc/ghi các khoá. Gom một chỗ để parse và serialize không lệch nhau. */
const KEYS = [
  "search",
  "category",
  "brand",
  "tag",
  "minPrice",
  "maxPrice",
  "sort",
  "page",
] as const;

function parseText(raw: string | null): string | undefined {
  const value = raw?.trim();
  return value ? value : undefined;
}

function parseCount(raw: string | null): number | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return num;
}

function parsePage(raw: string | null): number | undefined {
  const num = parseCount(raw);
  if (num === undefined) return undefined;
  const page = Math.max(1, Math.floor(num));
  // page 1 là mặc định — bỏ đi để ?page=1 và không có page cho cùng một key.
  return page === 1 ? undefined : page;
}

function parseSort(raw: string | null): ProductSort | undefined {
  const found = PRODUCT_SORTS.find((sort) => sort === raw);
  return found && found !== DEFAULT_SORT ? found : undefined;
}

/**
 * URL → query object. Object này vừa làm queryKey vừa làm params gửi backend,
 * nên phải CHUẨN HOÁ: mọi giá trị mặc định và mọi giá trị rác đều bị loại, để
 * hai URL cùng nghĩa không sinh ra hai cache entry.
 */
export function parseProductQuery(params: URLSearchParams): ProductListQuery {
  const query: ProductListQuery = {};

  const search = parseText(params.get("search"));
  if (search) query.search = search;

  const category = parseText(params.get("category"));
  if (category) query.category = category;

  const brand = parseText(params.get("brand"));
  if (brand) query.brand = brand;

  const tag = parseText(params.get("tag"));
  if (tag) query.tag = tag;

  const minPrice = parseCount(params.get("minPrice"));
  if (minPrice !== undefined) query.minPrice = minPrice;

  const maxPrice = parseCount(params.get("maxPrice"));
  if (maxPrice !== undefined) query.maxPrice = maxPrice;

  const sort = parseSort(params.get("sort"));
  if (sort) query.sort = sort;

  const page = parsePage(params.get("page"));
  if (page !== undefined) query.page = page;

  return query;
}

/** Query object → URL. Bỏ field rỗng và mặc định để link chia sẻ gọn. */
export function toSearchParams(query: ProductListQuery): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of KEYS) {
    const value = query[key];
    if (value === undefined || value === "") continue;
    if (key === "sort" && value === DEFAULT_SORT) continue;
    if (key === "page" && value === 1) continue;
    params.set(key, String(value));
  }

  return params;
}
```

- [ ] **Step 7: Chạy test, xác nhận xanh**

Run: `npm run test`
Expected: PASS, 7 test.

- [ ] **Step 8: Chốt task**

Run: `npm run build && npm run lint && npm run test`

---

### Task 3: Port `variantMatrix`

**Files:**
- Create: `src/features/products/utils/variantMatrix.ts`
- Test: `src/features/products/utils/variantMatrix.test.ts`

**Interfaces:**
- Consumes: `ProductVariant` (Task 1)
- Produces: `VARIANT_DIMENSIONS`, `VariantDimension`, `DIMENSION_LABEL`, `VariantSelection`, `DimensionGroup`, `buildDimensions()`, `matchVariant()`, `isValueAvailable()`, `isValueInStock()`, `selectionOf()`, `defaultVariant()`, `reconcileSelection()`

Nguồn port: `fe_mobivexa/app/(client)/products/[slug]/_components/variant-matrix.ts`. Chỉ đổi đường dẫn import, **giữ nguyên logic và comment**.

- [ ] **Step 1: Viết test đỏ**

`src/features/products/utils/variantMatrix.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ProductVariant } from "../types";
import {
  buildDimensions,
  defaultVariant,
  isValueAvailable,
  matchVariant,
  reconcileSelection,
} from "./variantMatrix";

function variant(partial: Partial<ProductVariant> & { sku: string }): ProductVariant {
  return {
    id: partial.sku,
    productId: "p1",
    color: null,
    storage: null,
    ram: null,
    imageUrl: null,
    originalPrice: "1000",
    salePrice: "1000",
    stock: 1,
    isActive: true,
    ...partial,
  };
}

// Sản phẩm mẫu: 128GB có Đen và Hồng, 512GB chỉ có Đen (và hết hàng).
const variants: ProductVariant[] = [
  variant({ sku: "128-den", storage: "128GB", color: "Đen" }),
  variant({ sku: "128-hong", storage: "128GB", color: "Hồng", stock: 0 }),
  variant({ sku: "512-den", storage: "512GB", color: "Đen", stock: 0 }),
];
const dimensions = buildDimensions(variants);

describe("buildDimensions", () => {
  it("bỏ trục không sản phẩm nào có giá trị", () => {
    expect(dimensions.map((d) => d.dimension)).toEqual(["storage", "color"]);
  });
});

describe("matchVariant", () => {
  it("khớp đúng tổ hợp", () => {
    const found = matchVariant(variants, dimensions, {
      storage: "128GB",
      color: "Đen",
    });
    expect(found?.sku).toBe("128-den");
  });

  it("trả null khi tổ hợp không tồn tại", () => {
    expect(
      matchVariant(variants, dimensions, { storage: "512GB", color: "Hồng" }),
    ).toBeNull();
  });
});

describe("isValueAvailable", () => {
  it("màu Hồng không chọn được khi đang ở 512GB", () => {
    expect(
      isValueAvailable(
        variants,
        dimensions,
        { storage: "512GB" },
        "color",
        "Hồng",
      ),
    ).toBe(false);
  });
});

describe("reconcileSelection", () => {
  it("hàn lại tổ hợp thay vì để kẹt khi đổi trục", () => {
    const next = reconcileSelection(
      variants,
      dimensions,
      { storage: "128GB", color: "Hồng" },
      "storage",
      "512GB",
    );
    expect(next).toEqual({ storage: "512GB", color: "Đen" });
  });
});

describe("defaultVariant", () => {
  it("chọn bản còn hàng đầu tiên", () => {
    expect(defaultVariant(variants)?.sku).toBe("128-den");
  });

  it("hết hàng toàn bộ thì lấy bản đầu", () => {
    const soldOut = variants.map((v) => ({ ...v, stock: 0 }));
    expect(defaultVariant(soldOut)?.sku).toBe("128-den");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npm run test`
Expected: FAIL — không resolve được `./variantMatrix`.

- [ ] **Step 3: Port file**

Copy nguyên nội dung `fe_mobivexa/app/(client)/products/[slug]/_components/variant-matrix.ts` sang `src/features/products/utils/variantMatrix.ts`, chỉ sửa dòng import đầu tiên thành:

```ts
import type { ProductVariant } from "../types";
```

Giữ nguyên toàn bộ phần còn lại: `VARIANT_DIMENSIONS` (thứ tự `storage`, `ram`, `color`), `DIMENSION_LABEL`, `VariantSelection`, `DimensionGroup`, `buildDimensions`, `matchVariant`, `isValueAvailable`, `isValueInStock`, `selectionOf`, `defaultVariant`, `reconcileSelection` — kèm nguyên các comment tiếng Việt.

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `npm run test`
Expected: PASS, tổng 15 test (7 của Task 2 + 8 của task này).

- [ ] **Step 5: Chốt task**

Run: `npm run build && npm run lint && npm run test`

---

### Task 4: Tầng API và helper của products

**Files:**
- Create: `src/features/products/api/productsApi.ts`
- Create: `src/features/products/api/queries.ts`
- Create: `src/features/products/utils/product.ts`

**Interfaces:**
- Consumes: `apiClient`, các kiểu Task 1
- Produces: `productsApi.list()`, `productsApi.detail()`, `productKeys`, `productListQueryOptions()`, `productDetailQueryOptions()`, `coverImageUrl()`, `galleryImages()`, `productTagList()`, `activeVariants()`, `priceRange()`, `totalStock()`

- [ ] **Step 1: Tầng gọi API**

`src/features/products/api/productsApi.ts`:

```ts
import { apiClient } from "../../../lib/apiClient";
import type { Product, ProductListQuery, ProductListResult } from "../types";

// Khớp src/routes/product.route.ts phần public.
// list trả thẳng { products, pagination }; detail bọc trong { product } → unwrap ở đây.
export const productsApi = {
  async list(query?: ProductListQuery): Promise<ProductListResult> {
    const { data } = await apiClient.get<ProductListResult>("/products", {
      params: query,
    });
    return data;
  },

  async detail(slug: string): Promise<Product> {
    const { data } = await apiClient.get<{ product: Product }>(
      `/products/${slug}`,
    );
    return data.product;
  },
};
```

`GET /products/featured` **không** làm ở mục này — trang chủ thuộc mục 5 của ROADMAP.

- [ ] **Step 2: queryOptions**

`src/features/products/api/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { productsApi } from "./productsApi";
import type { ProductListQuery } from "../types";

export const productKeys = {
  all: ["products"] as const,
  list: (query?: ProductListQuery) =>
    [...productKeys.all, "list", query ?? {}] as const,
  detail: (slug: string) => [...productKeys.all, "detail", slug] as const,
};

// Không gắn USER_SCOPED: dữ liệu công khai, đăng xuất không cần dọn.
export const productListQueryOptions = (query?: ProductListQuery) =>
  queryOptions({
    queryKey: productKeys.list(query),
    queryFn: () => productsApi.list(query),
  });

export const productDetailQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: productKeys.detail(slug),
    queryFn: () => productsApi.detail(slug),
  });
```

- [ ] **Step 3: Helper đọc dữ liệu sản phẩm**

`src/features/products/utils/product.ts`:

```ts
import type { Money } from "../../../lib/format";
import type { Product, ProductVariant, Tag } from "../types";

/** Ảnh bìa: ưu tiên isCover, fallback ảnh đầu tiên. */
export function coverImageUrl(product: Product): string | undefined {
  return product.images?.find((i) => i.isCover)?.url ?? product.images?.[0]?.url;
}

/**
 * Ảnh cho gallery: ảnh bìa lên đầu, phần còn lại giữ sortOrder backend đã sắp.
 * Bổ sung ảnh riêng của variant nếu chưa có — để chọn màu nào thấy đúng ảnh màu đó.
 */
export function galleryImages(product: Product): { id: string; url: string }[] {
  const images = [...(product.images ?? [])].sort(
    (a, b) => Number(b.isCover) - Number(a.isCover),
  );
  const urls = new Set(images.map((i) => i.url));
  const gallery = images.map((i) => ({ id: i.id, url: i.url }));

  for (const v of product.variants ?? []) {
    if (v.imageUrl && !urls.has(v.imageUrl)) {
      urls.add(v.imageUrl);
      gallery.push({ id: `variant-${v.id}`, url: v.imageUrl });
    }
  }
  return gallery;
}

/** Backend trả productTags[{ tag }], không phải mảng phẳng. */
export function productTagList(product: Product): Tag[] {
  return (product.productTags ?? []).map((pt) => pt.tag);
}

/**
 * Chỉ variant còn bán được. BẮT BUỘC gọi ở trang chi tiết: endpoint
 * GET /products/:slug trả cả variant đã tắt, khác với endpoint danh sách.
 */
export function activeVariants(product: Product): ProductVariant[] {
  return (product.variants ?? []).filter((v) => v.isActive);
}

/** Khoảng giá bán — dùng cho thẻ sản phẩm khi chưa chọn variant. */
export function priceRange(
  variants: ProductVariant[],
): { min: Money; max: Money } | null {
  if (variants.length === 0) return null;
  const prices = variants.map((v) => Number(v.salePrice));
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function totalStock(variants: ProductVariant[]): number {
  return variants.reduce((sum, v) => sum + v.stock, 0);
}
```

- [ ] **Step 4: Chốt task**

Run: `npm run build && npm run lint && npm run test`

---

### Task 5: Feature mỏng `categories` và `brands`

**Files:**
- Create: `src/features/categories/types/index.ts`
- Create: `src/features/categories/api/categoriesApi.ts`
- Create: `src/features/categories/api/queries.ts`
- Create: `src/features/brands/types/index.ts`
- Create: `src/features/brands/api/brandsApi.ts`
- Create: `src/features/brands/api/queries.ts`

**Interfaces:**
- Produces: `Category`, `categoriesApi.list()`, `categoryKeys`, `categoryListQueryOptions()`, `Brand`, `brandsApi.list()`, `brandKeys`, `brandListQueryOptions()`

Backend trả `{ categories }` và `{ brands }` — mảng phẳng, **không phân trang**.
Mục 5 của ROADMAP sẽ thêm page vào hai feature này; giờ chỉ cần tầng dữ liệu.

- [ ] **Step 1: Kiểu Category**

`src/features/categories/types/index.ts`:

```ts
/** Khớp model Category trong be_mobivexa/prisma/schema.prisma. */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: API + queries của categories**

`src/features/categories/api/categoriesApi.ts`:

```ts
import { apiClient } from "../../../lib/apiClient";
import type { Category } from "../types";

// GET /categories trả { categories } — mảng phẳng, không phân trang.
export const categoriesApi = {
  async list(): Promise<Category[]> {
    const { data } = await apiClient.get<{ categories: Category[] }>(
      "/categories",
    );
    return data.categories;
  },
};
```

`src/features/categories/api/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { categoriesApi } from "./categoriesApi";

export const categoryKeys = {
  all: ["categories"] as const,
  list: () => [...categoryKeys.all, "list"] as const,
};

// Danh mục hiếm khi đổi và dùng lại ở mọi trang có bộ lọc → giữ tươi lâu hơn
// mặc định 30s để không refetch mỗi lần chuyển trang.
export const categoryListQueryOptions = () =>
  queryOptions({
    queryKey: categoryKeys.list(),
    queryFn: () => categoriesApi.list(),
    staleTime: 5 * 60_000,
  });
```

- [ ] **Step 3: Kiểu Brand**

`src/features/brands/types/index.ts`:

```ts
/** Khớp model Brand trong be_mobivexa/prisma/schema.prisma. */
export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: API + queries của brands**

`src/features/brands/api/brandsApi.ts`:

```ts
import { apiClient } from "../../../lib/apiClient";
import type { Brand } from "../types";

// GET /brands trả { brands } — mảng phẳng, không phân trang.
export const brandsApi = {
  async list(): Promise<Brand[]> {
    const { data } = await apiClient.get<{ brands: Brand[] }>("/brands");
    return data.brands;
  },
};
```

`src/features/brands/api/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { brandsApi } from "./brandsApi";

export const brandKeys = {
  all: ["brands"] as const,
  list: () => [...brandKeys.all, "list"] as const,
};

export const brandListQueryOptions = () =>
  queryOptions({
    queryKey: brandKeys.list(),
    queryFn: () => brandsApi.list(),
    staleTime: 5 * 60_000,
  });
```

- [ ] **Step 5: Chốt task**

Run: `npm run build && npm run lint && npm run test`

---

### Task 6: `ProductCard`, `ProductGrid`, skeleton lưới

**Files:**
- Create: `src/features/products/components/ProductCard.tsx`
- Create: `src/features/products/components/ProductGrid.tsx`
- Create: `src/features/products/components/ProductGridSkeleton.tsx`

**Interfaces:**
- Consumes: `Product` (Task 1), helper `coverImageUrl`/`priceRange`/`totalStock` (Task 4), `formatVND` (`src/lib/format.ts`)
- Produces: `<ProductCard product />`, `<ProductGrid products />`, `<ProductGridSkeleton count? />`

- [ ] **Step 1: ProductCard**

`src/features/products/components/ProductCard.tsx`:

```tsx
import type { ReactElement } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import { formatVND } from "../../../lib/format";
import { coverImageUrl, priceRange, totalStock } from "../utils/product";
import type { Product } from "../types";

export function ProductCard({ product }: { product: Product }): ReactElement {
  // Danh sách đã được backend lọc isActive nên dùng thẳng variants.
  const variants = product.variants ?? [];
  const range = priceRange(variants);
  const soldOut = totalStock(variants) === 0;
  const cover = coverImageUrl(product);
  const discounted = variants.some(
    (v) => Number(v.salePrice) < Number(v.originalPrice),
  );

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardActionArea
        component={RouterLink}
        to={`/products/${product.slug}`}
        sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch" }}
      >
        <Box
          sx={{
            position: "relative",
            aspectRatio: "1",
            bgcolor: "action.hover",
            backgroundImage: cover ? `url(${cover})` : undefined,
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {discounted && (
            <Chip
              label="Giảm giá"
              color="error"
              size="small"
              sx={{ position: "absolute", top: 8, left: 8 }}
            />
          )}
          {soldOut && (
            <Chip
              label="Hết hàng"
              size="small"
              sx={{ position: "absolute", top: 8, right: 8 }}
            />
          )}
        </Box>

        <Stack spacing={0.5} sx={{ p: 1.5, flex: 1 }}>
          {product.brand && (
            <Typography variant="caption" color="text.secondary">
              {product.brand.name}
            </Typography>
          )}
          <Typography sx={{ fontWeight: 600 }}>{product.name}</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Typography color="primary" sx={{ fontWeight: 700 }}>
            {range === null
              ? "Liên hệ"
              : Number(range.min) === Number(range.max)
                ? formatVND(range.min)
                : `${formatVND(range.min)} – ${formatVND(range.max)}`}
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
```

- [ ] **Step 2: ProductGrid**

`src/features/products/components/ProductGrid.tsx`:

```tsx
import type { ReactElement } from "react";
import { Box } from "@mui/material";
import { ProductCard } from "./ProductCard";
import type { Product } from "../types";

/** Lưới sản phẩm: 2 cột trên mobile, 3 từ sm, 4 từ md. */
export function ProductGrid({ products }: { products: Product[] }): ReactElement {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(3, 1fr)",
          md: "repeat(4, 1fr)",
        },
      }}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </Box>
  );
}
```

- [ ] **Step 3: Skeleton lưới**

`src/features/products/components/ProductGridSkeleton.tsx`:

```tsx
import type { ReactElement } from "react";
import { Box, Skeleton } from "@mui/material";

/** Khung xương cho lưới sản phẩm. Mặc định 12 ô — bằng limit của backend nên
 *  lúc dữ liệu về không bị nhảy layout. */
export function ProductGridSkeleton({ count = 12 }: { count?: number }): ReactElement {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(3, 1fr)",
          md: "repeat(4, 1fr)",
        },
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={280} />
      ))}
    </Box>
  );
}
```

- [ ] **Step 4: Chốt task**

Run: `npm run build && npm run lint && npm run test`

---

### Task 7: Trang `/products`

**Files:**
- Create: `src/features/products/hooks/useProductList.ts`
- Create: `src/features/products/components/ProductFilters.tsx`
- Create: `src/features/products/components/ProductSortSelect.tsx`
- Create: `src/features/products/components/ActiveFilterChips.tsx`
- Create: `src/pages/ProductsPage.tsx`
- Modify: `src/router.tsx`

**Interfaces:**
- Consumes: `parseProductQuery`/`toSearchParams` (Task 2), `productListQueryOptions` (Task 4), `categoryListQueryOptions`/`brandListQueryOptions` (Task 5), `ProductGrid`/`ProductGridSkeleton` (Task 6)
- Produces: `useProductList()` trả `{ query, products, pagination, setFilter, setPage, clearFilters }`; `<ProductsPage />`

- [ ] **Step 1: Hook danh sách**

`src/features/products/hooks/useProductList.ts`:

```ts
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productListQueryOptions } from "../api/queries";
import { parseProductQuery, toSearchParams } from "../utils/productQuery";
import type { PaginationMeta, Product, ProductListQuery } from "../types";

export interface UseProductListResult {
  query: ProductListQuery;
  products: Product[];
  pagination: PaginationMeta;
  /** Đổi một bộ lọc. Luôn reset về trang 1 vì kết quả đã khác. */
  setFilter: (patch: Partial<ProductListQuery>, options?: { replace?: boolean }) => void;
  setPage: (page: number) => void;
  clearFilters: () => void;
}

/**
 * Nguồn sự thật là URL, không có state song song: đổi searchParams → query đổi
 * → queryKey đổi → React Query tự fetch. Không cần useEffect đồng bộ.
 */
export function useProductList(): UseProductListResult {
  const [searchParams, setSearchParams] = useSearchParams();

  // parse lại mỗi lần searchParams đổi; memo để queryKey không đổi tham chiếu vô cớ.
  const query = useMemo(() => parseProductQuery(searchParams), [searchParams]);

  const { data } = useSuspenseQuery(productListQueryOptions(query));

  const setFilter = useCallback(
    (patch: Partial<ProductListQuery>, options?: { replace?: boolean }) => {
      // page bị bỏ khỏi next: đổi bộ lọc mà giữ trang cũ sẽ ra trang trống.
      const next: ProductListQuery = { ...query, ...patch, page: undefined };
      setSearchParams(toSearchParams(next), { replace: options?.replace ?? false });
    },
    [query, setSearchParams],
  );

  const setPage = useCallback(
    (page: number) => {
      setSearchParams(toSearchParams({ ...query, page }));
    },
    [query, setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return {
    query,
    products: data.products,
    pagination: data.pagination,
    setFilter,
    setPage,
    clearFilters,
  };
}
```

- [ ] **Step 2: Bộ lọc**

`src/features/products/components/ProductFilters.tsx`:

```tsx
import { useEffect, useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { categoryListQueryOptions } from "../../categories/api/queries";
import { brandListQueryOptions } from "../../brands/api/queries";
import type { ProductListQuery } from "../types";

interface Props {
  query: ProductListQuery;
  onChange: (patch: Partial<ProductListQuery>) => void;
}

/**
 * Danh mục/thương hiệu dùng useQuery (không Suspense): thiếu chúng thì lưới sản
 * phẩm vẫn hiển thị được, không đáng chặn cả trang chờ hai request phụ.
 */
export function ProductFilters({ query, onChange }: Props): ReactElement {
  const categories = useQuery(categoryListQueryOptions());
  const brands = useQuery(brandListQueryOptions());

  // Khoảng giá giữ ở state cục bộ, chỉ đẩy lên URL khi bấm Áp dụng — gõ từng
  // chữ số mà fetch ngay thì vừa tốn request vừa nhảy kết quả loạn.
  const [minPrice, setMinPrice] = useState(query.minPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(query.maxPrice?.toString() ?? "");

  useEffect(() => {
    setMinPrice(query.minPrice?.toString() ?? "");
    setMaxPrice(query.maxPrice?.toString() ?? "");
  }, [query.minPrice, query.maxPrice]);

  return (
    <Stack spacing={2.5}>
      <TextField
        select
        size="small"
        label="Danh mục"
        value={query.category ?? ""}
        onChange={(e) => onChange({ category: e.target.value || undefined })}
      >
        <MenuItem value="">Tất cả</MenuItem>
        {(categories.data ?? []).map((c) => (
          <MenuItem key={c.id} value={c.slug}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        label="Thương hiệu"
        value={query.brand ?? ""}
        onChange={(e) => onChange({ brand: e.target.value || undefined })}
      >
        <MenuItem value="">Tất cả</MenuItem>
        {(brands.data ?? []).map((b) => (
          <MenuItem key={b.id} value={b.slug}>
            {b.name}
          </MenuItem>
        ))}
      </TextField>

      <Stack spacing={1}>
        <Typography variant="subtitle2">Khoảng giá</Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            type="number"
            label="Từ"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <TextField
            size="small"
            type="number"
            label="Đến"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </Stack>
        <Button
          size="small"
          variant="outlined"
          onClick={() =>
            onChange({
              minPrice: minPrice === "" ? undefined : Number(minPrice),
              maxPrice: maxPrice === "" ? undefined : Number(maxPrice),
            })
          }
        >
          Áp dụng
        </Button>
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 3: Dropdown sắp xếp**

`src/features/products/components/ProductSortSelect.tsx`:

```tsx
import type { ReactElement } from "react";
import { MenuItem, TextField } from "@mui/material";
import type { ProductListQuery, ProductSort } from "../types";

// Không có tuỳ chọn theo giá: resolveSort() bên backend không hỗ trợ, giá nằm ở
// bảng variants nên Prisma không orderBy theo min của quan hệ được.
const SORT_LABELS: Record<ProductSort, string> = {
  newest: "Mới nhất",
  oldest: "Cũ nhất",
  name_asc: "Tên A → Z",
  name_desc: "Tên Z → A",
};

interface Props {
  value: ProductSort;
  onChange: (patch: Partial<ProductListQuery>) => void;
}

export function ProductSortSelect({ value, onChange }: Props): ReactElement {
  return (
    <TextField
      select
      size="small"
      label="Sắp xếp"
      value={value}
      onChange={(e) => onChange({ sort: e.target.value as ProductSort })}
      sx={{ minWidth: 160 }}
    >
      {Object.entries(SORT_LABELS).map(([key, label]) => (
        <MenuItem key={key} value={key}>
          {label}
        </MenuItem>
      ))}
    </TextField>
  );
}
```

- [ ] **Step 4: Chip bộ lọc đang bật**

`src/features/products/components/ActiveFilterChips.tsx`:

```tsx
import type { ReactElement } from "react";
import { Button, Chip, Stack } from "@mui/material";
import { formatVND } from "../../../lib/format";
import type { ProductListQuery } from "../types";

interface Props {
  query: ProductListQuery;
  onChange: (patch: Partial<ProductListQuery>) => void;
  onClear: () => void;
}

export function ActiveFilterChips({ query, onChange, onClear }: Props): ReactElement | null {
  const chips: { key: keyof ProductListQuery; label: string }[] = [];

  if (query.search) chips.push({ key: "search", label: `Tìm: ${query.search}` });
  if (query.category) chips.push({ key: "category", label: `Danh mục: ${query.category}` });
  if (query.brand) chips.push({ key: "brand", label: `Thương hiệu: ${query.brand}` });
  if (query.tag) chips.push({ key: "tag", label: `Tag: ${query.tag}` });
  if (query.minPrice !== undefined) chips.push({ key: "minPrice", label: `Từ ${formatVND(query.minPrice)}` });
  if (query.maxPrice !== undefined) chips.push({ key: "maxPrice", label: `Đến ${formatVND(query.maxPrice)}` });

  if (chips.length === 0) return null;

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          size="small"
          onDelete={() => onChange({ [chip.key]: undefined })}
        />
      ))}
      <Button size="small" onClick={onClear}>
        Xoá tất cả
      </Button>
    </Stack>
  );
}
```

- [ ] **Step 5: Trang ProductsPage**

`src/pages/ProductsPage.tsx`:

```tsx
import { Suspense, useEffect, useRef, useState, type ReactElement } from "react";
import {
  Box,
  Button,
  Drawer,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { SlidersHorizontal } from "lucide-react";
import { useProductList } from "../features/products/hooks/useProductList";
import { ProductFilters } from "../features/products/components/ProductFilters";
import { ProductSortSelect } from "../features/products/components/ProductSortSelect";
import { ActiveFilterChips } from "../features/products/components/ActiveFilterChips";
import { ProductGrid } from "../features/products/components/ProductGrid";
import { ProductGridSkeleton } from "../features/products/components/ProductGridSkeleton";

/** Ô tìm kiếm: gõ xong 400ms mới ghi URL, và ghi bằng replace để gõ 10 ký tự
 *  không sinh 10 entry history. */
function SearchField(): ReactElement {
  const { query, setFilter } = useProductList();
  const [text, setText] = useState(query.search ?? "");
  const committed = useRef(query.search ?? "");

  useEffect(() => {
    setText(query.search ?? "");
    committed.current = query.search ?? "";
  }, [query.search]);

  useEffect(() => {
    if (text === committed.current) return;
    const timer = setTimeout(() => {
      committed.current = text;
      setFilter({ search: text || undefined }, { replace: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [text, setFilter]);

  return (
    <TextField
      size="small"
      label="Tìm sản phẩm"
      value={text}
      onChange={(e) => setText(e.target.value)}
      sx={{ flex: 1, minWidth: 200 }}
    />
  );
}

function ProductResults(): ReactElement {
  const { query, products, pagination, setFilter, setPage, clearFilters } =
    useProductList();
  const hasFilter = Object.keys(query).some((k) => k !== "page");

  return (
    <Stack spacing={2}>
      <ActiveFilterChips query={query} onChange={setFilter} onClear={clearFilters} />

      {products.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            {hasFilter
              ? "Không có sản phẩm nào khớp bộ lọc."
              : "Cửa hàng chưa có sản phẩm nào."}
          </Typography>
          {hasFilter && (
            <Button sx={{ mt: 1 }} onClick={clearFilters}>
              Xoá bộ lọc
            </Button>
          )}
        </Paper>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">
            {pagination.total} sản phẩm
          </Typography>
          <ProductGrid products={products} />
          {pagination.totalPages > 1 && (
            <Stack sx={{ alignItems: "center", pt: 1 }}>
              <Pagination
                page={pagination.page}
                count={pagination.totalPages}
                onChange={(_, page) => setPage(page)}
                color="primary"
              />
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}

/** Thanh công cụ tách riêng để dùng lại hook mà không kéo cả lưới render lại. */
function Toolbar({ onOpenFilters }: { onOpenFilters: () => void }): ReactElement {
  const { query, setFilter } = useProductList();

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
      <SearchField />
      <ProductSortSelect value={query.sort ?? "newest"} onChange={setFilter} />
      <Button
        variant="outlined"
        startIcon={<SlidersHorizontal size={18} />}
        onClick={onOpenFilters}
        sx={{ display: { md: "none" } }}
      >
        Bộ lọc
      </Button>
    </Stack>
  );
}

function FilterPanel(): ReactElement {
  const { query, setFilter } = useProductList();
  return <ProductFilters query={query} onChange={setFilter} />;
}

export function ProductsPage(): ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Sản phẩm
      </Typography>

      <Suspense fallback={<ProductGridSkeleton />}>
        <Toolbar onOpenFilters={() => setDrawerOpen(true)} />

        <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
          <Paper
            variant="outlined"
            sx={{ p: 2, width: 260, flexShrink: 0, display: { xs: "none", md: "block" } }}
          >
            <FilterPanel />
          </Paper>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <ProductResults />
          </Box>
        </Box>

        {/* Drawer PHẢI nằm trong Suspense: FilterPanel gọi useProductList, mà
            hook đó dùng useSuspenseQuery. Đặt ngoài thì lần mở đầu tiên sẽ ném
            lên Suspense của Root và chớp trắng cả trang. */}
        <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <Box sx={{ width: 280, p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              Bộ lọc
            </Typography>
            <FilterPanel />
          </Box>
        </Drawer>
      </Suspense>
    </Stack>
  );
}
```

Chú ý cấu trúc JSX: `<Suspense>` mở ngay sau tiêu đề và **đóng sau `<Drawer>`**, không đóng trước nó.

- [ ] **Step 6: Gắn route**

Trong `src/router.tsx`, thêm khai báo lazy cạnh các khai báo sẵn có:

```tsx
const ProductsPage = lazy(() =>
  import("./pages/ProductsPage").then((m) => ({ default: m.ProductsPage })),
);
```

Trong nhánh `<ClientLayout />`, thêm route ngay sau `{ index: true, element: <HomePage /> }`:

```tsx
{
  path: "products",
  element: <ProductsPage />,
  errorElement: <RouteErrorAlert />,
},
```

- [ ] **Step 7: Kiểm chứng trên trình duyệt**

Chạy backend (`cd ../be_mobivexa && npm run dev`) và `npm run dev`, mở http://localhost:5173/products:

1. Lưới hiện sản phẩm, đếm đúng tổng.
2. Đổi danh mục / thương hiệu / khoảng giá → URL đổi, kết quả đổi, trang về 1.
3. Gõ vào ô tìm kiếm liên tục rồi bấm back **một lần** → về trạng thái trước khi gõ, không lùi từng ký tự.
4. F5 ở trang 2 có bộ lọc → giữ nguyên.

- [ ] **Step 8: Chốt task**

Run: `npm run build && npm run lint && npm run test`

---

### Task 8: Trang chi tiết — khung, gallery, 404

**Files:**
- Create: `src/features/products/hooks/useProductDetail.ts`
- Create: `src/features/products/components/ProductGallery.tsx`
- Create: `src/pages/ProductDetailPage.tsx`
- Modify: `src/router.tsx`

**Interfaces:**
- Consumes: `productDetailQueryOptions` (Task 4), `galleryImages` (Task 4)
- Produces: `useProductDetail(slug)` trả `Product`; `<ProductGallery images activeUrl onSelect />`; `<ProductDetailPage />`

- [ ] **Step 1: Hook chi tiết**

`src/features/products/hooks/useProductDetail.ts`:

```ts
import { useSuspenseQuery } from "@tanstack/react-query";
import { productDetailQueryOptions } from "../api/queries";
import type { Product } from "../types";

export function useProductDetail(slug: string): Product {
  const { data } = useSuspenseQuery(productDetailQueryOptions(slug));
  return data;
}
```

- [ ] **Step 2: Gallery**

`src/features/products/components/ProductGallery.tsx`:

```tsx
import type { ReactElement } from "react";
import { Box, Paper, Stack } from "@mui/material";

interface Props {
  images: { id: string; url: string }[];
  activeUrl?: string;
  onSelect: (url: string) => void;
}

export function ProductGallery({ images, activeUrl, onSelect }: Props): ReactElement {
  const main = activeUrl ?? images[0]?.url;

  return (
    <Stack spacing={1.5}>
      <Paper
        variant="outlined"
        sx={{
          aspectRatio: "1",
          bgcolor: "action.hover",
          backgroundImage: main ? `url(${main})` : undefined,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {images.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          {images.map((image) => (
            <Box
              key={image.id}
              onClick={() => onSelect(image.url)}
              sx={{
                width: 64,
                height: 64,
                cursor: "pointer",
                borderRadius: 1,
                border: 2,
                borderColor: image.url === main ? "primary.main" : "divider",
                backgroundImage: `url(${image.url})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
```

- [ ] **Step 3: Trang chi tiết (khung + tab Mô tả/Thông số)**

`src/pages/ProductDetailPage.tsx`:

```tsx
import { Suspense, useState, type ReactElement } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useProductDetail } from "../features/products/hooks/useProductDetail";
import { ProductGallery } from "../features/products/components/ProductGallery";
import { galleryImages } from "../features/products/utils/product";

function DetailSkeleton(): ReactElement {
  return (
    <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      <Skeleton variant="rounded" sx={{ flex: "1 1 320px", aspectRatio: "1" }} />
      <Skeleton variant="rounded" sx={{ flex: "1 1 320px", height: 320 }} />
    </Box>
  );
}

function ProductDetail({ slug }: { slug: string }): ReactElement {
  const product = useProductDetail(slug);
  const images = galleryImages(product);
  const [activeUrl, setActiveUrl] = useState<string | undefined>(images[0]?.url);
  const [tab, setTab] = useState(0);

  return (
    <Stack spacing={4}>
      <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
          <ProductGallery images={images} activeUrl={activeUrl} onSelect={setActiveUrl} />
        </Box>
        <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            {product.name}
          </Typography>
          {/* Panel mua hàng lắp ở Task 9 */}
        </Box>
      </Box>

      <Box>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
          <Tab label="Mô tả" />
          <Tab label="Thông số" />
          <Tab label="Đánh giá" />
        </Tabs>

        {tab === 0 && (
          // Text thuần, KHÔNG dangerouslySetInnerHTML: repo chưa có sanitizer và
          // mô tả do admin nhập vẫn là dữ liệu không đáng tin.
          <Typography sx={{ whiteSpace: "pre-wrap" }} color="text.secondary">
            {product.description || "Chưa có mô tả."}
          </Typography>
        )}
        {tab === 1 && <Typography color="text.secondary">Lắp ở Task 9.</Typography>}
        {tab === 2 && <Typography color="text.secondary">Lắp ở Task 10.</Typography>}
      </Box>
    </Stack>
  );
}

/** Slug sai → backend 404 → RouteErrorAlert bắt. Màn này chỉ lo trường hợp
 *  không có slug trên URL, hiếm nhưng route param vẫn là optional theo kiểu. */
export function ProductDetailPage(): ReactElement {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography sx={{ mb: 2 }}>Sản phẩm không tồn tại.</Typography>
        <Button component={RouterLink} to="/products" variant="contained">
          Xem tất cả sản phẩm
        </Button>
      </Paper>
    );
  }

  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ProductDetail slug={slug} />
    </Suspense>
  );
}
```

- [ ] **Step 4: Gắn route**

Trong `src/router.tsx`, thêm lazy:

```tsx
const ProductDetailPage = lazy(() =>
  import("./pages/ProductDetailPage").then((m) => ({
    default: m.ProductDetailPage,
  })),
);
```

Và route ngay sau route `products`:

```tsx
{
  path: "products/:slug",
  element: <ProductDetailPage />,
  errorElement: <RouteErrorAlert />,
},
```

- [ ] **Step 5: Kiểm chứng trên trình duyệt**

1. Bấm một thẻ ở `/products` → sang trang chi tiết, ảnh và tên đúng.
2. Bấm thumbnail → ảnh lớn đổi.
3. Mở `/products/khong-ton-tai` → hiện thông báo lỗi của `RouteErrorAlert`, không phải màn trắng.

- [ ] **Step 6: Chốt task**

Run: `npm run build && npm run lint && npm run test`

---

### Task 9: Chọn phiên bản và panel mua hàng

**Files:**
- Create: `src/features/products/hooks/useVariantSelection.ts`
- Create: `src/features/products/components/VariantPicker.tsx`
- Create: `src/features/products/components/PurchasePanel.tsx`
- Create: `src/features/products/components/SpecTable.tsx`
- Modify: `src/pages/ProductDetailPage.tsx`

**Interfaces:**
- Consumes: `variantMatrix` (Task 3), `activeVariants` (Task 4)
- Produces: `useVariantSelection(product)` trả `{ dimensions, selection, selected, variants, choose }`; `<VariantPicker />`; `<PurchasePanel />`; `<SpecTable />`

- [ ] **Step 1: Hook chọn variant**

`src/features/products/hooks/useVariantSelection.ts`:

```ts
import { useCallback, useMemo, useState } from "react";
import { activeVariants } from "../utils/product";
import {
  buildDimensions,
  defaultVariant,
  matchVariant,
  reconcileSelection,
  selectionOf,
} from "../utils/variantMatrix";
import type {
  DimensionGroup,
  VariantDimension,
  VariantSelection,
} from "../utils/variantMatrix";
import type { Product, ProductVariant } from "../types";

export interface UseVariantSelectionResult {
  variants: ProductVariant[];
  dimensions: DimensionGroup[];
  selection: VariantSelection;
  selected: ProductVariant | null;
  choose: (dimension: VariantDimension, value: string) => void;
}

export function useVariantSelection(product: Product): UseVariantSelectionResult {
  // BẮT BUỘC lọc: endpoint chi tiết trả cả variant đã tắt.
  const variants = useMemo(() => activeVariants(product), [product]);
  const dimensions = useMemo(() => buildDimensions(variants), [variants]);

  const [selection, setSelection] = useState<VariantSelection>(() => {
    const initial = defaultVariant(variants);
    return initial ? selectionOf(initial, dimensions) : {};
  });

  const choose = useCallback(
    (dimension: VariantDimension, value: string) => {
      setSelection((current) =>
        reconcileSelection(variants, dimensions, current, dimension, value),
      );
    },
    [variants, dimensions],
  );

  const selected = matchVariant(variants, dimensions, selection);

  return { variants, dimensions, selection, selected, choose };
}
```

- [ ] **Step 2: VariantPicker**

`src/features/products/components/VariantPicker.tsx`:

```tsx
import type { ReactElement } from "react";
import { Chip, Stack, Typography } from "@mui/material";
import { isValueAvailable, isValueInStock } from "../utils/variantMatrix";
import type {
  DimensionGroup,
  VariantDimension,
  VariantSelection,
} from "../utils/variantMatrix";
import type { ProductVariant } from "../types";

interface Props {
  variants: ProductVariant[];
  dimensions: DimensionGroup[];
  selection: VariantSelection;
  onChoose: (dimension: VariantDimension, value: string) => void;
}

export function VariantPicker({
  variants,
  dimensions,
  selection,
  onChoose,
}: Props): ReactElement {
  return (
    <Stack spacing={2}>
      {dimensions.map((group) => (
        <Stack key={group.dimension} spacing={1}>
          <Typography variant="subtitle2">{group.label}</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {group.values.map((value) => {
              const available = isValueAvailable(
                variants,
                dimensions,
                selection,
                group.dimension,
                value,
              );
              const inStock = isValueInStock(
                variants,
                dimensions,
                selection,
                group.dimension,
                value,
              );
              return (
                <Chip
                  key={value}
                  label={value}
                  clickable={available}
                  disabled={!available}
                  color={selection[group.dimension] === value ? "primary" : "default"}
                  variant={selection[group.dimension] === value ? "filled" : "outlined"}
                  onClick={() => onChoose(group.dimension, value)}
                  // Còn tổ hợp nhưng hết hàng: làm mờ mà vẫn bấm được, để khách
                  // biết bản đó tồn tại chứ không tưởng shop không bán.
                  sx={{ opacity: available && !inStock ? 0.5 : 1 }}
                />
              );
            })}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
```

- [ ] **Step 3: PurchasePanel**

`src/features/products/components/PurchasePanel.tsx`:

```tsx
import { useEffect, useState, type ReactElement } from "react";
import { Button, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { formatVND } from "../../../lib/format";
import type { ProductVariant } from "../types";

export function PurchasePanel({
  variant,
}: {
  variant: ProductVariant | null;
}): ReactElement {
  const [quantity, setQuantity] = useState(1);

  // Đổi variant thì số lượng cũ có thể vượt tồn kho mới.
  useEffect(() => {
    setQuantity(1);
  }, [variant?.id]);

  if (!variant) {
    return <Typography color="text.secondary">Phiên bản này hiện không bán.</Typography>;
  }

  const hasDiscount = Number(variant.salePrice) < Number(variant.originalPrice);
  const soldOut = variant.stock === 0;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline" }}>
        <Typography variant="h5" color="primary" sx={{ fontWeight: 700 }}>
          {formatVND(variant.salePrice)}
        </Typography>
        {hasDiscount && (
          <Typography color="text.disabled" sx={{ textDecoration: "line-through" }}>
            {formatVND(variant.originalPrice)}
          </Typography>
        )}
      </Stack>

      <Typography variant="body2" color={soldOut ? "error" : "text.secondary"}>
        {soldOut ? "Hết hàng" : `Còn ${variant.stock} sản phẩm`}
      </Typography>

      <TextField
        size="small"
        type="number"
        label="Số lượng"
        value={quantity}
        disabled={soldOut}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          setQuantity(Math.min(variant.stock, Math.max(1, Math.floor(next))));
        }}
        sx={{ maxWidth: 140 }}
      />

      {/* Mở khoá ở mục 2 (giỏ hàng) — chưa gọi API nào. */}
      <Tooltip title="Chức năng giỏ hàng sắp có">
        <span>
          <Button variant="contained" size="large" disabled fullWidth>
            Thêm vào giỏ
          </Button>
        </span>
      </Tooltip>
    </Stack>
  );
}
```

- [ ] **Step 4: SpecTable**

`src/features/products/components/SpecTable.tsx`:

```tsx
import type { ReactElement } from "react";
import { Table, TableBody, TableCell, TableRow } from "@mui/material";
import type { Product, ProductVariant } from "../types";

export function SpecTable({
  product,
  variant,
}: {
  product: Product;
  variant: ProductVariant | null;
}): ReactElement {
  const rows: [string, string][] = [
    ["Danh mục", product.category?.name ?? "—"],
    ["Thương hiệu", product.brand?.name ?? "—"],
    ["SKU", variant?.sku ?? "—"],
    ["Dung lượng", variant?.storage ?? "—"],
    ["RAM", variant?.ram ?? "—"],
    ["Màu sắc", variant?.color ?? "—"],
  ];

  return (
    <Table size="small">
      <TableBody>
        {rows.map(([label, value]) => (
          <TableRow key={label}>
            <TableCell sx={{ width: 180, color: "text.secondary" }}>{label}</TableCell>
            <TableCell>{value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 5: Lắp vào trang chi tiết**

Trong `src/pages/ProductDetailPage.tsx`, thêm import:

```tsx
import { useVariantSelection } from "../features/products/hooks/useVariantSelection";
import { VariantPicker } from "../features/products/components/VariantPicker";
import { PurchasePanel } from "../features/products/components/PurchasePanel";
import { SpecTable } from "../features/products/components/SpecTable";
```

Trong `ProductDetail`, thêm ngay sau dòng `const product = useProductDetail(slug);`:

```tsx
const { variants, dimensions, selection, selected, choose } =
  useVariantSelection(product);
```

**Xoá** dòng của Task 8:

```tsx
const [activeUrl, setActiveUrl] = useState<string | undefined>(images[0]?.url);
```

**Thay bằng** hai dòng sau, để variant có ảnh riêng thì gallery tự nhảy theo mà
người dùng bấm thumbnail vẫn được ưu tiên:

```tsx
const [pickedUrl, setPickedUrl] = useState<string | undefined>(undefined);
const activeUrl = pickedUrl ?? selected?.imageUrl ?? images[0]?.url;
```

Và đổi prop của `<ProductGallery>` từ `onSelect={setActiveUrl}` thành
`onSelect={setPickedUrl}`.

Thay comment `{/* Panel mua hàng lắp ở Task 9 */}` bằng:

```tsx
<Stack spacing={3}>
  {dimensions.length > 0 && (
    <VariantPicker
      variants={variants}
      dimensions={dimensions}
      selection={selection}
      onChoose={choose}
    />
  )}
  <PurchasePanel variant={selected} />
</Stack>
```

Thay nội dung tab 1:

```tsx
{tab === 1 && <SpecTable product={product} variant={selected} />}
```

- [ ] **Step 6: Kiểm chứng trên trình duyệt**

1. Sản phẩm nhiều variant: đổi dung lượng → giá và tồn kho đổi.
2. Tổ hợp không tồn tại → chip bị disable, không bấm được.
3. Đổi trục làm tổ hợp cũ vô hiệu → tự nhảy sang tổ hợp hợp lệ, không kẹt.
4. Sản phẩm chỉ có một variant → không hiện nhóm chip nào, panel vẫn đúng giá.

- [ ] **Step 7: Chốt task**

Run: `npm run build && npm run lint && npm run test`

---

### Task 10: Khối đánh giá công khai

**Files:**
- Modify: `src/features/reviews/types/index.ts`
- Modify: `src/features/reviews/api/reviewsApi.ts`
- Modify: `src/features/reviews/api/queries.ts`
- Create: `src/features/reviews/hooks/useProductReviews.ts`
- Create: `src/features/reviews/components/RatingSummary.tsx`
- Create: `src/features/reviews/components/ProductReviewList.tsx`
- Modify: `src/pages/ProductDetailPage.tsx`

**Interfaces:**
- Produces: `PublicReview`, `ReviewSummary`, `PublicReviewListResult`, `reviewsApi.listByProduct()`, `reviewsApi.getSummary()`, `reviewsApi.markHelpful()`, `productReviewKeys`, `useProductReviews(slug)`

- [ ] **Step 1: Thêm kiểu review công khai**

Thêm vào cuối `src/features/reviews/types/index.ts`:

```ts
/** Review công khai — khớp REVIEW_PUBLIC_SELECT trong review.service.ts. */
export interface PublicReview {
  id: string;
  rating: number;
  content: string;
  replyContent: string | null;
  repliedAt: string | null;
  createdAt: string;
  orderItem: {
    color: string | null;
    storage: string | null;
    ram: string | null;
    sku: string;
  } | null;
  user: { id: string; fullName: string; avatarUrl: string | null } | null;
  photos: { id: string; url: string }[];
  _count: { helpful: number };
}

export interface PublicReviewListResult {
  reviews: PublicReview[];
  pagination: PaginationMeta;
}

/** breakdown luôn đủ 5 khoá "1".."5" — backend khởi tạo sẵn. */
export interface ReviewSummary {
  averageRating: number;
  totalCount: number;
  breakdown: Record<string, number>;
  withPhotoCount: number;
}
```

- [ ] **Step 2: Thêm hàm API**

Thêm vào object `reviewsApi` trong `src/features/reviews/api/reviewsApi.ts`:

```ts
  // Public — GET /products/:slug/reviews trả thẳng { reviews, pagination }.
  async listByProduct(
    slug: string,
    page: number,
  ): Promise<PublicReviewListResult> {
    const { data } = await apiClient.get<PublicReviewListResult>(
      `/products/${slug}/reviews`,
      { params: { page } },
    );
    return data;
  },

  async getSummary(slug: string): Promise<ReviewSummary> {
    const { data } = await apiClient.get<ReviewSummary>(
      `/products/${slug}/reviews/summary`,
    );
    return data;
  },

  // Toggle: gọi lần hai sẽ bỏ đánh dấu. Cần đăng nhập.
  async markHelpful(id: string): Promise<{ helpful: boolean; count: number }> {
    const { data } = await apiClient.post<{ helpful: boolean; count: number }>(
      `/reviews/${id}/helpful`,
    );
    return data;
  },
```

Bổ sung import kiểu ở đầu file: `PublicReviewListResult`, `ReviewSummary`.

- [ ] **Step 3: queryOptions cho review công khai**

Thêm vào `src/features/reviews/api/queries.ts`:

```ts
export const productReviewKeys = {
  all: ["product-reviews"] as const,
  list: (slug: string, page: number) =>
    [...productReviewKeys.all, slug, "list", page] as const,
  summary: (slug: string) =>
    [...productReviewKeys.all, slug, "summary"] as const,
};

// Không USER_SCOPED: review công khai ai xem cũng như nhau.
export const productReviewListQueryOptions = (slug: string, page: number) =>
  queryOptions({
    queryKey: productReviewKeys.list(slug, page),
    queryFn: () => reviewsApi.listByProduct(slug, page),
  });

export const productReviewSummaryQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: productReviewKeys.summary(slug),
    queryFn: () => reviewsApi.getSummary(slug),
  });
```

- [ ] **Step 4: Hook**

`src/features/reviews/hooks/useProductReviews.ts`:

```ts
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useAuth } from "../../auth/hooks/useAuth";
import { reviewsApi } from "../api/reviewsApi";
import {
  productReviewKeys,
  productReviewListQueryOptions,
  productReviewSummaryQueryOptions,
} from "../api/queries";
import type { PublicReviewListResult, ReviewSummary } from "../types";

export interface UseProductReviewsResult {
  page: number;
  setPage: (page: number) => void;
  list: UseQueryResult<PublicReviewListResult, Error>;
  summary: UseQueryResult<ReviewSummary, Error>;
  toggleHelpful: (id: string) => void;
  isVoting: boolean;
}

/**
 * Phân trang review giữ ở state cục bộ, KHÔNG đẩy lên URL: URL của trang chi
 * tiết chỉ nên mang slug, thêm page review vào sẽ làm bẩn link chia sẻ sản phẩm.
 */
export function useProductReviews(slug: string): UseProductReviewsResult {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const list = useQuery(productReviewListQueryOptions(slug, page));
  const summary = useQuery(productReviewSummaryQueryOptions(slug));

  const helpful = useMutation({
    mutationFn: (id: string) => reviewsApi.markHelpful(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productReviewKeys.all });
    },
  });

  const toggleHelpful = (id: string) => {
    if (!isAuthenticated) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirect}`);
      return;
    }
    helpful.mutate(id);
  };

  return { page, setPage, list, summary, toggleHelpful, isVoting: helpful.isPending };
}
```

- [ ] **Step 5: RatingSummary**

`src/features/reviews/components/RatingSummary.tsx`:

```tsx
import type { ReactElement } from "react";
import { Box, LinearProgress, Rating, Stack, Typography } from "@mui/material";
import type { ReviewSummary } from "../types";

export function RatingSummary({ summary }: { summary: ReviewSummary }): ReactElement {
  return (
    <Stack direction="row" spacing={4} sx={{ flexWrap: "wrap", gap: 2 }}>
      <Stack sx={{ alignItems: "center", minWidth: 140 }}>
        <Typography variant="h3" sx={{ fontWeight: 700 }}>
          {summary.averageRating.toFixed(1)}
        </Typography>
        <Rating value={summary.averageRating} precision={0.1} readOnly />
        <Typography variant="body2" color="text.secondary">
          {summary.totalCount} đánh giá · {summary.withPhotoCount} có ảnh
        </Typography>
      </Stack>

      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 220 }}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = summary.breakdown[String(star)] ?? 0;
          const percent = summary.totalCount === 0 ? 0 : (count / summary.totalCount) * 100;
          return (
            <Stack key={star} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="body2" sx={{ width: 24 }}>
                {star}★
              </Typography>
              <Box sx={{ flex: 1 }}>
                <LinearProgress variant="determinate" value={percent} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ width: 32 }}>
                {count}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 6: Danh sách review**

`src/features/reviews/components/ProductReviewList.tsx`:

```tsx
import type { ReactElement } from "react";
import {
  Avatar,
  Box,
  Button,
  Divider,
  Pagination,
  Paper,
  Rating,
  Stack,
  Typography,
} from "@mui/material";
import { ThumbsUp } from "lucide-react";
import { formatDate } from "../../../lib/format";
import type { PublicReview, PaginationMeta } from "../types";

interface Props {
  reviews: PublicReview[];
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onHelpful: (id: string) => void;
  isVoting: boolean;
}

function variantLabel(review: PublicReview): string {
  const parts = [review.orderItem?.storage, review.orderItem?.ram, review.orderItem?.color];
  return parts.filter(Boolean).join(" · ");
}

export function ProductReviewList({
  reviews,
  pagination,
  onPageChange,
  onHelpful,
  isVoting,
}: Props): ReactElement {
  if (reviews.length === 0) {
    return (
      <Typography color="text.secondary">
        Chưa có đánh giá nào cho sản phẩm này.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {reviews.map((review) => (
        <Paper key={review.id} variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.5}>
            <Avatar src={review.user?.avatarUrl ?? undefined}>
              {review.user?.fullName?.[0] ?? "?"}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600 }}>
                {review.user?.fullName ?? "Khách"}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Rating value={review.rating} size="small" readOnly />
                <Typography variant="caption" color="text.secondary">
                  {formatDate(review.createdAt)}
                </Typography>
              </Stack>
              {variantLabel(review) && (
                <Typography variant="caption" color="text.secondary">
                  Phiên bản: {variantLabel(review)}
                </Typography>
              )}

              <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
                {review.content}
              </Typography>

              {review.photos.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
                  {review.photos.map((photo) => (
                    <Box
                      key={photo.id}
                      component="img"
                      src={photo.url}
                      alt=""
                      sx={{ width: 72, height: 72, objectFit: "cover", borderRadius: 1 }}
                    />
                  ))}
                </Stack>
              )}

              {review.replyContent && (
                <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, bgcolor: "action.hover" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Phản hồi từ shop
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {review.replyContent}
                  </Typography>
                </Paper>
              )}

              <Divider sx={{ my: 1.5 }} />
              <Button
                size="small"
                startIcon={<ThumbsUp size={16} />}
                disabled={isVoting}
                onClick={() => onHelpful(review.id)}
              >
                Hữu ích ({review._count.helpful})
              </Button>
            </Box>
          </Stack>
        </Paper>
      ))}

      {pagination.totalPages > 1 && (
        <Stack sx={{ alignItems: "center" }}>
          <Pagination
            page={pagination.page}
            count={pagination.totalPages}
            onChange={(_, page) => onPageChange(page)}
          />
        </Stack>
      )}
    </Stack>
  );
}
```

- [ ] **Step 7: Lắp tab Đánh giá**

Trong `src/pages/ProductDetailPage.tsx`, thêm import:

```tsx
import { useProductReviews } from "../features/reviews/hooks/useProductReviews";
import { RatingSummary } from "../features/reviews/components/RatingSummary";
import { ProductReviewList } from "../features/reviews/components/ProductReviewList";
```

Thêm một component con để phần review không kéo cả trang render lại:

```tsx
function ReviewSection({ slug }: { slug: string }): ReactElement {
  const { setPage, list, summary, toggleHelpful, isVoting } = useProductReviews(slug);

  if (list.isPending || summary.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }
  if (list.isError || summary.isError || !list.data || !summary.data) {
    return <Typography color="error">Không tải được đánh giá.</Typography>;
  }

  return (
    <Stack spacing={3}>
      <RatingSummary summary={summary.data} />
      <ProductReviewList
        reviews={list.data.reviews}
        pagination={list.data.pagination}
        onPageChange={setPage}
        onHelpful={toggleHelpful}
        isVoting={isVoting}
      />
    </Stack>
  );
}
```

Thay nội dung tab 2:

```tsx
{tab === 2 && <ReviewSection slug={slug} />}
```

- [ ] **Step 8: Kiểm chứng trên trình duyệt**

1. Tab Đánh giá hiện điểm trung bình và phân bố sao khớp dữ liệu.
2. Sản phẩm chưa có đánh giá → hiện dòng "Chưa có đánh giá nào", không lỗi.
3. Chưa đăng nhập bấm Hữu ích → sang `/login?redirect=...`, đăng nhập xong quay lại đúng trang.
4. Đã đăng nhập bấm Hữu ích → số đếm tăng; bấm lần nữa → giảm về cũ.

- [ ] **Step 9: Chốt task**

Run: `npm run build && npm run lint && npm run test`

---

### Task 11: Rà soát cuối và tick ROADMAP

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: Chạy trọn checklist kiểm chứng của spec**

Theo mục 9 của [spec](../specs/2026-08-09-products-feature-design.md), làm đủ 8 mục, ghi lại mục nào hỏng.

- [ ] **Step 2: Kiểm tra chunk tách đúng**

Run: `npm run build`
Expected: output liệt kê chunk riêng cho `ProductsPage` và `ProductDetailPage` — nếu chúng nằm trong chunk chính thì có chỗ nào đó import tĩnh, phải sửa về `lazy()`.

- [ ] **Step 3: Tick mục 1 trong ROADMAP**

Trong `ROADMAP.md`, đổi hai dòng của mục 1 từ `- [ ]` sang `- [x]`, và chuyển hai dòng đó lên phần "Đã có" nếu muốn giữ bố cục cũ.

- [ ] **Step 4: Chốt**

Run: `npm run build && npm run lint && npm run test`

---

## Ghi chú cho người triển khai

- **Không tự thêm sort theo giá.** Backend không hỗ trợ; muốn có thì làm task backend riêng.
- **Không tự bật `dangerouslySetInnerHTML`** cho mô tả sản phẩm. Cần sanitizer trước.
- **Không nối chức năng thêm vào giỏ.** Đó là mục 2 của ROADMAP.
- Gặp shape dữ liệu khác spec thì đọc lại service bên `be_mobivexa` rồi sửa **spec trước**, sau đó mới sửa code.
