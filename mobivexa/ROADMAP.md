# Roadmap page — SPA khách hàng

Thứ tự dưới đây là **thứ tự phụ thuộc**, không phải mức ưu tiên kinh doanh. Làm lần
lượt từ trên xuống, mỗi lần một mục. Quy trình xem [AGENTS.md](AGENTS.md).

Ký hiệu: `[x]` xong · `[ ]` chưa làm.

---

## Đã có

- [x] `/` — Trang chủ ([HomePage](src/pages/HomePage.tsx)) — *chưa gắn banner & sản phẩm nổi bật, xem mục 5*
- [x] `/login`, `/register` — feature `auth`
- [x] `/account` — hồ sơ, `/account/password`, `/account/addresses` — feature `account`
- [x] `/account/orders` — danh sách đơn — feature `orders`
- [x] `/account/reviews` — đánh giá của tôi — feature `reviews`

---

## 1. Catalog sản phẩm — feature `products`

- [ ] `/products` — danh sách + tìm kiếm + bộ lọc + phân trang
- [ ] `/products/:slug` — chi tiết sản phẩm

Thiết kế chi tiết: [docs/superpowers/specs/2026-08-09-products-feature-design.md](docs/superpowers/specs/2026-08-09-products-feature-design.md)

API:
- `GET /products?search&category&brand&tag&minPrice&maxPrice&sort&page&limit`
  — `category` và `brand` nhận **slug**, không phải id. BE dùng full-text search trên
  `name`, không lọc phía client. `limit` mặc định 12, tối đa 50.
- `GET /products/featured`
- `GET /products/:slug` — trả **cả variant đã tắt**, FE phải tự lọc `isActive`
- `GET /products/:slug/reviews`, `GET /products/:slug/reviews/summary`
- `POST /reviews/:id/helpful` (cần đăng nhập)
- `GET /categories`, `GET /brands` — nạp dữ liệu cho bộ lọc

Không làm được: **sắp xếp theo giá**. `resolveSort()` bên BE chỉ có
`newest|oldest|name_asc|name_desc`; giá nằm ở bảng `product_variants` (1-n) nên Prisma
không `orderBy` theo min của quan hệ. Muốn có thì phải sửa BE — task riêng.

Xong khi: lọc/tìm/phân trang đồng bộ với query string trên URL (F5 giữ nguyên kết
quả); trang chi tiết hiển thị được nhiều variant và ảnh; nút thêm vào giỏ để tạm
disabled cho tới mục 2.

## 2. Giỏ hàng — feature `cart`

- [ ] `/cart`

API: `GET /cart` · `POST /cart/items` · `PUT /cart/items/:itemId` ·
`DELETE /cart/items/:itemId` · `DELETE /cart`

Xong khi: badge số lượng trên [AppHeader](src/components/AppHeader.tsx) chạy; nút
thêm vào giỏ ở mục 1 hoạt động; giỏ là `USER_SCOPED`.

## 3. Đặt hàng

- [ ] `/checkout`

API: `GET /cart` · `GET /users/me/addresses` · `POST /orders`

Xong khi: chọn được địa chỉ giao (dùng lại `AddressFormDialog` của feature
`account`), chọn phương thức COD / BANK_TRANSFER, đặt xong điều hướng sang mục 4.

## 4. Đơn hàng & thanh toán

- [ ] `/orders/:id` — chi tiết đơn (dùng lại feature `orders`, thêm `getMine`)
- [ ] `/orders/:id/payment` — màn VietQR cho đơn BANK_TRANSFER

API: `GET /orders/:id` · `PATCH /orders/:id/cancel` ·
`GET /orders/:id/payment` · `GET /orders/:id/payment/status`

Lưu ý: `/payment` (lấy QR) có rate limit — gọi một lần. Việc polling dùng
`/payment/status`, chu kỳ 2–3s, dừng khi `PAID` hoặc khi rời trang.

## 5. Trang chủ đầy đủ + duyệt theo danh mục / thương hiệu

- [ ] Gắn banner + sản phẩm nổi bật vào `/`
- [ ] `/categories`, `/categories/:slug`
- [ ] `/brands`, `/brands/:slug`

API: `GET /banners?position=HERO|LEFT|RIGHT|HORIZONTAL` · `GET /banners/positions` ·
`GET /products/featured` · `GET /categories[/:slug]` · `GET /brands[/:slug]`

Trang `:slug` chỉ là `/products` lọc sẵn (`?category=<slug>` / `?brand=<slug>`) — tái
sử dụng component danh sách của mục 1, đừng viết lại. Feature `categories` và `brands`
đã được tạo mỏng ở mục 1 (api + queries + types), mục này chỉ thêm page.

## 6. Khôi phục mật khẩu

- [ ] `/forgot-password`
- [ ] `/reset-password`

API: `POST /auth/forgot-password` · `POST /auth/reset-password`

Đặt dưới `GuestGuard`. BE có rate limit — dùng lại
[useRateLimit](src/features/auth/hooks/useRateLimit.ts).

## 7. Viết đánh giá

- [ ] `/account/reviews/pending`

API: `GET /users/me/reviews/pending` · `POST /order-items/:orderItemId/review`
(multipart, tối đa 5 ảnh) · `PUT /reviews/:id` · `DELETE /reviews/:id`

Upload ảnh gửi bằng `FormData` — không set `Content-Type` thủ công, để axios tự đặt
boundary.

---

## Không nằm trong phạm vi (backend chưa hỗ trợ)

Đừng thiết kế UI cho những thứ này, không có API:
wishlist · mã giảm giá · tính phí vận chuyển / tra cứu vận đơn · trung tâm thông báo ·
so sánh sản phẩm · "sản phẩm liên quan" · "đã xem gần đây" · cổng thanh toán online
(VNPay/Momo/thẻ) · chat hỗ trợ.
