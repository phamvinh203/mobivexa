# Mobivexa — Backend

Backend của dự án đồ án tốt nghiệp **Mobivexa** (website bán điện thoại di động): Express + TypeScript + Prisma (PostgreSQL), 140 endpoint dưới prefix `/api` — gồm catalog sản phẩm, giỏ hàng, đơn hàng, thanh toán SePay (VietQR + webhook), mã giảm giá, đánh giá, Blog/SEO, và Chatbot AI (Gemini, SSE stream).

> Tài liệu đầy đủ (kiến trúc, luồng nghiệp vụ, bảo mật) nằm ở branch `docs` của repo.

## Yêu cầu

- **Node.js ≥ 20** (dự án phát triển trên Node 24)
- **PostgreSQL** 14+ đang chạy local hoặc cloud (Supabase/Neon...)
- (Tùy chọn) **Redis** — chỉ cần khi deploy nhiều instance dùng chung store rate-limit
- Tài khoản **Cloudinary** (upload ảnh), **SMTP** (email quên mật khẩu), **SePay** (thanh toán), **Google AI Studio** (chatbot) — có thể bỏ trống các nhóm không dùng, app vẫn chạy tương ứng

## Cài đặt nhanh (≈10 phút)

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file env từ mẫu rồi điền giá trị thật (DB, JWT secret ≥32 ký tự, Cloudinary...)
cp .env.example .env.local

# 3. Sinh Prisma Client + đồng bộ schema vào DB
npx prisma generate
npx prisma db push

# 4. (Tùy chọn) seed dữ liệu dùng thử
npm run seed
```

> ⚠️ **Quy ước dự án:** đồng bộ schema bằng `npx prisma db push` — **KHÔNG dùng `prisma migrate dev`** (repo không quản lý migration).

## Chạy

```bash
npm run dev        # BE tại http://localhost:5000 (nodemon, ts-node)
npm test           # toàn bộ test suite (vitest, ~25 giây)
npm run build      # tsc → dist/ ; npm start để chạy bản build
```

Hai app frontend nằm ở repo `Desktop/mobivexa_v1`:

| App | Thư mục | Cổng |
|---|---|---|
| Web khách hàng | `web_mobivexa` | 5001 |
| Quản trị (admin) | `admin_mobivexa` | 5002 |

Nhớ khai báo 2 origin này trong `FRONTEND_URL` (và `CLIENT_URL`) để CORS không chặn.

## Nhóm cấu hình chính

Xem chú thích đầy đủ trong [.env.example](.env.example):

- **Database / JWT** — bắt buộc. JWT secret phải ≥ 32 ký tự, ngắn hơn server từ chối khởi động.
- **Chatbot** — đặt `CHATBOT_ENABLED=false` để tắt hoàn toàn (app không cần `GEMINI_API_KEY` vẫn chạy; endpoint chat trả 503). Khi bật: model chính + chuỗi fallback qua `GEMINI_MODEL` / `GEMINI_MODEL_FALLBACKS` — chỉ rơi model kế khi 429/503.
- **SePay** — webhook trỏ tới `https://<domain>/api/webhooks/sepay`, secret phải khớp `SEPAY_WEBHOOK_SECRET`. Khi deploy sau nginx, nginx **phải** cấu hình `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` — nếu không, client tự gắn header giả là bypass được mọi rate limiter theo IP (xem comment tại `app.ts`).
- **Google OAuth / SMTP / Cloudinary** — đăng nhập Google, email quên mật khẩu, upload ảnh.

## Cấu trúc chính

```
src/
├── controllers/       # tầng HTTP — không viết business logic ở đây
├── services/          # business logic, tách module theo tính năng
│   └── chat/          # chatbot: agent (Gemini tool-calling), normalizer, prompt, tools
├── routes/            # định nghĩa endpoint, mount trong index.route.ts
├── middlewares/       # auth, authorize, rate_limit, upload, sepay_webhook, error
├── validators/        # kiểm tra đầu vào từng module
├── utils/             # slug, search (FTS), discount, pagination...
├── config/            # env, db (khởi tạo Prisma + FTS index)
└── __tests__/         # vitest — mock Prisma, không cần DB thật
```

## Quy ước lập trình

- Comment tiếng Việt, giải thích **lý do** thay vì mô tả lời code.
- Đồng bộ DB chỉ dùng `prisma db push`.
- Slug brand trong dữ liệu thật: iPhone thuộc brand `iphone` (không có brand `apple`).
- SSE stream của chatbot: abort client nghe qua `res.on('close')` (không dùng `req.on('close')` — req close ngay khi parse xong body POST trên Node 24).
- Working branch: `dev` → merge lên `main` qua Pull Request.
