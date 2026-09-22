# Thay đổi trong `be_mobivexa` (đối chiếu với bản chưa vá — "VBS")

> Tài liệu này mô tả toàn bộ thay đổi đang ở trạng thái **chưa commit** (`git status` tại `mobivexa_DATN`) trong `be_mobivexa`, dựa trên `git diff` thực tế. Với mỗi file: **thay đổi gì → tác dụng gì → bổ trợ cho chức năng/file nào → vì sao cần**. Phần lớn các thay đổi này vá đúng các lỗ hổng đã được ghi nhận trong bộ tài liệu reverse-engineering tại `be_mobivexa/docs/` (đặc biệt `14_SECURITY.md`, `15_PERFORMANCE.md`, `18_TECHNICAL_DEBT.md`) — tài liệu này trỏ ngược lại các mục đó (TD-xx) để đối chiếu.
>
> Phạm vi: 29 file thay đổi (28 sửa + 1 xoá), không tính `package-lock.json` (chỉ là hệ quả tự động của việc đổi version trong `package.json`).

---

## Nhóm 1 — Chống brute-force OTP đặt lại mật khẩu

Đây là nhóm thay đổi lớn nhất, tập trung vào `resetPasswordService` — vá đúng lỗ hổng đã ghi nhận ở `docs/modules/auth.md` ("TOCTOU window" khi consume OTP) và `docs/14_SECURITY.md` (OTP chỉ có 15 phút hiệu lực, không giới hạn số lần thử).

### `src/services/auth.service.ts`
- **Thay đổi**:
  1. Thêm hằng `MAX_RESET_ATTEMPTS = 5`.
  2. Thêm hàm `hashesMatch(a, b)` — so sánh 2 hash bằng `crypto.timingSafeEqual` thay vì `===`.
  3. `resetPasswordService` đổi chữ ký từ `(otp, newPassword)` thành `(email, otp, newPassword)`. Luồng mới:
     - Tìm user theo `email` (thay vì `findFirst` theo `resetPasswordToken` như trước).
     - Nếu không có user / hết hạn OTP → lỗi "Token không hợp lệ hoặc đã hết hạn" (message giống hệt trường hợp OTP sai — không tiết lộ email có tồn tại hay không).
     - **"Giữ chỗ" 1 lượt thử bằng `prisma.user.updateMany({ where: { id, resetPasswordAttempts: { lt: 5 } }, data: { increment: 1 } })`** — 1 câu lệnh DB nguyên tử duy nhất, không phải đọc-rồi-ghi 2 bước.
     - Nếu `updateMany` trả `count: 0` (đã hết lượt) → vô hiệu hoá OTP luôn (`resetPasswordToken/Expires = null`), buộc người dùng xin OTP mới, kể cả nếu họ vừa gửi đúng OTP.
     - So khớp OTP bằng `hashesMatch` (constant-time) thay vì so sánh chuỗi thường.
  4. `forgotPasswordService`: khi cấp OTP mới, reset luôn `resetPasswordAttempts: 0` — OTP mới thì bộ đếm được tính lại từ đầu.
  5. Transaction cuối (đổi mật khẩu thật) cũng reset `resetPasswordAttempts: 0`.
- **Tác dụng**: OTP 6 số (1 triệu khả năng) không còn có thể bị dò trong suốt 15 phút hiệu lực — kẻ tấn công chỉ có đúng 5 lần thử trước khi OTP bị khoá và phải yêu cầu mã mới (mỗi mã mới lại tốn 1 email OTP, chặn brute-force theo cấp số nhân thời gian).
- **Bổ trợ cho**: `flows/reset-password.md`, `routes/auth.md` (mục Error Cases của `POST /api/auth/reset-password` cần cập nhật theo body mới `{ email, otp, newPassword }`), `06_AUTHENTICATION.md` mục "Reset Password".
- **Vì sao cần**: Pattern đọc-rồi-ghi (đọc `attempts`, so sánh, rồi ghi `attempts+1`) có khe hở race condition — nhiều request đồng thời có thể cùng đọc chung 1 giá trị `attempts` cũ và cùng lọt qua ngưỡng trước khi request nào kịp ghi tăng, vô hiệu hoá hoàn toàn giới hạn 5 lần. Gộp thành 1 `updateMany` có điều kiện buộc PostgreSQL tự khoá row khi UPDATE, nên các request đồng thời được xử lý tuần tự — request nào chạm ngưỡng trước thì các request sau chắc chắn thấy `count = 0`. Đây là cách sửa đúng chuẩn cho lớp lỗi TOCTOU (time-of-check-to-time-of-use), cùng họ với cách `order.service.ts` đã trừ tồn kho atomic (`updateMany` điều kiện `stock >= quantity`).

