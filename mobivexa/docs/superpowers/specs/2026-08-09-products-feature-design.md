# Thiết kế: feature `products` — trang danh sách và trang chi tiết

Ngày: 2026-08-09 · Phạm vi: mục 1 của [ROADMAP.md](../../../ROADMAP.md) · App: `mobivexa` (Vite SPA)

## 1. Mục tiêu

Dựng hai trang công khai:

- `/products` — danh sách sản phẩm có tìm kiếm, lọc, sắp xếp, phân trang.
- `/products/:slug` — chi tiết sản phẩm: gallery, chọn phiên bản, mô tả, thông số, đánh giá.

Hai trang này là cửa vào của toàn bộ luồng mua hàng. Mục 2 (giỏ hàng) phụ thuộc trực tiếp
vào `ProductCard` và panel mua ở đây.

## 2. Ràng buộc từ backend

Đọc từ `be_mobivexa/src/routes/product.route.ts`, `review.route.ts`, `services/product.service.ts`,
`services/review.service.ts`. **Đây là sự thật, không phải giả định — mọi thiết kế bên dưới bám theo mục này.**

### `GET /api/products`

Trả thẳng `{ products, pagination }` (không có lớp bọc `data`).

| Tham số | Kiểu | Ghi chú |
|---|---|---|
| `page` | number | mặc định 1 |
| `limit` | number | mặc định **12**, tối đa 50 |
| `search` | string | full-text `to_tsquery` trên `name`, **không** tìm trong mô tả |
| `category` | **slug** | không phải id |
| `brand` | **slug** | không phải id |
| `tag` | **slug** | có hỗ trợ, mục 1 không dựng UI nhưng vẫn nhận từ URL |
| `minPrice` / `maxPrice` | number | lọc "có **ít nhất một** variant nằm trong khoảng" |
| `sort` | enum | chỉ `newest` (mặc định) · `oldest` · `name_asc` · `name_desc` |

Mỗi `product` trong danh sách chỉ kèm: `category`/`brand` dạng rút gọn (`id,name,slug`),
`variants` **đã lọc `isActive`** và sort `salePrice` tăng dần, `images` **chỉ 1 ảnh bìa**.

Chuỗi `search` không tách được token hợp lệ → backend trả mảng rỗng, không lỗi.

### `GET /api/products/:slug`

Trả `{ product }`. 404 nếu không tồn tại **hoặc** `isActive = false`.

Include đầy đủ: `category`, `brand`, `variants` sort theo `salePrice` tăng dần,
`productTags[{ tag }]`, `images` sort `sortOrder`.

**Bẫy:** khác với danh sách, chi tiết trả về **mọi variant kể cả `isActive = false`**.
Frontend phải tự lọc.

### `GET /api/products/:slug/reviews`

Trả `{ reviews, pagination }`. Chỉ review `APPROVED`. Mặc định `limit` 10.

Tham số: `page`, `limit`, `rating` (1–5), `hasPhoto=true`, `sort=helpful` (mặc định mới nhất).

Mỗi review: `id`, `rating`, `content`, `replyContent`, `repliedAt`, `createdAt`,
`orderItem { color, storage, ram, sku }`, `user { id, fullName, avatarUrl }`,
`photos [{ id, url }]`, `_count { helpful }`.

### `GET /api/products/:slug/reviews/summary`

Trả thẳng `{ averageRating, totalCount, breakdown, withPhotoCount }`.
`breakdown` là object `{ "1": n, ..., "5": n }`, luôn đủ 5 khoá.

### `POST /api/reviews/:id/helpful`

Cần đăng nhập. Trả `{ helpful: boolean, count: number }`. Là **toggle**, gọi lần hai sẽ bỏ.

### Giới hạn đã biết

- **Không sort được theo giá.** `resolveSort()` chỉ có 4 nhánh; giá nằm ở bảng
  `product_variants` (1-n) nên Prisma không `orderBy` theo min của quan hệ. Việc thêm
  `price_asc`/`price_desc` là task backend riêng, ngoài phạm vi spec này.
- Không có endpoint "sản phẩm liên quan".
- `Decimal` của Prisma serialize thành **chuỗi** trong JSON → dùng `Money` của
  [lib/format.ts](../../../src/lib/format.ts), đừng giả định là number.

## 3. Hướng tiếp cận đã chọn

**URL là nguồn sự thật cho trạng thái lọc, dữ liệu nạp bằng `useSuspenseQuery`.**

