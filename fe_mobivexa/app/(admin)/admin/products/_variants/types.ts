import type { VariantPayload } from "@/features/products/types";

/** Dòng variant đang soạn (chưa có id). */
export interface DraftVariant extends VariantPayload {
  key: string;
}

/** Per-row edit buffer cho edit mode (giá trị string cho input binding). */
export type RowEdit = {
  color: string;
  ram: string;
  storage: string;
  sku: string;
  originalPrice: string;
  salePrice: string;
  stock: string;
};

export const VARIANT_HEADERS = [
  "ẢNH",
  "MÀU SẮC",
  "RAM",
  "DUNG LƯỢNG",
  "SKU",
  "GIÁ GỐC",
  "GIÁ BÁN",
  "TỒN KHO",
] as const;