### `src/controllers/auth.controller.ts`
- **Thay đổi**: `resetPassword` đọc thêm `email` từ `req.body`, truyền xuống `resetPasswordService(email, otp, newPassword)`.
- **Tác dụng**: Điểm nối giữa route và service cho luồng mới — không có logic riêng.
- **Bổ trợ cho**: `auth.service.ts` (mục trên).
- **Vì sao cần**: Service cần `email` để tìm đúng user cần tăng bộ đếm `resetPasswordAttempts` (không thể suy ra chỉ từ OTP nữa, vì bước tăng bộ đếm phải chạy TRƯỚC khi biết OTP đúng hay sai).

### `src/types/auth.type.ts`
- **Thay đổi**: `ResetPasswordBody` thêm field `email: string`.
- **Tác dụng**: Khớp type với body thực tế mà route/controller mới yêu cầu.
- **Bổ trợ cho**: `auth.controller.ts`, `auth.validator.ts`.
- **Vì sao cần**: Type phải phản ánh đúng hợp đồng API mới, tránh lệch giữa type và runtime (vấn đề từng bị ghi nhận ở `modules/admin.md` với `AdminUserListQuery`).

### `src/validators/auth.validator.ts`
- **Thay đổi**: `validateResetPassword` gọi thêm `checkEmail(res, email)` để validate field `email` mới trước khi vào service.
- **Tác dụng**: Chặn request thiếu/sai định dạng email ngay ở tầng validate, không tốn round-trip DB.
- **Bổ trợ cho**: `resetPasswordService` (mục trên).
- **Vì sao cần**: Đồng bộ với API contract mới — mọi field bắt buộc trong body phải có validator tương ứng.

### `prisma/schema.prisma` (model `User`)
- **Thay đổi**: Thêm field `resetPasswordAttempts Int @default(0)`.
- **Tác dụng**: Chỗ lưu bộ đếm số lần thử OTP sai, gắn liền theo TÀI KHOẢN (không phải theo IP như rate limiter) — bền qua nhiều request/nhiều IP khác nhau của cùng 1 kẻ tấn công.
- **Bổ trợ cho**: `auth.service.ts` (đọc/ghi field này trong toàn bộ luồng reset-password).
- **Vì sao cần**: Rate limit theo IP (`authLimiter`) không đủ — kẻ tấn công có thể đổi IP (proxy/botnet) để né giới hạn theo IP nhưng vẫn nhắm vào đúng 1 tài khoản nạn nhân. Giới hạn theo tài khoản (lưu trong DB) đóng đúng lỗ hổng đó, độc lập với IP.

---

## Nhóm 2 — Chống chiếm đoạt phiên chat của khách vãng lai (IDOR)

Vá đúng **TD-05** đã ghi nhận trong `18_TECHNICAL_DEBT.md`: "Anonymous chat sessions have no real ownership secret — UUID alone grants access".

### `src/utils/token_manager.ts`
- **Thay đổi**: Thêm `signGuestChatToken(sessionId)` và `verifyGuestChatToken(token)` — ký/xác thực 1 JWT riêng (dùng lại `ACCESS_SECRET`, hạn 30 ngày) chỉ chứa `{ sessionId }`, KHÔNG dùng chung shape `JwtPayload` (không có `userId/email/role` thật).
- **Tác dụng**: Cấp một "chứng chỉ sở hữu" (capability token) cho phiên chat vãng lai — session id (cuid) không còn là bằng chứng sở hữu duy nhất.
- **Bổ trợ cho**: `chat.service.ts` (mục dưới).
- **Vì sao cần**: Session id có thể lộ qua log server, HTTP Referer header, lịch sử trình duyệt — bất kỳ ai biết được UUID này trước đây đều đọc được toàn bộ lịch sử chat của phiên đó (không có gì để phân biệt "chủ phiên thật" với "người tình cờ biết ID"). JWT ký bằng secret của server thì không thể giả mạo nếu không có secret.

### `src/services/chat.service.ts`
- **Thay đổi**:
  1. `resolveSession(sessionId, userId, guestToken)` — thêm tham số `guestToken`. Logic phân nhánh: phiên đã có `userId` → xác thực như cũ (so khớp `userId` từ JWT đăng nhập); phiên còn là khách vãng lai (`userId === null`) → **bắt buộc** `guestToken` khớp với `sessionId` (qua `isValidGuestToken`) mới cho qua, nếu không → `404` (cố tình dùng 404 chứ không phải 403, để không "xác nhận" với kẻ dò rằng sessionId đó có thật — giữ nguyên nguyên tắc chống-dò đã có sẵn trong code cũ).
  2. `createSession(userId?)`: nếu tạo phiên KHÔNG có `userId` (khách vãng lai) → trả kèm `guestToken` mới sinh cho phiên đó.
  3. `sendMessage`: truyền `body.guestToken` xuống `resolveSession`; sau khi xử lý xong, nếu phiên VẪN còn là khách vãng lai (chưa gắn `userId` nào) → cấp lại `guestToken` mới trong response để client tiếp tục dùng cho lượt chat sau.
  4. `getMessages(sessionId, userId?, guestToken?)`: nhận thêm `guestToken`, truyền vào `resolveSession`.
