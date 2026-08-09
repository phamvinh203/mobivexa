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
