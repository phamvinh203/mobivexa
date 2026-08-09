# mobivexa — SPA khách hàng

Frontend mua sắm cho khách, gọi API của `../be_mobivexa`. Đây là app **Vite SPA**,
không phải `../fe_mobivexa` (Next.js, chứa cả admin). **Không sửa gì ngoài thư mục này.**

Stack: React 19 · Vite 8 · TypeScript 6 · MUI v9 (+ Emotion) · TanStack Query v5 ·
react-router-dom v7 · axios · lucide-react.
Không có Tailwind, không có shadcn — style bằng MUI `sx` / `styled` và
[theme.ts](src/themes/theme.ts).

## Skill phải dùng

Dự án này dùng skill có sẵn của harness, **không tự chế lại quy trình**. Gọi skill bằng
tool `Skill` trước khi làm, không phải sau.

| Tình huống | Skill |
|---|---|
| Bắt đầu một mục ROADMAP mới, trước khi viết code | `superpowers:brainstorming` |
| Viết feature/page React — pattern TanStack Query, Suspense, lazy, thư mục theo feature | `frontend-development` |
| Thiết kế giao diện page mới (layout, thị giác, không phải logic) | `frontend-design` |
| Gặp bug, test đỏ, hành vi lạ — trước khi đề xuất fix | `superpowers:systematic-debugging` |
| Trước khi nói "xong / đã fix / chạy được" | `superpowers:verification-before-completion` |
| Xong một mục ROADMAP, trước khi báo cáo | `superpowers:requesting-code-review` |
| Nhận góp ý review, trước khi sửa theo | `superpowers:receiving-code-review` |
| Mục 4 — VietQR / SePay / đối soát thanh toán | `payment-integration` |
| Cần tra tài liệu thư viện (MUI v9, Query v5, router v7) | `docs-seeker` |
| Cần mở trình duyệt kiểm chứng page thật | `chrome-devtools` |

Không dùng cho repo này:

- `ui-styling` — skill này dành cho shadcn/Tailwind, dự án dùng MUI. Dùng vào sẽ ra code
  sai hệ style.
- `backend-development` — sửa API thì làm bên `../be_mobivexa`, không phải ở đây.
- `web-testing` — repo chưa cài test runner. Chỉ dùng khi đã quyết định thêm Vitest.

Lưu ý khi đọc `frontend-development`: skill viết theo MUI v7 và TanStack Router, còn dự
án đang là **MUI v9 + react-router-dom v7**. Lấy *pattern* (Suspense query, feature
folder, lazy) chứ không copy API của thư viện — API thật lấy từ `docs-seeker` hoặc
`node_modules`.

## Quy trình "làm page tiếp theo"

Khi được yêu cầu dựng page mới:

1. Đọc [ROADMAP.md](ROADMAP.md), lấy **mục chưa tick đầu tiên**. Không nhảy cóc —
   thứ tự trong đó là thứ tự phụ thuộc.
2. Gọi `superpowers:brainstorming` để chốt phạm vi và cách làm của mục đó.
3. Đọc route tương ứng trong `../be_mobivexa/src/routes/*.route.ts` **và** service của
   nó để biết shape thật của response. Backend là nguồn sự thật duy nhất.
4. Gọi `frontend-development` (và `frontend-design` nếu là page mới có giao diện), rồi
   dựng theo cấu trúc feature bên dưới. Bắt chước `src/features/orders` — nó là mẫu
   đầy đủ nhất (api + queries + hook có mutation).
5. Thêm page vào [router.tsx](src/router.tsx) bằng `lazy()`.
6. Chạy `npm run build` và `npm run lint`, sửa hết lỗi.
7. Gọi `superpowers:verification-before-completion`, rồi
   `superpowers:requesting-code-review`.
8. Tick mục vừa xong trong ROADMAP.md.

Làm **một mục mỗi lần**. Xong thì dừng lại báo cáo, đừng tự chạy tiếp mục sau.

## Cấu trúc feature

```
src/features/<tên>/
  api/<tên>Api.ts   – hàm gọi axios, unwrap response
  api/queries.ts    – object keys + queryOptions()
  hooks/use*.ts     – hook cho component dùng
  components/       – UI riêng của feature
  types/index.ts    – type, re-export type dùng chung từ lib/apiTypes
src/pages/…         – component page, export tên (KHÔNG default export)
```

Component dùng chung nhiều feature thì để `src/components/`, không nhét vào feature.

## Tầng API

- Mọi request đi qua `apiClient` ([lib/apiClient.ts](src/lib/apiClient.ts)) — nó đã gắn
  sẵn baseURL, Authorization và cơ chế refresh token khi 401. Đừng gọi `axios` trần,
  đừng tự ghép URL từ `env.API_URL`.
- Backend bọc dữ liệu trong `{ order }`, `{ products, pagination }`… → **unwrap ngay
  trong `<tên>Api.ts`**. Hook và component không được thấy lớp bọc đó.
- Không bịa endpoint. Chỉ dùng đường dẫn có thật trong `be_mobivexa/src/routes/`.

## TanStack Query

- `queries.ts` khai báo `<tên>Keys` (object các hàm tạo key) và `queryOptions()`.
- Query chứa dữ liệu của người đang đăng nhập **phải** gắn `meta: USER_SCOPED` để
  logout tự dọn cache — xem [lib/queryClient.ts](src/lib/queryClient.ts).
- Dữ liệu bắt buộc phải có để render → `useSuspenseQuery` (layout `/account` và
  `Root` đã bọc `<Suspense>`). Dữ liệu phụ hoặc có thể rỗng → `useQuery`.
- Mutation đổi dữ liệu phía server thì `invalidateQueries`, đừng vá cache thủ công trừ
  khi có lý do rõ ràng.

## Router

- Thêm route = thêm một `const XPage = lazy(() => import(...).then(m => ({ default: m.XPage })))`
  rồi khai báo trong cây route.
- **Cấm import tĩnh page** vào `router.tsx` — sẽ dồn hết vào một bundle.
- Route cần đăng nhập đặt dưới `RequireAuth`; route chỉ dành cho khách chưa đăng nhập
  đặt dưới `GuestGuard`.

## TypeScript

- `erasableSyntaxOnly` đang bật: **không dùng `enum`**, không dùng parameter property.
  Enum viết bằng `as const` object — xem [lib/apiTypes.ts](src/lib/apiTypes.ts).
- Type phải khớp `../be_mobivexa/prisma/schema.prisma`. Enum và `PaginationMeta` dùng
  chung thì lấy từ `lib/apiTypes.ts`, không khai báo lại trong feature.
- Hàm export khai báo kiểu trả về tường minh. Không dùng `any`.

## Comment

Viết tiếng Việt và giải thích **tại sao**, không mô tả lại code. Các comment sẵn có
trong `apiClient.ts`, `queryClient.ts`, `router.tsx` là chuẩn cần theo.

## Kiểm chứng trước khi báo xong

```
npm run build   # tsc -b + vite build
npm run lint
```

Cả hai phải sạch. Không tuyên bố hoàn thành khi chưa chạy — nếu chưa chạy được thì nói
rõ là chưa.

## Chạy local

- FE: `npm run dev` → http://localhost:5173
- BE: `cd ../be_mobivexa && npm run dev` → http://localhost:5000, API gốc `/api`.
  BE đã whitelist sẵn origin 5173 (`CLIENT_URL` trong `be_mobivexa/src/app.ts`).