- **Tác dụng**: Đóng hoàn toàn lỗ hổng đọc trộm/ghi trộm lịch sử chat của người khác khi chưa đăng nhập.
- **Bổ trợ cho**: `chat.controller.ts`, `chatbot_tools.ts` (gián tiếp — dữ liệu tool-call nằm trong tin nhắn được bảo vệ), `routes/chat.md`, `flows/chat-message.md`.
- **Vì sao cần**: Đây là gap bảo mật cụ thể đã phát hiện khi rà soát domain Engagement — endpoint đọc lịch sử chat trước đây hoàn toàn không kiểm tra quyền sở hữu cho phiên vãng lai (`if (session.userId && ...)` bỏ qua khi `userId` là `null`).

### `src/controllers/chat.controller.ts`
- **Thay đổi**: `messages` đọc header `x-chat-guest-token`, truyền xuống `chatService.getMessages(...)`.
- **Tác dụng**: Điểm vào để client gửi guestToken khi đọc lịch sử (khác với `send` — gửi tin nhắn mới, nơi `guestToken` đi trong body qua `SendMessageBody`).
- **Bổ trợ cho**: `chat.service.ts`.
- **Vì sao cần**: `GET /api/chat/sessions/:id/messages` không có body (là GET) nên guestToken phải truyền qua header thay vì JSON body — khác với `POST /api/chat/messages` (có body).

### `src/types/chat.type.ts`
- **Thay đổi**: `SendMessageBody` thêm `guestToken?: string`; `ChatReply` thêm `guestToken?: string`.
- **Tác dụng**: Khai báo hợp đồng API mới cho cả chiều gửi (client → server) và chiều trả (server → client).
- **Bổ trợ cho**: `chat.controller.ts`, `chat.service.ts`.
- **Vì sao cần**: FE cần biết field này tồn tại để lưu lại token nhận được từ response và gửi kèm ở các lượt chat tiếp theo — nếu không lưu, phiên vãng lai sẽ "mồ côi" (không ai đọc lại được) ngay sau lượt chat đầu.

---

## Nhóm 3 — Xác thực nội dung ảnh upload bằng magic byte (chống giả mạo file)

### `src/middlewares/upload.middleware.ts`
- **Thay đổi**:
  1. Tách `multer(...)` cũ thành biến private `multerInstance`.
  2. Thêm hàm `isAllowedImageBuffer(buffer)` — đọc vài byte đầu file (magic number) để nhận diện đúng JPEG (`FF D8 FF`), PNG (`89 50 4E 47 0D 0A 1A 0A`), WebP (`RIFF....WEBP`) — không dựa vào tên file hay `mimetype` (cả hai đều do client tự khai, giả mạo được).
  3. Thêm middleware `validateImageContent` — chạy SAU khi multer đã đọc xong buffer, kiểm tra mọi file trong `req.file`/`req.files` bằng `isAllowedImageBuffer`, nếu sai định dạng → `AppError(400, ...)`.
  4. `uploadImage` đổi từ 1 middleware Multer đơn thành object có 2 method `single(field)`/`array(field, maxCount)`, mỗi method trả về **mảng 2 middleware**: `[multerInstance.single/array(...), validateImageContent]`.
- **Tác dụng**: Mọi route dùng `uploadImage.single(...)`/`uploadImage.array(...)` tự động có thêm bước kiểm tra nội dung file thật, không cần route nào tự nhớ gắn thêm.
- **Bổ trợ cho**: Mọi route nhận ảnh upload — avatar (`user.route.ts:17`), sản phẩm (`product.route.ts:22,23,29`), category (`category.route.ts:19,20`), brand (`brand.route.ts:19,20`), banner (`banner.route.ts:20,21`), ảnh review (`review.route.ts:26,31`). Đã xác nhận trực tiếp trong code: mọi nơi gọi đều theo dạng `router.post(path, uploadImage.single('field'), ..., controller)` — tức là **truyền thẳng kết quả gọi hàm làm 1 đối số** cho `router.post/put`, KHÔNG có route nào tự soạn mảng middleware tay hay dùng spread. Express tự động "làm phẳng" (flatten) khi 1 đối số middleware là mảng, nên `uploadImage.single(...)` đổi từ trả về 1 middleware đơn sang trả về mảng 2 middleware **không cần sửa bất kỳ dòng gọi nào** ở 12 vị trí trên — tương thích ngược hoàn toàn nhờ đặc tính này của Express router.
- **Vì sao cần**: Validate cũ (`fileFilter` trong Multer) chỉ kiểm tra đuôi file (`.jpg/.png/.webp`) và `mimetype` — cả hai đều là dữ liệu client tự khai trong multipart request, đổi được dễ dàng (vd đổi tên `malware.php` thành `malware.php.jpg`, hoặc set `Content-Type: image/jpeg` cho một file bất kỳ). Kiểm tra magic byte đọc trực tiếp nội dung nhị phân thật của file — không thể giả mạo bằng cách đổi tên/header, chỉ có thể giả mạo bằng cách nhúng đúng vài byte đầu của định dạng ảnh thật (khó khai thác hơn nhiều, và nếu file bắt đầu đúng bằng magic byte ảnh thì về cơ bản trình duyệt/thư viện xử lý ảnh sẽ coi nó là ảnh).

