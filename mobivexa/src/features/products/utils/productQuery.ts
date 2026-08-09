import { PRODUCT_SORTS } from "../types";
import type { ProductListQuery, ProductSort } from "../types";

/** Mặc định của backend. Không ghi vào URL lẫn query object — xem parseSort. */
const DEFAULT_SORT: ProductSort = "newest";

/**
 * Thứ tự đọc/ghi các khoá. Gom một chỗ để parse và serialize không lệch nhau.
 *
 * CỐ Ý không có `limit`, dù `ListQuery` khai báo `limit?: number`: page size do FE
 * cố định theo mặc định 12 của backend, không nhận từ URL — nếu không, ai cũng có
 * thể sửa link thành ?limit=10000 và ép backend trả cả bảng. `toSearchParams` vì
 * thế nuốt `limit` một cách có chủ đích.
 */
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
  // 0 là "không có cận dưới" — giống hệt không truyền gì. Bỏ đi để slider giá
  // kéo về đáy không sinh thêm một cache entry cho cùng một kết quả.
  if (minPrice) query.minPrice = minPrice;

  const maxPrice = parseCount(params.get("maxPrice"));
  // KHÔNG rút gọn thành `if (maxPrice)` cho "nhất quán" với minPrice ở trên:
  // maxPrice=0 tới backend là chuỗi "0" nên lọt qua `if (query.maxPrice)` và
  // thành `salePrice lte 0` — bộ lọc có nghĩa, dù kết quả rỗng.
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
