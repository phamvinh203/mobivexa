import { describe, expect, it } from "vitest";
import { parseProductQuery, toSearchParams } from "./productQuery";
import type { ProductListQuery } from "../types";

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

  // Backend dịch minPrice thành `salePrice gte`, nên gte 0 khớp mọi sản phẩm —
  // đúng bằng không truyền gì. Giữ lại sẽ băm ra một cache entry thừa mỗi lần
  // slider giá nằm ở đáy.
  it("bỏ minPrice=0 vì không phải cận dưới thật", () => {
    expect(parseProductQuery(new URLSearchParams("minPrice=0"))).toEqual({});
  });

  // Cố ý BẤT ĐỐI XỨNG với minPrice. maxPrice=0 tới backend là chuỗi "0" (xem
  // be_mobivexa/src/types/product.type.ts: maxPrice?: string) nên qua được
  // `if (query.maxPrice)` và thành `salePrice lte 0` — một bộ lọc có nghĩa dù
  // cho kết quả rỗng. Test này chặn việc "sửa cho nhất quán" với minPrice.
  it("giữ maxPrice=0 vì đó là bộ lọc có nghĩa", () => {
    expect(parseProductQuery(new URLSearchParams("maxPrice=0"))).toEqual({
      maxPrice: 0,
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

  it("chỉ ghi khoá trong danh sách, bỏ key lạ", () => {
    // ListQuery có index signature nên TS không bắt được filter gõ sai tên.
    // Test này là thứ duy nhất chặn ai đó đổi sang Object.entries.
    const dirty: ProductListQuery = {
      brand: "apple",
      categorySlug: "dien-thoai",
      isFeatured: true,
    };
    expect(toSearchParams(dirty).toString()).toBe("brand=apple");
  });

  it("ghi đủ tám khoá hợp lệ", () => {
    const params = toSearchParams({
      search: "iphone",
      category: "dien-thoai",
      brand: "apple",
      tag: "hot",
      minPrice: 1000,
      maxPrice: 2000,
      sort: "name_asc",
      page: 3,
    });
    expect(params.toString()).toBe(
      "search=iphone&category=dien-thoai&brand=apple&tag=hot" +
        "&minPrice=1000&maxPrice=2000&sort=name_asc&page=3",
    );
  });

  it("khứ hồi ngược: query đầy đủ → URL → query", () => {
    const query: ProductListQuery = {
      search: "iphone",
      category: "dien-thoai",
      brand: "apple",
      tag: "hot",
      minPrice: 1000,
      maxPrice: 2000,
      sort: "name_asc",
      page: 3,
    };
    expect(parseProductQuery(toSearchParams(query))).toEqual(query);
  });
});