---

## Nhóm 4 — Rate limit cho route catalog công khai

### `src/middlewares/rate_limit.middleware.ts`
- **Thay đổi**: Thêm `catalogLimiter = rateLimit(makeLimiter(120, 60_000, ...))` — 120 request/phút.
- **Tác dụng**: Cung cấp 1 limiter dùng chung cho các route đọc công khai (danh mục, thương hiệu, banner, sản phẩm, tag).
- **Bổ trợ cho**: `banner.route.ts`, `brand.route.ts`, `category.route.ts`, `product.route.ts`, `tag.route.ts` (mục dưới).
- **Vì sao cần**: Trước thay đổi này, các route đọc công khai (`GET /api/products`, `/api/categories`, `/api/brands`, `/api/tags`, `/api/banners`) hoàn toàn KHÔNG có rate limiter nào — đây là bề mặt lớn nhất của API (mọi khách vãng lai đều gọi liên tục khi duyệt web) và dễ bị lợi dụng để scraping toàn bộ catalog hoặc làm DoS tầng ứng dụng (mỗi request vẫn tốn 1 query DB, có thể kèm full-text search tốn CPU). 120/phút đủ rộng cho hành vi duyệt web thật (không giới hạn UX) nhưng chặn được script quét tốc độ cao.

### `src/routes/banner.route.ts`, `brand.route.ts`, `category.route.ts`, `product.route.ts`, `tag.route.ts`
- **Thay đổi**: Mỗi file thêm `publicRouter.use(catalogLimiter)` ngay sau khi tạo `publicRouter`, TRƯỚC mọi route `GET` công khai.
- **Tác dụng**: Áp `catalogLimiter` cho toàn bộ route công khai của 5 domain trên (route admin trong cùng file KHÔNG bị ảnh hưởng — chỉ `publicRouter`, không phải `adminRouter`).
- **Bổ trợ cho**: `catalogLimiter` (mục trên).
- **Vì sao cần**: Đóng khoảng trống rate-limit đã nêu — đây là 5 route group public duy nhất trước đó chưa có bất kỳ limiter nào (so với `authLimiter`, `avatarLimiter`, `webhookLimiter`, `qrLimiter`, `couponPreviewLimiter`, `syncLimiter`, `chatLimiter` đã tồn tại sẵn cho các domain khác).

---

## Nhóm 5 — Chống timing attack khi so sánh secret/hash

Vá đúng **TD-09** đã ghi nhận trong `18_TECHNICAL_DEBT.md`.

### `src/middlewares/sepay_webhook.middleware.ts`
- **Thay đổi**: `verifySePaySecret` đổi từ `extractSecret(req) !== secret` sang so sánh bằng `crypto.timingSafeEqual` (kèm kiểm tra độ dài 2 buffer bằng nhau trước, vì `timingSafeEqual` throw nếu độ dài khác nhau).
- **Tác dụng**: So sánh secret webhook không còn rò rỉ thông tin qua thời gian phản hồi.
- **Bổ trợ cho**: `routes/payments.md` (mục Security của `POST /api/webhooks/sepay`), `14_SECURITY.md`.
- **Vì sao cần**: Toán tử `!==` so sánh chuỗi theo kiểu short-circuit (dừng ngay ở ký tự đầu tiên khác nhau) — về lý thuyết, kẻ tấn công đo thời gian phản hồi có thể suy luận dần từng ký tự đúng của secret (timing side-channel). Đây là endpoint xác nhận THANH TOÁN — mức độ nhạy cảm cao nhất trong toàn hệ thống, nên dù rủi ro thực tế qua network thấp (jitter mạng thường lớn hơn chênh lệch đo được), vẫn đáng vá theo đúng chuẩn mật mã học.

### `src/services/auth.service.ts` — `hashesMatch()`
- Đã mô tả ở Nhóm 1 — cùng lý do/cùng kỹ thuật (`crypto.timingSafeEqual`) áp dụng cho so khớp hash OTP.

---

## Nhóm 6 — Chống lost-update khi thêm/sửa giỏ hàng đồng thời

Vá đúng phát hiện **H1** trong `15_PERFORMANCE.md` ("Cart-level stock check là read-then-write KHÔNG atomic").

### `src/services/cart.service.ts`
- **Thay đổi**:
  1. Thêm type `Db = typeof prisma | Prisma.TransactionClient` — cho phép các helper (`getCartOrThrow`, `findOwnedItem`) nhận tham số `db` tuỳ chọn, chạy được cả với `prisma` thường lẫn với `tx` bên trong transaction.
  2. `addItem`: toàn bộ logic (đọc `variant`/`cart`, kiểm tra tồn kho, đọc `existing` cart item, ghi update/create, đếm `itemCount`) được bọc trong **1 `prisma.$transaction(async (tx) => {...})`**, dùng `tx.*` thay vì `prisma.*` xuyên suốt.
  3. `updateItem`: tương tự — bọc `getCartOrThrow`/`findOwnedItem`/đọc `variant`/ghi `update` trong `$transaction`.