`/products?search=iphone&brand=apple&minPrice=10000000&page=2` — filter đọc/ghi qua
`useSearchParams`, không có state song song. Query key sinh từ object parse ra từ URL nên
đổi filter là React Query tự fetch, không cần `useEffect` đồng bộ.

Đánh đổi: phải viết thêm một lớp parse/serialize query string. Đổi lại được ba thứ khách
thực sự cần ở trang catalog — share link đã lọc, back/forward đúng, F5 giữ nguyên kết quả.

Hai hướng đã cân nhắc và loại:

- **State cục bộ + `useQuery`** — ít code hơn nhưng mất cả ba thứ trên.
- **Route loader + `ensureQueryData`** — nhanh hơn một nhịp, nhưng router hiện chưa dùng
  loader ở bất kỳ route nào. Thêm cho riêng một page sẽ tạo hai kiểu nạp dữ liệu song song.
  Khi nào chuyển thì chuyển cả loạt.

## 4. Ranh giới feature

Trang danh sách cần đổ dropdown danh mục và thương hiệu, tức cần `GET /categories` và
`GET /brands`. Đặt hai API đó trong `features/products` là sai domain, nên tạo trước hai
feature mỏng:

```
src/features/categories/   api + queries + types      (chưa có page; mục 5 thêm sau)
src/features/brands/       api + queries + types
src/features/products/     đầy đủ
src/features/reviews/      mở rộng thêm phần review công khai
```

`features/reviews` đã có sẵn cho "đánh giá của tôi". Review công khai cùng domain nên mở
rộng file hiện có, không tạo feature thứ hai tên na ná.

## 5. Cấu trúc `features/products`

```
api/productsApi.ts       list(query) · detail(slug)
api/queries.ts           productKeys + queryOptions
utils/productQuery.ts    parseProductQuery · toSearchParams
utils/variantMatrix.ts   port từ fe_mobivexa, logic thuần
utils/product.ts         coverImageUrl · galleryImages · priceRange · totalStock · activeVariants
hooks/useProductList.ts
hooks/useProductDetail.ts
hooks/useVariantSelection.ts
components/ProductCard.tsx · ProductGrid.tsx · ProductFilters.tsx · ProductSort.tsx
components/ProductGallery.tsx · VariantPicker.tsx · PurchasePanel.tsx · SpecTable.tsx
types/index.ts
```

Trang: `src/pages/ProductsPage.tsx`, `src/pages/ProductDetailPage.tsx` — export tên, nạp
`lazy()` trong [router.tsx](../../../src/router.tsx).

### Tầng API

Unwrap ngay trong `productsApi.ts` theo đúng controller: `list` trả nguyên
`{ products, pagination }`, `detail` bóc `{ product }` → `Product`.

`GET /products/featured` **không** làm ở mục này — trang chủ thuộc mục 5, thêm hàm
`featured()` vào cùng file khi tới đó.

### Query key

```
productKeys.all           = ["products"]
productKeys.list(query)   = [...all, "list", query]
productKeys.detail(slug)  = [...all, "detail", slug]
```

**Không** gắn `USER_SCOPED` — dữ liệu công khai, đăng xuất không cần xoá.
`staleTime` 30s mặc định của `queryClient` là hợp lý, không override.

### `utils/productQuery.ts`

Ranh giới duy nhất giữa URL và React Query.

- `parseProductQuery(params: URLSearchParams): ProductListQuery` — chỉ nhận khoá hợp lệ, ép
  số cho `page`/`minPrice`/`maxPrice`, `sort` chỉ chấp nhận 4 giá trị backend hiểu, `page`
  clamp về ≥ 1. Giá trị rác trên URL bị bỏ qua chứ không làm vỡ trang.
- `toSearchParams(query: ProductListQuery): URLSearchParams` — bỏ field rỗng/undefined để
  URL sạch, không sinh `?page=1&search=`.

Ràng buộc dễ bỏ sót: object trả về phải **chuẩn hoá**, vì nó nằm trong `queryKey`.
`hashKey` của TanStack Query (`node_modules/@tanstack/query-core/src/utils.ts:232`) sắp xếp
khoá trước khi băm và `JSON.stringify` bỏ giá trị `undefined`, nên thứ tự khoá không quan
trọng — nhưng `{ page: 1 }` và `{}` băm ra **hai chuỗi khác nhau**. Vì vậy `?page=1` và URL
không có `page` bắt buộc phải parse ra cùng một object, nếu không hai URL cùng nghĩa sẽ
fetch hai lần và giữ hai cache entry. Áp dụng cho mọi giá trị mặc định: `page`, `sort`,
và chuỗi rỗng.

