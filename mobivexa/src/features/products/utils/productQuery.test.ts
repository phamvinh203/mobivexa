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