- **Tác dụng**: 2 request thêm/sửa cùng 1 sản phẩm trong giỏ của cùng 1 user tại cùng thời điểm (vd double-click nút "Thêm vào giỏ") không còn cùng đọc chung 1 giá trị `quantity`/`stock` cũ rồi ghi đè lên nhau — PostgreSQL tự tuần tự hoá các transaction đụng cùng row.
- **Bổ trợ cho**: `flows/cart-checkout.md`, `modules/cart.md`, gián tiếp bổ trợ tính đúng đắn của `create-order` (giỏ hàng "sạch" hơn trước khi vào bước tạo đơn, dù chốt chặn cuối cùng vẫn luôn là `order.service.ts`).
- **Vì sao cần**: Comment trong chính diff giải thích rõ: đây **không phải** chốt chặn tồn kho cuối cùng (chốt thật vẫn là `updateMany` điều kiện `stock >= quantity` trong `order.service.ts` lúc tạo đơn) — mục tiêu của thay đổi này là sửa đúng lớp lỗi "lost update" ở tầng giỏ hàng (trải nghiệm hiển thị sai số lượng/tồn kho tạm thời), không phải để thay thế cơ chế chống oversell đã đúng sẵn ở tầng đặt hàng.

---

## Nhóm 7 — Chống mass assignment khi cập nhật địa chỉ

### `src/services/user.service.ts`
- **Thay đổi**: `updateAddress` đổi `const { isDefault, ...fields } = body` thành destructure thêm `userId: _ignoredUserId, id: _ignoredId` (loại bỏ luôn 2 field này khỏi `fields` trước khi ghi Prisma), kèm ép kiểu `body as UpdateAddressBody & { userId?: string; id?: string }`.
- **Tác dụng**: Dù có field `userId`/`id` lọt qua tầng validate (vô tình hoặc cố ý gửi lên), chúng không bao giờ được spread vào lệnh `prisma.address.update(...)`.
- **Bổ trợ cho**: `validators/user.validator.ts` (`validateAddress` — mục dưới, cùng mục tiêu ở tầng validate).
- **Vì sao cần**: Đây là phòng thủ theo chiều sâu (defense in depth) — nếu chỉ dựa vào validator lọc field, một thay đổi tương lai ở validator (thêm field mới mà quên nghĩ tới rủi ro) có thể vô tình mở lại lỗ hổng "đổi chủ sở hữu địa chỉ" (gán `userId` của người khác vào bản ghi). Chặn ở tầng service (nơi thực sự ghi DB) đảm bảo an toàn ngay cả khi tầng validate có sơ suất.

### `src/validators/user.validator.ts`
- **Thay đổi**: `validateAddress` đọc thêm `isDefault` từ `req.body`, và ở cuối hàm **ghi đè `req.body`** bằng object chỉ chứa đúng whitelist field: `{ fullName, phone, province, district, ward, streetDetail, isDefault }`.
- **Tác dụng**: Loại bỏ mọi key thừa (`userId`, `id`, hoặc bất kỳ field lạ nào khác) khỏi `req.body` NGAY tại tầng validate, trước khi request đi tới controller/service.
- **Bổ trợ cho**: `user.service.ts` (`createAddress`/`updateAddress` — cả 2 hàm này sau đó spread `body` vào Prisma).
- **Vì sao cần**: Cùng mục tiêu chống mass-assignment với thay đổi ở `user.service.ts`, nhưng chặn sớm hơn (ngay tầng validate, áp dụng cho cả `createAddress` lẫn `updateAddress` vì cùng dùng chung validator này) — 2 lớp phòng thủ độc lập cho cùng 1 loại lỗ hổng.

---

## Nhóm 8 — Chính sách mật khẩu mạnh hơn (bắt buộc cả chữ và số)

Vá đúng nhận định trong `14_SECURITY.md`: "Password chỉ có rule độ dài (≥8 ký tự), không có yêu cầu độ phức tạp".

### `src/validators/common.validator.ts`
- **Thay đổi**: Thêm hàm dùng chung `checkPasswordStrength(res, password, label)` — yêu cầu tối thiểu 8 ký tự VÀ có ít nhất 1 chữ cái VÀ ít nhất 1 chữ số (không bắt ký tự đặc biệt).
- **Tác dụng**: 1 hàm validate mật khẩu duy nhất, dùng lại được ở mọi nơi cần kiểm tra mật khẩu (register, reset-password, change-password).
- **Bổ trợ cho**: `auth.validator.ts`, `user.validator.ts` (2 file dưới).
- **Vì sao cần**: Trước đây mỗi validator tự viết riêng rule `length < 8` — khi cần siết chính sách mật khẩu, phải sửa nhiều nơi (dễ sót). Gom vào 1 hàm dùng chung đúng nguyên tắc DRY, đồng thời nâng độ mạnh: chặn được các mật khẩu yếu phổ biến kiểu toàn số (`12345678`) hoặc toàn chữ (`password`) mà vẫn đủ 8 ký tự, mà không bắt ký tự đặc biệt (giữ trải nghiệm người dùng không quá khó chịu).