### `utils/variantMatrix.ts`

Port từ `fe_mobivexa/app/(client)/products/[slug]/_components/variant-matrix.ts`. File này
chỉ import một type nên chuyển sang được gần như nguyên vẹn, chỉ đổi đường dẫn import.

Giữ nguyên API: `buildDimensions`, `matchVariant`, `isValueAvailable`, `isValueInStock`,
`selectionOf`, `defaultVariant`, `reconcileSelection`. Trục hiển thị theo thứ tự
`storage → ram → color`, trục nào toàn `null` thì không hiện.

## 6. Trang `/products`

Sidebar lọc bên trái từ breakpoint `md`; dưới `md` chuyển thành Drawer mở bằng nút "Bộ lọc".

**Bộ lọc:** Danh mục (select, nguồn `GET /categories`) · Thương hiệu (select, nguồn
`GET /brands`) · Khoảng giá (hai ô số + nút Áp dụng).

Tag không có UI ở mục 1 nhưng `parseProductQuery` vẫn đọc `?tag=` để link từ nơi khác vào
vẫn lọc đúng.

**Sắp xếp:** Mới nhất · Cũ nhất · Tên A→Z · Tên Z→A. Không có tuỳ chọn theo giá — xem
mục 2 phần giới hạn.

**Ghi URL:**

- Ô tìm kiếm debounce 400ms rồi mới ghi, và ghi bằng `replace: true` — gõ 10 ký tự không
  được sinh 10 entry history.
- Đổi filter, sort, trang thì `replace: false` để nút back quay lại đúng bước trước.
- Đổi bất kỳ filter nào cũng reset `page` về 1.
- Khoảng giá chỉ ghi khi bấm Áp dụng, không auto-apply theo từng ký tự.

**Hiển thị:** hàng chip liệt kê filter đang bật, mỗi chip xoá được, kèm nút Xoá tất cả.
Phân trang dùng `<Pagination>` của MUI, `limit` 12 đúng mặc định backend.

**Trạng thái rỗng** tách hai trường hợp: chưa có sản phẩm nào, và không khớp bộ lọc (kèm nút
xoá lọc). Gộp chung là bẫy UX quen thuộc — khách tưởng shop trống.

**`ProductCard`:** ảnh bìa (fallback khi `images` rỗng), tên, thương hiệu, khoảng giá
min–max từ `priceRange()`, badge giảm giá khi `salePrice < originalPrice`, nhãn Hết hàng khi
`totalStock() === 0`. Toàn thẻ là link tới `/products/:slug`.

## 7. Trang `/products/:slug`

Bố cục: gallery trái, panel mua phải, bên dưới là tabs Mô tả / Thông số / Đánh giá.

**Gallery** dựng từ `galleryImages()`: ảnh bìa lên đầu, phần còn lại giữ `sortOrder`, bổ
sung `variant.imageUrl` nào chưa có trong bộ ảnh sản phẩm.

**`VariantPicker`** dùng `variantMatrix`, chip theo từng trục:

- Tổ hợp không tồn tại → `disabled`.
- Tồn tại nhưng hết hàng → làm mờ, vẫn bấm được (để khách thấy có bản đó).
- Đổi một trục làm tổ hợp cũ vô hiệu → `reconcileSelection()` hàn lại thay vì để khách kẹt.
- Mặc định chọn `defaultVariant()`: rẻ nhất còn hàng, không có thì rẻ nhất.
- Nguồn variant là `activeVariants(product)` — **bắt buộc lọc**, vì endpoint chi tiết trả cả
  variant đã tắt (xem mục 2).

**`PurchasePanel`:** giá bán của variant đang chọn, giá gốc gạch ngang khi có giảm, tồn kho,
ô số lượng chặn trên theo `stock`.

Nút **Thêm vào giỏ để `disabled`** kèm chú thích "Sắp có" và **không gọi API** — mở khoá ở
mục 2. Ô số lượng vẫn dựng và vẫn chạy ở mục này (nó thuộc về panel, không thuộc về nút),
chỉ là chưa có nơi tiêu thụ giá trị cho tới mục 2.

**Tab Mô tả:** render **text thuần** với `white-space: pre-wrap`. Không dùng
`dangerouslySetInnerHTML`: repo chưa có sanitizer trong dependencies, và mô tả do admin nhập
vẫn là dữ liệu không đáng tin. Muốn render HTML thì thêm DOMPurify — việc riêng, không nhét
vào mục này.

**Tab Thông số:** bảng từ các trục variant đang chọn + danh mục + thương hiệu + SKU.

