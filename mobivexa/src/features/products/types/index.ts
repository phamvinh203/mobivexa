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

/** Dạng rút gọn của category/brand. Endpoint danh sách select đúng
 *  id,name,slug; endpoint chi tiết dùng `category: true` nên trả full record —
 *  FE chủ động thu hẹp về 3 field này vì UI không cần thêm gì. */
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
  /** Endpoint danh sách chỉ trả 0..1 ảnh bìa (where isCover, take 1); endpoint
   *  chi tiết trả đủ ảnh đã sort theo sortOrder. Đừng dựng gallery từ dữ liệu
   *  trang danh sách — sẽ chỉ có đúng một ảnh. */
  images?: ProductImage[];
  /** CHÚ Ý: endpoint chi tiết trả cả variant isActive=false — luôn lọc qua
   *  activeVariants() (utils/product.ts, Task 4) trước khi hiển thị. Endpoint
   *  danh sách thì đã lọc sẵn. */
  variants?: ProductVariant[];
  /** CHỈ có ở endpoint chi tiết. Endpoint danh sách không include productTags,
   *  nên ở trang danh sách field này LUÔN undefined — ProductCard đừng render
   *  chip tag, sẽ không bao giờ hiện. Backend trả productTags[{ tag }], không
   *  phải mảng tag phẳng. */
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