### `src/validators/auth.validator.ts`
- **Thay đổi**: `validateRegister` và `validateResetPassword` thay rule `password.length < 8` cũ bằng lời gọi `checkPasswordStrength(...)`.
- **Bổ trợ cho / Vì sao cần**: Áp dụng chính sách mật khẩu mạnh mới cho 2 luồng tạo mật khẩu (đăng ký, đặt lại) — xem Nhóm 8 phần trên.

### `src/validators/user.validator.ts`
- **Thay đổi**: `validateChangePassword` thay rule cũ bằng `checkPasswordStrength(...)`.
- **Bổ trợ cho / Vì sao cần**: Áp dụng cùng chính sách cho luồng đổi mật khẩu khi đã đăng nhập — đảm bảo cả 3 luồng tạo/đổi mật khẩu (register, reset, change) nhất quán cùng 1 quy tắc, tránh tình trạng "hổng 1 cửa" nếu chỉ vá 2/3 luồng.

---

## Nhóm 9 — Phòng thủ lớp 2 khi đổi role người dùng

### `src/services/admin.service.ts`
- **Thay đổi**: `updateUserRole` thêm kiểm tra `if (!VALID_ROLES.has(role as UserRole)) throw new AppError(400, ...)` NGAY TRONG SERVICE, thay vì chỉ dựa vào comment cũ "role đã được validate ở middleware".
- **Tác dụng**: Nếu một route/middleware nào đó trong tương lai gọi `updateUserRole` mà quên gắn `validateUpdateUserRole`, service vẫn tự chặn giá trị `role` không hợp lệ, không cho ghi bừa vào cột `users.role`.
- **Bổ trợ cho**: `admin.validator.ts` (`validateUpdateUserRole` — validator hiện có, không đổi trong diff này) — 2 lớp kiểm tra độc lập cho cùng 1 field nhạy cảm.
- **Vì sao cần**: Đây đúng là rủi ro đã được chỉ ra khi rà soát domain Admin: *"if this validator were ever bypassed... nothing in the service layer would stop an invalid role from being cast and persisted"* — service trước đây HOÀN TOÀN tin tưởng middleware, không có gì tự bảo vệ nếu middleware bị bỏ sót. Đây là ví dụ điển hình của nguyên tắc "không tin tưởng ngầm định vào tầng gọi" (defense in depth) — field `role` quyết định toàn bộ quyền hạn trong hệ thống RBAC, không thể chỉ dựa vào đúng 1 lớp kiểm tra duy nhất.

---

## Nhóm 10 — Hạ tầng: Prisma, kết nối DB, dependency

Nhóm này không trực tiếp vá lỗ hổng bảo mật/nghiệp vụ, mà điều chỉnh hạ tầng để tương thích với các thay đổi trên (và một số nâng cấp/dọn dẹp đi kèm).

### `package.json`
- **Thay đổi**: `prisma`/`@prisma/client`/`@prisma/adapter-pg` hạ từ `^7.8.0` xuống `^6.12.0`; `@types/multer` `^2.1.0`→`^2.2.0`; `multer` `^2.1.1`→`^2.2.0`; `nodemailer` `^8.0.11`→`^9.0.5`; thêm `dotenv` `^17.4.2` làm dependency trực tiếp (trước đó chỉ là transitive dependency, không khai báo tường minh).
- **Tác dụng**: Đổi phiên bản Prisma core stack (giảm 1 major version), cập nhật Multer lên bản vá lỗi mới nhất (liên quan/tương thích với Nhóm 3 — magic-byte validation), cập nhật Nodemailer lên major mới, khai báo tường minh `dotenv` (được `src/config/env.ts` import trực tiếp — trước đây "may mắn" có sẵn qua cây phụ thuộc của package khác).
- **Bổ trợ cho**: `prisma/schema.prisma`, `src/config/db.ts` (2 mục dưới).
- **Vì sao cần**: Việc hạ Prisma từ v7 xuống v6.12 đi kèm với việc chuyển cấu hình `url`/`directUrl` vào thẳng `datasource db {}` trong `schema.prisma` (xem mục dưới) và bật `previewFeatures = ["driverAdapters"]` — đây là cách cấu hình driver adapter chuẩn của Prisma 6.x; kèm việc xoá hẳn `prisma.config.ts` (Prisma 7 dùng file config riêng, Prisma 6 cấu hình ngay trong schema) cho thấy đây là một lần đồng bộ lại đúng API của phiên bản Prisma đang dùng, không phải thay đổi tuỳ tiện. Khai báo `dotenv` tường minh giúp build/install không phụ thuộc "may rủi" vào việc package khác có kéo theo `dotenv` hay không.

