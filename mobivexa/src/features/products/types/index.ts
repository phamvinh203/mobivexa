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
