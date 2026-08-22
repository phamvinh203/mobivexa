# Mobivexa — Backend API

REST API cho sàn thương mại điện tử bán điện thoại di động: quản lý danh mục sản phẩm,
giỏ hàng, đặt hàng, thanh toán chuyển khoản qua VietQR/SePay, đánh giá sản phẩm và
mã giảm giá — kèm bộ API quản trị cho ADMIN/STAFF.

Toàn bộ mã nguồn nằm trong [`be_mobivexa/`](be_mobivexa).

---

## Mục lục

- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Bắt đầu](#bắt-đầu)
- [Biến môi trường](#biến-môi-trường)
- [Npm scripts](#npm-scripts)
- [Kiến trúc](#kiến-trúc)
- [Mô hình dữ liệu](#mô-hình-dữ-liệu)
- [Danh sách API](#danh-sách-api)
- [Nghiệp vụ chính](#nghiệp-vụ-chính)
- [Bảo mật](#bảo-mật)
- [Kiểm thử](#kiểm-thử)
- [Dữ liệu mẫu](#dữ-liệu-mẫu)
- [Giới hạn hiện tại](#giới-hạn-hiện-tại)

---

## Công nghệ sử dụng

| Thành phần | Lựa chọn |
| --- | --- |
| Runtime | Node.js (phát triển trên v22) |
| Ngôn ngữ | TypeScript (`strict`, target ES2020, module CommonJS) |
| Web framework | Express 5 |
| Cơ sở dữ liệu | PostgreSQL |
| ORM | Prisma 7 + `@prisma/adapter-pg` (driver adapter qua `pg.Pool`) |
| Xác thực | JWT (`jsonwebtoken`) — access + refresh token, bcrypt cho mật khẩu |
| Lưu trữ ảnh | Cloudinary (upload trực tiếp từ buffer của multer) |
| Thanh toán | SePay — webhook biến động số dư + VietQR |
| Email | Nodemailer (SMTP) — gửi OTP đặt lại mật khẩu |
| Bảo mật | helmet, cors (whitelist), express-rate-limit |
| Kiểm thử | Vitest + Supertest (mock Prisma), coverage v8 |

---

## Cấu trúc thư mục

```
mobivexa_DATN/
└── be_mobivexa/
    ├── prisma/
    │   ├── schema.prisma        # 24 model + 8 enum
    │   └── seed.ts              # nạp dữ liệu mẫu từ data/products.json
    ├── data/                    # crawler + dữ liệu sản phẩm (gitignored)
    ├── docs/
    │   └── performance.md       # tài liệu tối ưu hiệu năng
    └── src/
        ├── index.ts             # entrypoint: bootstrap server
        ├── app.ts               # khởi tạo Express, middleware toàn cục
        ├── config/              # env, kết nối DB, cloudinary
        ├── routes/              # định nghĩa endpoint + gắn middleware
        ├── controllers/         # đọc req, gọi service, trả response
        ├── services/            # nghiệp vụ + truy vấn Prisma
        ├── validators/          # kiểm tra và chuẩn hoá dữ liệu vào
        ├── middlewares/         # auth, authorize, rate limit, upload, error
        ├── helpers/             # AppError, asyncHandler, response, prisma error
        ├── utils/               # pagination, discount, slug, token, mailer...
        ├── types/               # kiểu dữ liệu cho request/response
        ├── generated/prisma/    # Prisma Client sinh tự động (gitignored)
        └── __tests__/           # 16 file test, 402 test case
```

---

## Bắt đầu

### Yêu cầu

- Node.js 18 trở lên (dự án phát triển trên v22)
- PostgreSQL (cục bộ hoặc dịch vụ có pooler như Supabase/Neon)
- Tài khoản Cloudinary (upload ảnh) và SePay (thanh toán) nếu cần dùng hai tính năng này

### Cài đặt

```bash
cd be_mobivexa && npm install
```

Tạo file `.env.local` trong `be_mobivexa/` theo bảng [Biến môi trường](#biến-môi-trường).
Ứng dụng đọc cấu hình từ `.env.local` (không phải `.env`) — xem `src/config/env.ts`.

### Khởi tạo cơ sở dữ liệu

```bash
npm run prisma:generate
```

```bash
npm run prisma:migrate
```

`prisma migrate` dùng `DIRECT_URL` (session-mode pooler), còn ứng dụng lúc chạy dùng
`DATABASE_URL` (transaction-mode pooler) — khai báo trong `prisma.config.ts`.

Nạp dữ liệu mẫu (tuỳ chọn, cần `data/products.json`):

```bash
npm run seed
```

### Chạy

```bash
npm run dev
```

Server mặc định lắng nghe tại `http://localhost:5000`, kiểm tra bằng `GET /health`.

Bản production:

```bash
npm run build && npm start
```

---

## Biến môi trường

Tất cả đặt trong `be_mobivexa/.env.local`.

### Bắt buộc

| Biến | Mô tả |
| --- | --- |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL cho ứng dụng (transaction-mode pooler) |
| `DIRECT_URL` | Chuỗi kết nối cho `prisma migrate` (session-mode pooler, cổng 5432) |
| `JWT_ACCESS_SECRET` | Khoá ký access token — **tối thiểu 32 ký tự**, thiếu hoặc ngắn hơn thì server không khởi động |
| `JWT_REFRESH_SECRET` | Khoá ký refresh token — cùng ràng buộc 32 ký tự |
| `CLIENT_URL` | Origin được phép gọi API. Nhiều origin cách nhau bởi dấu phẩy. **Không được để `*`** — `src/index.ts` chặn wildcard ngay lúc boot |

### Tuỳ chọn / theo tính năng

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `PORT` | `5000` | Cổng HTTP |
| `NODE_ENV` | — | `production` bắt buộc xác thực chứng chỉ SSL của DB |
| `JWT_ACCESS_EXPIRES` | `15m` | Hạn access token |
| `JWT_REFRESH_EXPIRES` | `7d` | Hạn refresh token |
| `DB_SSL_NO_VERIFY` | — | `true` để bỏ kiểm chứng chỉ tự ký — **chỉ dùng khi dev cục bộ** |
| `CLOUDINARY_URL` | — | `cloudinary://api_key:api_secret@cloud_name`, SDK tự đọc |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | cổng `587` | Gửi email OTP đặt lại mật khẩu |
| `SEPAY_WEBHOOK_SECRET` | — | Secret xác thực webhook SePay |
| `SEPAY_BANK_ID` / `SEPAY_ACCOUNT_NUMBER` / `SEPAY_ACCOUNT_NAME` | — | Thông tin tài khoản để sinh mã VietQR |
| `SEPAY_API_URL` | `https://my.sepay.vn` | Endpoint UserAPI của SePay |
| `SEPAY_API_TOKEN` | — | Token gọi UserAPI khi đồng bộ lại giao dịch |

> Các biến `FRONTEND_URL`, `REDIS_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
> `GOOGLE_CALLBACK_URL`, `GEMINI_API_KEY` có trong file mẫu nhưng **chưa được mã nguồn
> đọc tới** — xem [Giới hạn hiện tại](#giới-hạn-hiện-tại).

---

## Npm scripts

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy nodemon + ts-node, tự khởi động lại khi sửa `src/` |
| `npm run build` | Biên dịch TypeScript sang `dist/` |
| `npm start` | Chạy bản đã build (`node dist/index.js`) |
| `npm test` | Chạy toàn bộ test một lượt |
| `npm run test:watch` | Chạy test ở chế độ theo dõi |
| `npm run test:coverage` | Chạy test kèm báo cáo coverage (`services/`, `validators/`) |
| `npm run prisma:generate` | Sinh Prisma Client vào `src/generated/prisma` |
| `npm run prisma:migrate` | Tạo và áp migration |
| `npm run prisma:studio` | Mở Prisma Studio |
| `npm run seed` | Nạp dữ liệu mẫu từ `data/products.json` |

---

## Kiến trúc

Mỗi request đi qua một chuỗi tầng cố định, mỗi tầng một trách nhiệm:

```
request
  → helmet + cors + express.json          (app.ts)
  → rate limiter                          (middlewares/rate_limit)
  → authenticate                          (middlewares/auth — đọc Bearer token)
  → authorize(...roles)                   (middlewares/authorize — chặn theo role)
  → validator                             (validators/ — kiểm tra & chuẩn hoá body)
  → controller                            (controllers/ — mỏng, chỉ điều phối)
  → service                               (services/ — nghiệp vụ + Prisma)
  → errorHandler                          (middlewares/error — điểm ra duy nhất của lỗi)
```

Quy ước áp dụng xuyên suốt:

- **Lỗi nghiệp vụ ném `AppError(status, message)`** từ service. `errorHandler` là nơi
  duy nhất biến lỗi thành HTTP response, kể cả `MulterError` (ảnh quá nặng, sai định dạng)
  và nhánh 500 cuối cùng.
- **`asyncHandler`** bọc mọi controller async để lỗi tự chảy về `errorHandler`,
  không cần `try/catch` lặp lại.
- **Response thành công** trả thẳng object dữ liệu; **response lỗi** luôn có dạng
  `{ "message": "..." }`.
- **Tầng luật thuần tách khỏi tầng truy vấn.** Ví dụ `utils/discount.ts` chứa toàn bộ số
  học của mã giảm giá và không import Prisma — test được bằng bảng input/output,
  đồng thời phá vòng import giữa `coupon.service` và `order.service`.
- **Chống race bằng ràng buộc DB, không bằng logic ứng dụng.** Các lệnh đổi trạng thái
  đều kèm điều kiện trạng thái cũ trong `WHERE`; lệnh thứ hai nhận `P2025` và được
  dịch thành `409`.

### Phân trang và tìm kiếm

`utils/pagination.ts` chuẩn hoá `?page` và `?limit` (mặc định 10, sản phẩm 12, kho 20;
trần 50, riêng kho 100) và trả metadata `{ page, limit, total, totalPages }`.

Tìm kiếm tên sản phẩm dùng full-text search của PostgreSQL với dictionary `simple`
(không stem — hợp với tiếng Việt), có hỗ trợ prefix để gõ giữa chừng vẫn ra kết quả.
Hai index không khai báo được trong `schema.prisma` được tạo lúc khởi động bởi
`ensureSearchIndexes()`: GIN full-text trên `products.name`, và GIN trigram trên
`orders."orderCode"` để admin tra mã đơn bằng một mẩu giữa chuỗi.

---

## Mô hình dữ liệu

24 model, ánh xạ sang bảng snake_case (`@@map`).

| Nhóm | Model |
| --- | --- |
| Người dùng | `User`, `RefreshToken`, `OAuthAccount`, `Address` |
| Danh mục sản phẩm | `Category` (cây phân cấp), `Brand`, `Product`, `ProductImage`, `ProductSpec`, `ProductVariant`, `Tag`, `ProductTag` |
| Mua hàng | `Cart`, `CartItem`, `Favorite`, `Order`, `OrderItem` |
| Thanh toán | `SePayTransaction` |
| Khuyến mãi | `Coupon`, `CouponUsage` |
| Đánh giá | `Review`, `ReviewPhoto`, `ReviewHelpful` |
| Nội dung | `Banner` |

Các enum: `UserRole` (CUSTOMER/ADMIN/STAFF), `OrderStatus`, `PaymentMethod` (COD/BANK_TRANSFER),
`PaymentStatus` (UNPAID/PAID/REFUNDED), `ReviewStatus`, `SePayTxStatus` (MATCHED/UNMATCHED/IGNORED),
`BannerPosition` (HERO/LEFT/RIGHT/HORIZONTAL), `CouponType` (PERCENT/FIXED).

Hai quyết định thiết kế đáng chú ý:

- **Đơn hàng lưu snapshot.** Địa chỉ giao hàng, tên sản phẩm, SKU, màu/dung lượng/RAM,
  đơn giá và cả mã giảm giá đều được chép vào `Order`/`OrderItem` lúc đặt. Sửa hay xoá
  sản phẩm, địa chỉ, mã giảm giá về sau không làm sai lệch đơn cũ.
- **`CouponUsage` là bảng ràng buộc, không phải sổ lịch sử.** Khoá chính `(couponId, userId)`
  chính là luật "một lượt mỗi khách mỗi mã" — DB chặn, không có khe đua giữa lúc đếm và
  lúc ghi. Huỷ đơn thì dòng này bị xoá để khách dùng lại mã được; lịch sử nằm ở snapshot
  trên `Order`.

---

## Danh sách API

Tất cả endpoint có tiền tố `/api`. Ngoài ra có `GET /health` trả `{ "status": "ok" }`.

Ký hiệu quyền: 🔓 công khai · 🔑 cần đăng nhập · 🛠 ADMIN hoặc STAFF · 👑 chỉ ADMIN

### Xác thực — `/api/auth` 🔓

Toàn bộ nhóm này bị giới hạn 10 request / 15 phút.

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| POST | `/auth/register` | Đăng ký tài khoản |
| POST | `/auth/login` | Đăng nhập, trả `accessToken` + `refreshToken` + thông tin user |
| POST | `/auth/refresh` | Xoay token: thu hồi refresh token cũ, cấp cặp token mới |
| POST | `/auth/forgot-password` | Gửi OTP qua email (luôn trả 200 để không lộ email có tồn tại hay không) |
| POST | `/auth/reset-password` | Đặt lại mật khẩu bằng OTP |
| POST | `/auth/logout` | Thu hồi refresh token |

### Tài khoản — `/api/users` 🔑

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET / PUT | `/users/me` | Xem / cập nhật hồ sơ |
| PUT | `/users/me/password` | Đổi mật khẩu |
| POST | `/users/me/avatar` | Đổi ảnh đại diện (multipart `avatar`, tối đa 10 lần/giờ) |
| GET / POST | `/users/me/addresses` | Danh sách / thêm địa chỉ |
| PUT / DELETE | `/users/me/addresses/:id` | Sửa / xoá địa chỉ |
| PATCH | `/users/me/addresses/:id/default` | Đặt địa chỉ mặc định |
| GET | `/users/me/reviews` | Đánh giá đã viết |
| GET | `/users/me/reviews/pending` | Sản phẩm đã nhận nhưng chưa đánh giá |

### Danh mục sản phẩm 🔓

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/categories`, `/categories/:slug` | Danh mục |
| GET | `/brands`, `/brands/:slug` | Thương hiệu |
| GET | `/tags` | Nhãn |
| GET | `/banners`, `/banners/positions` | Banner theo vị trí |
| GET | `/products` | Danh sách sản phẩm — lọc `category`, `brand`, `tag`, `search`, `minPrice`, `maxPrice`, `sort` |
| GET | `/products/featured` | Sản phẩm nổi bật |
| GET | `/products/:slug` | Chi tiết sản phẩm |
| GET | `/products/:slug/reviews` | Đánh giá của sản phẩm |
| GET | `/products/:slug/reviews/summary` | Điểm trung bình và phân bố sao |

### Giỏ hàng và yêu thích 🔑

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET / DELETE | `/cart` | Xem giỏ / xoá sạch giỏ |
| POST | `/cart/items` | Thêm biến thể vào giỏ |
| PUT / DELETE | `/cart/items/:itemId` | Sửa số lượng / xoá một dòng |
| GET | `/favorites`, `/favorites/ids` | Danh sách yêu thích (bản đầy đủ / chỉ id) |
| POST / DELETE | `/favorites`, `/favorites/:productId` | Thêm / bỏ yêu thích |

### Mã giảm giá — `/api/coupons` 🔑

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/coupons` | Mã đang chạy mà khách còn dùng được |
| POST | `/coupons/preview` | Thử mã trên giỏ hiện tại, trả số tiền được giảm (20 lượt/phút) |

### Đơn hàng — `/api/orders` 🔑

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| POST | `/orders` | Đặt hàng (không truyền `items` thì lấy toàn bộ giỏ) |
| GET | `/orders` | Đơn của tôi |
| GET | `/orders/:id` | Chi tiết đơn của tôi |
| PATCH | `/orders/:id/cancel` | Huỷ đơn |

### Thanh toán

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/orders/:id/payment` | 🔑 | Mã VietQR + thông tin ngân hàng (30 lượt/phút) |
| GET | `/orders/:id/payment/status` | 🔑 | Endpoint nhẹ để frontend polling khi đang hiện QR |
| POST | `/webhooks/sepay` | 🔓 | SePay gọi vào khi có biến động số dư — bắt buộc đúng secret |

### Đánh giá 🔑

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| POST | `/order-items/:orderItemId/review` | Viết đánh giá (multipart `photos`, tối đa 5 ảnh) |
| PUT / DELETE | `/reviews/:id` | Sửa / xoá đánh giá của mình |
| POST | `/reviews/:id/helpful` | Bình chọn hữu ích |

### Quản trị — `/api/admin`

| Nhóm | Endpoint | Quyền |
| --- | --- | --- |
| Người dùng | `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/role`, `PATCH /admin/users/:id/status`, `DELETE /admin/users/:id` | 👑 |
| Danh mục | `GET/POST /admin/categories`, `PUT/DELETE /admin/categories/:id`, `PATCH /admin/categories/:id/status` | 🛠 |
| Thương hiệu | `GET/POST /admin/brands`, `PUT/DELETE /admin/brands/:id`, `PATCH /admin/brands/:id/status` | 🛠 |
| Nhãn | `GET/POST /admin/tags`, `DELETE /admin/tags/:id` | 🛠 |
| Banner | `GET/POST /admin/banners`, `GET /admin/banners/positions`, `PUT/DELETE /admin/banners/:id`, `PATCH /admin/banners/:id/status` | 🛠 |
| Sản phẩm | `GET/POST /admin/products`, `GET/PUT/DELETE /admin/products/:id`, `PATCH /admin/products/:id/status`, `PATCH /admin/products/:id/featured` | 🛠 |
| Ảnh sản phẩm | `POST /admin/products/:id/images`, `DELETE /admin/products/:id/images/:imageId`, `PATCH /admin/products/:id/images/:imageId/cover` | 🛠 |
| Thông số | `PUT /admin/products/:id/specs` (thay cả bảng một lần) | 🛠 |
| Biến thể | `POST /admin/products/:id/variants`, `PUT/DELETE /admin/products/:id/variants/:variantId`, `PATCH /admin/products/:id/variants/:variantId/stock` | 🛠 |
| Tồn kho | `GET /admin/inventory` — lọc `stockStatus`, `lowThreshold`, `brandSlug`, `search` | 🛠 |
| Đơn hàng | `GET /admin/orders`, `GET /admin/orders/:id`, `PATCH /admin/orders/:id/status`, `PATCH /admin/orders/:id/payment` | 🛠 |
| Thanh toán | `GET /admin/payment/stats`, `GET /admin/payment/transactions`, `GET /admin/payment/transactions/unmatched`, `POST /admin/payment/transactions/:txId/match`, `POST /admin/payment/sync` | 🛠 |
| Mã giảm giá | `GET/POST /admin/coupons`, `GET/PUT/DELETE /admin/coupons/:id`, `PATCH /admin/coupons/:id/status` | 🛠 |
| Đánh giá | `GET /admin/reviews`, `POST /admin/reviews/:id/reply`, `DELETE /admin/reviews/:id` | 🛠 |

---

## Nghiệp vụ chính

### Xác thực và phân quyền

Đăng nhập trả về access token (mặc định 15 phút) và refresh token (7 ngày, lưu trong
bảng `refresh_tokens`). Gọi `/auth/refresh` sẽ **xoay token**: token cũ bị đánh dấu thu hồi
và token mới được tạo trong cùng một transaction. Token hết hạn được dọn lúc khởi động
và lặp lại mỗi 24 giờ.

Đặt lại mật khẩu dùng OTP gửi qua email, hiệu lực 15 phút, lưu trong DB dưới dạng
băm SHA-256. `/auth/forgot-password` luôn trả 200 dù email có tồn tại hay không.

Ba role: `CUSTOMER`, `STAFF`, `ADMIN`. Quản trị danh mục sản phẩm, đơn hàng, thanh toán
mở cho cả STAFF và ADMIN; riêng quản lý người dùng chỉ ADMIN.

### Vòng đời đơn hàng

```
PENDING ──→ CONFIRMED ──→ SHIPPING ──→ DELIVERED
   │            │             │
   └────────────┴─────────────┴──────→ CANCELLED
```

`DELIVERED` và `CANCELLED` là trạng thái cuối. Bảng chuyển trạng thái nằm ở
`services/order.service.ts` và là nguồn sự thật duy nhất.

Khi huỷ đơn, phần kho đã trừ được hoàn lại và lượt dùng mã giảm giá được trả về — tất cả
trong một transaction, có guard trạng thái để hai request huỷ song song không cộng kho hai lần.

### Mã giảm giá

Mã được chuẩn hoá UPPERCASE cả lúc ghi lẫn lúc tra, nên ràng buộc `@unique` hoạt động
như so sánh không phân biệt hoa thường. Hai loại: `PERCENT` (có thể kèm trần giảm
`maxDiscount`) và `FIXED`. Điều kiện áp mã gồm: đang bật, trong khoảng thời gian hiệu lực,
chưa vượt tổng lượt dùng, giỏ đạt `minOrderValue`, và khách chưa từng dùng mã đó.

Số tiền giảm luôn được kẹp không vượt quá tổng tiền hàng để tổng đơn không bao giờ âm.

### Thanh toán qua SePay

1. Khách chọn `BANK_TRANSFER` rồi gọi `GET /orders/:id/payment` để lấy ảnh VietQR có sẵn
   số tiền và nội dung chuyển khoản là mã đơn.
2. Khách chuyển khoản, SePay bắn webhook về `POST /api/webhooks/sepay`.
3. Backend ghi mọi giao dịch vào sổ cái `sepay_transactions` (chống trùng bằng `sepayId`
   unique), đối chiếu mã đơn trong nội dung chuyển khoản và số tiền, rồi đánh dấu đơn
   đã thanh toán.
4. Giao dịch không khớp được đơn **không bị nuốt im lặng** — nó nằm lại với trạng thái
   `UNMATCHED` kèm lý do, admin xem ở `GET /admin/payment/transactions/unmatched` và gán
   tay bằng `POST /admin/payment/transactions/:txId/match`.
5. Nghi ngờ webhook bị rớt thì gọi `POST /admin/payment/sync` để kéo lại giao dịch từ
   SePay UserAPI.

Frontend theo dõi kết quả bằng cách polling `GET /orders/:id/payment/status`.

### Đánh giá sản phẩm

Chỉ đánh giá được sản phẩm trong đơn đã `DELIVERED`, mỗi dòng đơn hàng đúng một đánh giá
(ràng buộc `@unique` trên `orderItemId`). Kèm tối đa 5 ảnh. Sửa được trong vòng 30 ngày.
Admin có thể trả lời hoặc gỡ đánh giá.

### Upload ảnh

Ảnh đi qua multer với `memoryStorage` rồi được đẩy thẳng lên Cloudinary. Chỉ chấp nhận
JPG/PNG/WebP (kiểm tra cả MIME lẫn phần mở rộng), tối đa 5MB mỗi ảnh; giới hạn field text
được nới lên 10MB vì mô tả sản phẩm có thể chứa ảnh dán dạng base64.

---

## Bảo mật

- **helmet** đặt trước cors để header bảo mật áp cho cả preflight lẫn response lỗi.
- **CORS whitelist** — `CLIENT_URL` bắt buộc phải có và không được là `*`; server từ chối
  khởi động nếu vi phạm.
- **JWT secret tối thiểu 32 ký tự**, kiểm tra ngay lúc nạp module — fail fast thay vì
  chạy với khoá yếu.
- **Rate limit theo từng bề mặt**: đăng nhập/đăng ký 10 lượt/15 phút (chống dò mật khẩu),
  thử mã giảm giá 20/phút (chống dò mã), sinh QR 30/phút, webhook 120/phút,
  đồng bộ SePay 10/phút, đổi avatar 10/giờ. Rate limit tự tắt khi `NODE_ENV=test`.
- **Webhook SePay bắt buộc secret** qua header `Authorization: Apikey <key>` (hoặc
  `x-sepay-secret` cho cấu hình cũ).
- **Mật khẩu băm bằng bcrypt**; token đặt lại mật khẩu băm SHA-256 trước khi lưu.
- **SSL của DB luôn được xác thực khi `NODE_ENV=production`** — `DB_SSL_NO_VERIFY`
  chỉ có tác dụng ngoài production.
- **Không lộ thông tin qua thông báo lỗi**: sai email và sai mật khẩu trả cùng một message,
  quên mật khẩu luôn trả 200.

---

## Kiểm thử

```bash
npm test
```

16 file test, **402 test case**, chạy khoảng 8 giây. Test dùng Vitest + Supertest, mock
Prisma Client bằng `vi.hoisted()` nên **không cần database thật**. Biến môi trường cho
test được khai báo sẵn trong `vitest.config.ts`.

Phạm vi: `admin`, `auth`, `brand`, `cart`, `category`, `coupon`, `discount`, `favorite`,
`inventory`, `order`, `payment`, `product`, `review`, `tag`, `user`, và `p0_guards` —
file cuối kiểm tra các chốt chặn quan trọng nhất (guard chống race, ràng buộc tiền bạc,
phân quyền).

Báo cáo coverage tập trung vào `src/services/**` và `src/validators/**`:

```bash
npm run test:coverage
```

---

## Dữ liệu mẫu

`data/` chứa một crawler zero-dependency lấy dữ liệu điện thoại thật (thương hiệu,
danh mục, sản phẩm, giá, thông số, ảnh) từ cellphones.com.vn và sinh ra `products.json`.

```bash
cd be_mobivexa/data && node crawl.mjs --per 12
```

```bash
cd be_mobivexa && npm run seed
```

Seed tạo thương hiệu, cây danh mục, nhãn, sản phẩm kèm biến thể và ảnh, cộng thêm
người dùng / địa chỉ / giỏ hàng / đơn hàng / đánh giá mẫu. Chi tiết xem
[`be_mobivexa/data/README.md`](be_mobivexa/data/README.md).

> Thư mục `data/` và `docs/` nằm trong `.gitignore` của backend nên có thể không xuất hiện
> sau khi clone.

---

## Giới hạn hiện tại

Những phần đã có dấu vết trong schema hoặc file cấu hình mẫu nhưng **chưa được cài đặt**
trong `src/`:

- **Đăng nhập Google (OAuth).** Model `OAuthAccount` và các biến `GOOGLE_*` đã có, nhưng
  chưa có route hay service nào xử lý luồng OAuth.
- **Redis caching.** `docs/performance.md` mô tả một tầng cache Redis, nhưng mã nguồn hiện
  chỉ có cache in-memory cho phần tổng hợp tồn kho (TTL 60 giây). Biến `REDIS_URL` chưa
  được đọc ở đâu.
- **`GEMINI_API_KEY`** và **`FRONTEND_URL`** có trong file env mẫu nhưng không được sử dụng.
- **Chưa có migration nào được commit** — lần khởi tạo đầu tiên sẽ tự sinh migration từ
  `schema.prisma`.
- **Xác minh email** (`User.emailVerified`) tồn tại trong schema nhưng chưa có luồng gửi
  và xác nhận.

---

## Quy ước commit

Commit message bắt đầu bằng emoji phân loại, theo `.github/copilot-commit-message-instructions.md`:

```
🎉 Thêm API quản lý mã giảm giá cho admin
🐛 Chặn dò mã ở preview và sửa lại comment index
🔨 Tách tầng luật giảm giá khỏi tầng truy vấn
```

Các nhóm: 📊 Data · 🐛 Bug · 🔨 Refactor · ✨ Enhance · 🎉 Feature · 📜 Docs · 🧹 Chore ·
🚨 Style · 👷 WIP · ✅ Tests