### `prisma.config.ts` (đã xoá)
- **Thay đổi**: Xoá toàn bộ file — trước đây chứa `defineConfig({ schema, migrations, datasource: { url: process.env.DIRECT_URL } })`.
- **Tác dụng**: Không còn cấu hình Prisma nằm rải ở 2 nơi (file `.ts` riêng + `schema.prisma`).
- **Bổ trợ cho**: `prisma/schema.prisma` (mục dưới — toàn bộ nội dung tương đương được chuyển vào đó).
- **Vì sao cần**: Prisma 7 (bản trước khi hạ version) dùng cơ chế `prisma.config.ts` để cấu hình migration/datasource tách khỏi `schema.prisma`; khi hạ về Prisma 6.12, cơ chế đó không còn phù hợp — cấu hình `url`/`directUrl` chuyển thẳng vào `datasource db {}` là cách làm đúng chuẩn của Prisma 6.x, tránh 2 nguồn cấu hình xung đột nhau.

### `prisma/schema.prisma` (phần generator/datasource — khác với field `resetPasswordAttempts` đã nói ở Nhóm 1)
- **Thay đổi**: `generator client` thêm `previewFeatures = ["driverAdapters"]`; `datasource db` thêm `url = env("DATABASE_URL")` và `directUrl = env("DIRECT_URL")`.
- **Tác dụng**: Khai báo tường minh 2 connection string riêng biệt — `DATABASE_URL` dùng cho runtime (qua PgBouncer/transaction pooler), `DIRECT_URL` dùng riêng cho migration (không qua pooler, vì `prisma migrate` cần session-mode connection thật để tạo advisory lock).
- **Bổ trợ cho**: `src/config/db.ts` (mục dưới), toàn bộ lệnh `npm run prisma:migrate`.
- **Vì sao cần**: Đây là pattern chuẩn khi dùng Prisma với Supabase/Neon (Postgres serverless có pooler) — nếu chỉ dùng 1 connection string qua pooler cho cả runtime lẫn migration, lệnh migrate có thể lỗi (pooler không hỗ trợ advisory lock cần thiết cho `prisma migrate`). Việc thêm `directUrl` tách riêng đúng luồng migration khỏi luồng request runtime.

### `src/config/db.ts`
- **Thay đổi**: Bỏ import `Pool` từ `pg` và bước tạo `new Pool({...})` riêng; thay bằng gọi thẳng `new PrismaPg({ connectionString, ssl })` (constructor của `PrismaPg` trong bản mới nhận thẳng config connection thay vì nhận 1 `pg.Pool` đã tạo sẵn).
- **Tác dụng**: Đơn giản hoá 2 bước (`new Pool` rồi `new PrismaPg(pool)`) thành 1 bước.
- **Bổ trợ cho**: Hệ quả trực tiếp của việc hạ `@prisma/adapter-pg` xuống `^6.12.0` (mục Nhóm 10 phần `package.json`).
- **Vì sao cần**: API của `PrismaPg` đổi giữa các phiên bản `@prisma/adapter-pg` — bản đang dùng (6.12.0) nhận trực tiếp object cấu hình connection (bao gồm `ssl`) thay vì một `pg.Pool` instance đã khởi tạo sẵn. Đây là thay đổi bắt buộc để code biên dịch/chạy được với version mới, không phải cải tiến nghiệp vụ.

---

## Test đi kèm (không phải thay đổi hành vi, nhưng xác nhận các fix trên)

| File test | Thay đổi | Xác nhận cho |
|---|---|---|
| `src/__tests__/auth.test.ts` | Thêm case `email không hợp lệ`, `OTP hết hạn`, `còn lượt thử → tăng bộ đếm không đổi mật khẩu`, `hết lượt thử → vô hiệu OTP dù đúng mã` | Nhóm 1 (chống brute-force OTP) |
| `src/__tests__/cart.test.ts` | Mock thêm `$transaction`, tự chạy callback qua `mockPrisma` | Nhóm 6 (transaction giỏ hàng) |
| `src/__tests__/chat.test.ts` | Thêm case chuyển header `x-chat-guest-token` xuống service; case 404 khi khách vãng lai không kèm guestToken | Nhóm 2 (guest chat token) |
| `src/__tests__/chat_service.test.ts` | Thêm test `createSession` cấp/không cấp `guestToken`; nhiều case 404 khi thiếu/sai `guestToken`; cập nhật mọi lời gọi `sendMessage`/`getMessages` hiện có để truyền `guestToken` hợp lệ | Nhóm 2 (guest chat token) |

Các test này đóng vai trò test hồi quy — đúng tinh thần đã thấy ở `src/__tests__/p0_guards.test.ts` (bộ test hồi quy cho 3 lỗ hổng P0 phát hiện trước đó): mỗi lỗ hổng vá xong đều có test khoá lại hành vi đúng, tránh bị vô tình revert trong tương lai.