**Tab Đánh giá:**

- `RatingSummary`: điểm trung bình, phân bố 5 mức từ `breakdown`, tổng số, số đánh giá có ảnh.
- Danh sách phân trang riêng (state cục bộ, **không** đẩy lên URL — URL của trang chi tiết chỉ
  mang `slug`; phân trang review là trạng thái phụ, đưa lên URL sẽ làm bẩn link chia sẻ sản phẩm).
- Mỗi review: avatar, tên, số sao, thời gian, biến thể đã mua từ `orderItem`, ảnh đính kèm,
  phần trả lời của shop khi có `replyContent`.
- Nút Hữu ích gọi `POST /reviews/:id/helpful`, invalidate danh sách review. Chưa đăng nhập thì
  điều hướng `/login?redirect=<đường dẫn hiện tại>` — đúng cơ chế `RequireAuth` đang dùng.

**Slug sai** → backend 404 → hiện màn "Sản phẩm không tồn tại" kèm nút về `/products`, không
phải alert lỗi đỏ.

## 8. Lỗi và trạng thái chờ

Hai route mới gắn `errorElement: <RouteErrorAlert />`. Lỗi 4xx không retry —
[queryClient.ts](../../../src/lib/queryClient.ts) đã cấu hình sẵn `shouldRetry`.

Suspense fallback là skeleton dạng lưới cho `/products` và skeleton hai cột cho trang chi
tiết, mở rộng từ `ListSkeleton` hiện có.

## 9. Kiểm chứng

Bắt buộc: `npm run build` và `npm run lint` sạch.

Checklist thủ công qua skill `chrome-devtools`:

1. Lọc theo danh mục, thương hiệu, khoảng giá — kết quả đổi đúng.
2. Tìm kiếm có dấu và không dấu.
3. Phân trang, rồi F5 — giữ nguyên trang và bộ lọc.
4. Back/forward qua vài bước lọc — trạng thái khớp từng bước.
5. Gõ liên tục vào ô tìm kiếm rồi bấm back một lần — phải về trang trước đó, không phải lùi
   từng ký tự.
6. Slug không tồn tại → màn 404 của trang, không phải lỗi đỏ.
7. Sản phẩm hết hàng, sản phẩm chỉ có một variant, sản phẩm không ảnh.
8. Chưa đăng nhập bấm Hữu ích → sang `/login`, đăng nhập xong quay lại đúng trang.

Repo chưa có test runner. Mục 1 **thêm Vitest** nhưng giới hạn phạm vi ở hai module logic
thuần: `utils/productQuery.ts` và `utils/variantMatrix.ts`. Đây là hai chỗ nhiều trường hợp
biên và sai thầm lặng nhất — chuẩn hoá query mặc định, tổ hợp variant không tồn tại — mà lại
không dính React nên test rẻ. Chi phí: một dev dependency và khoảng mười dòng cấu hình.

Component **không** test tự động ở mục này; kiểm bằng checklist trình duyệt bên trên.

## 10. Ngoài phạm vi

| Việc | Lý do |
|---|---|
| Sắp xếp theo giá | Cần sửa backend, task riêng |
| Thêm vào giỏ | Mục 2 |
| Viết/sửa đánh giá | Mục 7 |
| Sản phẩm liên quan, đã xem gần đây | Không có API |
| Render HTML trong mô tả | Cần thêm sanitizer, quyết định riêng |
| Test component (Testing Library) | Chỉ test hai module logic thuần, xem mục 9 |

## 11. Quyết định đã chốt

1. Bỏ sắp xếp theo giá ở mục 1, ghi thành task backend riêng.
2. Bộ lọc gồm danh mục + thương hiệu + khoảng giá; bỏ UI tag nhưng vẫn đọc `?tag=` từ URL.
3. Trang chi tiết làm đầy đủ, gồm cả khối đánh giá chỉ-đọc kèm nút Hữu ích.
4. URL là nguồn sự thật cho trạng thái lọc (hướng A).
5. Tạo trước hai feature mỏng `categories` và `brands` thay vì nhét API của chúng vào `products`.
6. Port `variantMatrix` từ `fe_mobivexa` thay vì viết lại.
7. Thêm Vitest, nhưng chỉ test `productQuery.ts` và `variantMatrix.ts` — đảo lại quyết định
   ban đầu "không thêm test runner", vì kế hoạch triển khai cần một vòng kiểm chứng tự động
   và hai module này là chỗ đáng test nhất với chi phí thấp nhất.