---

## Tổng kết đối chiếu với `18_TECHNICAL_DEBT.md` / `14_SECURITY.md` (đã viết trước đó)

| Mục đã ghi nhận trong tài liệu reverse-engineering | Trạng thái sau đợt thay đổi này |
|---|---|
| TD-05 — Phiên chat vãng lai chỉ bảo vệ bằng UUID | **Đã vá** — Nhóm 2 (guest chat token) |
| TD-09 — So sánh secret webhook không constant-time | **Đã vá** — Nhóm 5 |
| H1 (`15_PERFORMANCE.md`) — Cart stock check không atomic | **Đã vá** — Nhóm 6 |
| "OTP consumption không có DB-level single-use lock, TOCTOU window" (`modules/auth.md`) | **Đã vá** — Nhóm 1 (updateMany điều kiện) |
| "Password chỉ có rule độ dài, không có yêu cầu độ phức tạp" (`14_SECURITY.md`) | **Đã vá một phần** — bắt buộc chữ+số, vẫn chưa yêu cầu ký tự đặc biệt (có chủ đích, xem Nhóm 8) |
| "`admin.validator.ts` là gate DUY NHẤT chặn role không hợp lệ" (`modules/admin.md`) | **Đã vá** — Nhóm 9 (service tự kiểm tra thêm) |
| Route catalog công khai không có rate limit (phát hiện mới trong đợt rà soát này, chưa từng ghi thành mục riêng trong `14_SECURITY.md` trước đó) | **Đã vá** — Nhóm 4 (`catalogLimiter`) |
| Upload ảnh chỉ kiểm tra đuôi/mimetype, không kiểm tra nội dung thật | **Đã vá** — Nhóm 3 (magic byte) |
| Mass assignment tiềm ẩn khi update địa chỉ | **Đã vá (chủ động, phòng ngừa)** — Nhóm 7 |
| "OTP dùng `Math.random()`, không phải CSPRNG" (`06_AUTHENTICATION.md`, `14_SECURITY.md`) | **✅ ĐÃ VÁ (đợt kế tiếp, cùng phiên làm việc)** — `forgotPasswordService` đổi sang `crypto.randomInt(100000, 1000000)` (CSPRNG). TDD: RED xác nhận trước (`vi.spyOn(crypto, 'randomInt')` chưa được gọi), rồi implement, rồi GREEN. Test: `src/__tests__/auth.test.ts` — "sinh OTP bằng CSPRNG (crypto.randomInt), không dùng Math.random". |
| TD-01 — Refresh token không đồng bộ khi đổi role/status | **✅ ĐÃ VÁ (đợt kế tiếp, cùng phiên làm việc)** — `admin.service.ts` (`updateUserRole`/`toggleUserStatus`) nay revoke toàn bộ `RefreshToken` đang hoạt động của user mục tiêu, trong cùng `prisma.$transaction` với việc đổi role/status (helper `revokeUserSessions`). `refreshTokenService` giữ nguyên — không cần sửa vì token cũ đã bị revoke từ phía admin action. TDD: RED xác nhận trước (assert `refreshToken.updateMany` được gọi đúng tham số, ban đầu fail vì chưa implement), rồi implement, rồi GREEN — cả 2 route (role + status) đều có test. Residual: access token đang cầm tại thời điểm bị đổi quyền vẫn sống tới hạn tự nhiên (≤15 phút) — giới hạn cố hữu của JWT stateless, không phải lỗ hổng còn sót. |

**Cập nhật (đợt kế tiếp, cùng phiên làm việc)**: cả 2 mục "còn tồn đọng" nêu ở bản trước của tài liệu này (TD-01 và OTP `Math.random()`) đã được vá bằng TDD (test thất bại trước → code tối thiểu → test qua), không có regression trên 460 test hiện có. Đã đồng bộ lại các mục tương ứng trong `be_mobivexa/docs/06_AUTHENTICATION.md`, `07_AUTHORIZATION.md`, `14_SECURITY.md`, `18_TECHNICAL_DEBT.md` (TD-01), `modules/auth.md`, `modules/admin.md`.

**Phát hiện phụ trong lúc đối chiếu**: khi cross-check để cập nhật các doc trên, phát hiện thêm 2 mục khác trong `18_TECHNICAL_DEBT.md`/`15_PERFORMANCE.md` (TD-05 — IDOR phiên chat vãng lai; H1 — cart stock check không atomic) mô tả đúng tình trạng code TẠI THỜI ĐIỂM các agent phân tích ban đầu đọc — nhưng đã được vá bởi CHÍNH đợt thay đổi Nhóm 1-10 mô tả trong tài liệu này trước khi các doc đó được rà soát lại lần cuối. Đã sửa các mục đó để phản ánh đúng thực tế code hiện tại; không phải lỗi của đợt vá — chỉ là tài liệu bị lệch nhịp giữa 2 lần đọc code.
