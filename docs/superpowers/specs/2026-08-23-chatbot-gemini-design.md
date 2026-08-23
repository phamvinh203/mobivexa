# Thiết kế: Chatbot tư vấn sản phẩm dùng Gemini API

- **Ngày:** 2026-08-23
- **Trạng thái:** Đã duyệt thiết kế, chờ lập kế hoạch triển khai
- **Phạm vi:** Backend `be_mobivexa`

---

## 1. Mục tiêu

Thêm một trợ lý hội thoại vào cửa hàng, trả lời được các câu hỏi kiểu:

- "Có điện thoại nào tầm 10 triệu không?"
- "So sánh giúp tôi hai máy này"
- "Máy X còn hàng màu đen không? Giá bao nhiêu?"

Câu trả lời phải dựa trên **dữ liệu thật trong database**, không phải kiến thức
chung của mô hình. Giá và tồn kho sai là lỗi nghiêm trọng hơn cả việc bot không
trả lời được.

### Ngoài phạm vi (có chủ đích)

| Bị loại | Lý do |
|---|---|
| Streaming SSE | Trả JSON một lần khớp với phần còn lại của API và dễ test hơn nhiều; nâng cấp sau nếu còn thời gian |
| Vector search / pgvector | `listProducts` đã có full-text search sẵn sàng dùng; thêm pgvector kéo theo extension, job re-index và nguy cơ giá/tồn kho lệch |
| Tool ghi dữ liệu (thêm giỏ hàng, áp mã) | Bot chỉ đọc. Không có tool ghi thì không có đường nào để prompt injection sửa dữ liệu |
| Tra cứu đơn hàng cá nhân | Cần kiểm soát quyền chặt hơn; tách thành giai đoạn sau |
| Dashboard admin xem hội thoại | Dữ liệu đã được lưu, dựng UI sau khi luồng chính chạy ổn |

---

## 2. Quyết định kỹ thuật

### 2.1 SDK và model

- Thư viện: `@google/genai` — SDK chính thức hiện hành của Google. Không dùng
  `@google/generative-ai` (bản cũ đã ngừng hỗ trợ).
- Model mặc định: `gemini-2.5-flash` — độ trễ thấp, chi phí thấp, hỗ trợ
  function calling. Đặt qua biến môi trường để đổi model không cần sửa code.

Biến môi trường mới trong `.env.local`:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_API_KEY` **chỉ tồn tại ở backend**. Frontend không bao giờ gọi thẳng
Gemini — key nằm trong bundle client là key bị lộ.

### 2.2 Vì sao function calling thay vì nhồi dữ liệu vào prompt

Gemini nhận mô tả của vài hàm, tự quyết định gọi hàm nào với tham số gì; backend
chạy Prisma query thật rồi trả kết quả về cho model viết câu trả lời.

Ưu điểm so với việc nhét danh sách sản phẩm vào prompt:

- Giá và tồn kho luôn là dữ liệu tại thời điểm hỏi, không cần đồng bộ lại
- Không giới hạn số lượng sản phẩm bởi kích thước context
- Model chỉ chọn *tham số*, không sinh SQL — bề mặt tấn công hẹp

---

## 3. Schema

Hai bảng mới trong `prisma/schema.prisma`:

```prisma
enum ChatRole {
  USER
  MODEL
}

model ChatSession {
  id        String   @id @default(uuid())
  userId    String?
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  messages ChatMessage[]

  @@index([userId, updatedAt])
  @@map("chat_sessions")
}

model ChatMessage {
  id        String   @id @default(uuid())
  sessionId String
  role      ChatRole
  content   String
  toolCalls Json?
  createdAt DateTime @default(now())

  session ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@map("chat_messages")
}
```

Ghi chú thiết kế:

- `userId` **nullable**: khách chưa đăng nhập vẫn chat được — đây chính là nhóm
  cần tư vấn nhất. `onDelete: SetNull` để xoá tài khoản không xoá mất hội thoại
  đã lưu (khác với `Favorite` dùng Cascade, vì hội thoại là dữ liệu thống kê).
- `toolCalls` (Json, nullable) lưu vết bot đã tra cứu gì ở mỗi lượt trả lời:
  tên tool, tham số, số kết quả. Dùng để debug khi bot trả lời sai và làm dữ
  liệu minh hoạ cho báo cáo đồ án.
- `@@index([sessionId, createdAt])` phục vụ trọn truy vấn lấy N tin nhắn gần
  nhất — đúng pattern index gộp đang dùng ở `ProductSpec`.
- `title` sinh tự động từ 60 ký tự đầu của tin nhắn đầu tiên trong phiên, chỉ
  đặt một lần. Dùng để hiển thị danh sách hội thoại — không có nó thì mọi phiên
  trông giống hệt nhau.
- Thêm quan hệ ngược `chatSessions ChatSession[]` vào model `User`.

---

## 4. Kiến trúc và luồng dữ liệu

Bám đúng phân tầng hiện có: `route → validator → middleware → controller →
service`. Controller không chứa business logic, service không chạm `req`/`res`.

```
POST /api/chat/messages
  │
  ├─ chatLimiter          (rate limit)
  ├─ optionalAuthenticate (có token thì gắn req.user, không có vẫn cho qua)
  ├─ validateSendMessage  (kiểm tra sessionId, message)
  │
  └─ chat.controller.sendMessage
       └─ chat.service.sendMessage
            1. Lấy/tạo ChatSession, kiểm tra quyền sở hữu
            2. Lấy 10 ChatMessage gần nhất làm ngữ cảnh
            3. Gọi Gemini: system prompt + lịch sử + khai báo tool
            4. Nếu model yêu cầu gọi tool:
                 → chatbot_tools thực thi (Prisma)
                 → gửi kết quả về model
                 → lặp lại, TỐI ĐA 3 vòng
            5. Lưu ChatMessage của user và của bot
            6. Trả { sessionId, reply, products[] }
```

### 4.1 Vì sao giới hạn 3 vòng tool

Vòng lặp gọi tool về lý thuyết không có điểm dừng: model có thể liên tục yêu cầu
tra cứu thêm. Mỗi vòng là một lần gọi API tính phí và một lần truy vấn DB. Ba
vòng đủ cho tình huống thực tế nặng nhất (liệt kê danh mục → tìm sản phẩm → xem
chi tiết để so sánh). Chạm trần thì dừng và trả về câu trả lời cuối model đưa ra
kèm lời nhắc người dùng hỏi cụ thể hơn — không ném lỗi.

### 4.2 Vì sao chỉ lấy 10 tin nhắn gần nhất

Toàn bộ lịch sử được gửi lại ở mỗi lượt, nên hội thoại càng dài chi phí càng
tăng. Mười tin nhắn (khoảng 5 lượt qua lại) đủ giữ mạch "cái đó", "máy kia" mà
không để một phiên chat dài vô tình đốt quota.

---

## 5. API

Prefix `/api/chat`, mount trong `src/routes/index.route.ts`.

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/chat/sessions` | optional | Tạo phiên mới, trả `{ sessionId }` |
| POST | `/api/chat/messages` | optional | Gửi tin nhắn, nhận câu trả lời |
| GET | `/api/chat/sessions/:id/messages` | optional | Lấy lịch sử của một phiên |

### POST /api/chat/messages

Request:

```json
{ "sessionId": "uuid", "message": "Có điện thoại nào tầm 10 triệu không?" }
```

`sessionId` **không bắt buộc**. Thiếu nó thì service tạo phiên mới và trả
`sessionId` trong response — frontend chỉ cần lưu lại cho các lượt sau. Nhờ vậy
lượt chat đầu tiên chỉ tốn một request. `POST /api/chat/sessions` vẫn giữ, dành
cho trường hợp muốn mở phiên trống trước khi người dùng gõ gì.

Response 200:

```json
{
  "sessionId": "uuid",
  "reply": "Trong tầm 10 triệu bên mình có mấy mẫu đáng chú ý...",
  "products": [
    { "id": "...", "name": "...", "slug": "...", "salePrice": "9990000", "imageUrl": "..." }
  ]
}
```

`products[]` là dữ liệu có cấu trúc trích từ kết quả tool, để frontend render
thành card sản phẩm bấm được. Nếu chỉ có `reply` dạng văn bản, bot sẽ phải đọc
link bằng chữ — vừa xấu vừa dễ sai. Mảng rỗng khi lượt trả lời không tra cứu
sản phẩm nào.

### Quy tắc sở hữu phiên

- Phiên có `userId = null`: ai cầm `sessionId` cũng đọc/ghi được. `sessionId` là
  uuid v4 nên không đoán được; đây là đánh đổi có ý thức để khách vãng lai dùng
  được mà không cần đăng nhập.
- Phiên có `userId`: chỉ đúng user đó truy cập. Người khác nhận **404** (không
  phải 403 — 403 xác nhận phiên có tồn tại).
- User đã đăng nhập gửi tin vào phiên ẩn danh: gán `userId` cho phiên đó (nhận
  phiên về tài khoản mình).

---

## 6. Bộ tool cho Gemini

Khai báo trong `src/services/chatbot_tools.ts`. Tất cả **chỉ đọc**.

| Tool | Tham số | Trả về |
|---|---|---|
| `searchProducts` | `keyword?`, `categorySlug?`, `brandSlug?`, `priceMin?`, `priceMax?`, `limit` (≤8) | Danh sách sản phẩm rút gọn |
| `getProductDetail` | `slug` | Chi tiết: mô tả, thông số, các biến thể kèm giá và tồn kho |
| `listCategories` | — | Danh mục đang hoạt động |
| `listBrands` | — | Thương hiệu đang hoạt động |

### 6.1 Tái sử dụng service sẵn có

`searchProducts` gọi lại `productService.listProducts(query)` ở **chế độ public**
(không truyền `admin`), không viết query mới. Hàm này đã có:

- full-text search qua GIN index (`to_tsvector` trên `name`)
- lọc theo `category`, `brand`, `tag`, khoảng giá
- `where.isActive = true` — sản phẩm ẩn không bao giờ lọt ra
- phân trang và giới hạn `take`

Viết query song song sẽ tạo ra hai định nghĩa "sản phẩm nào được phép hiển thị",
và sớm muộn chúng sẽ lệch nhau.

Lưu ý về giá: giá nằm ở `ProductVariant.salePrice`, không phải ở `Product`. Lọc
theo khoảng giá là "sản phẩm có ít nhất một biến thể trong khoảng" —
`listProducts` đã xử lý đúng như vậy.

### 6.2 Rút gọn dữ liệu trước khi đưa vào model

Kết quả Prisma **không** được đưa nguyên vẹn cho Gemini. Một `Product` kèm quan
hệ có thể rất nặng vì `description` chứa HTML của RichTextEditor với ảnh nhúng
base64. Mỗi tool có một hàm map riêng, chỉ giữ các trường model thực sự cần:
`id`, `name`, `slug`, `salePrice`, `originalPrice`, `stock`, `category.name`,
`brand.name`, ảnh bìa. `description` chỉ xuất hiện ở `getProductDetail` và bị
cắt thẻ HTML cùng giới hạn độ dài.

---

## 7. System prompt và rào chắn

System prompt (hằng số trong `chat.service.ts`) quy định:

1. **Vai trò**: nhân viên tư vấn của cửa hàng, xưng hô thân thiện, trả lời bằng
   tiếng Việt.
2. **Chỉ dùng dữ liệu từ tool**: không được nêu giá, tồn kho hay tên sản phẩm mà
   tool không trả về. Không có kết quả thì nói thẳng là shop chưa có, không suy
   đoán.
3. **Giới hạn chủ đề**: chỉ tư vấn quanh sản phẩm và dịch vụ của cửa hàng. Câu
   hỏi ngoài phạm vi thì từ chối lịch sự và kéo về chủ đề mua sắm.
4. **Không hứa hẹn**: không cam kết giảm giá, thời gian giao hàng hay chính sách
   mà dữ liệu không thể hiện.

Rào chắn ở tầng code (system prompt là hướng dẫn, không phải cơ chế bảo vệ):

- Không có tool ghi → không thao tác nào của bot thay đổi được dữ liệu
- Mọi tool ép giới hạn `take` ở phía server, model không tự nâng được
- Độ dài `message` bị giới hạn ở validator (2000 ký tự)
- `chatLimiter` chặn spam ở tầng HTTP

Nội dung người dùng nhập là **dữ liệu, không phải mệnh lệnh**: nếu ai đó gõ "bỏ
qua hướng dẫn trước đó", điều tệ nhất xảy ra là bot trả lời lạc đề — vì không có
tool nào để họ lợi dụng.

---

## 8. Xử lý lỗi

| Tình huống | Xử lý |
|---|---|
| Thiếu `GEMINI_API_KEY` | Ném lỗi ngay khi khởi động, không để chạy rồi mới lỗi lúc có request |
| Gemini timeout / 5xx | `AppError(503, 'Trợ lý đang bận, vui lòng thử lại sau ít phút')` |
| Hết quota (429) | `AppError(503, ...)` cùng thông báo — người dùng không cần biết chi tiết quota |
| Tool ném lỗi | Bắt lại, trả cho model dạng `{ error: '...' }` để nó tự diễn đạt, không làm sập cả request |
| `sessionId` không tồn tại / không thuộc user | `AppError(404, 'Không tìm thấy phiên trò chuyện')` |

Timeout gọi Gemini: 30 giây. Toàn bộ lỗi đi qua `errorHandler` sẵn có; không có
chi tiết lỗi từ Gemini nào lọt ra response (log ở server thì có).

---

## 9. Files

### Thêm mới

```
src/config/gemini.ts               Khởi tạo client, đọc + kiểm tra env
src/services/chatbot_tools.ts      Khai báo tool + hàm thực thi + map rút gọn
src/services/chat.service.ts       Vòng lặp hội thoại, quản lý phiên
src/controllers/chat.controller.ts
src/routes/chat.route.ts
src/validators/chat.validator.ts
src/types/chat.type.ts
prisma/migrations/<ts>_add_chat/   Migration 2 bảng + enum ChatRole
src/__tests__/chat.test.ts
```

### Sửa

| File | Thay đổi |
|---|---|
| `prisma/schema.prisma` | `ChatSession`, `ChatMessage`, `enum ChatRole`, quan hệ ngược ở `User` |
| `src/routes/index.route.ts` | Mount `/api/chat` |
| `src/middlewares/auth.middleware.ts` | Thêm `optionalAuthenticate` |
| `src/middlewares/rate_limit.middleware.ts` | Thêm `chatLimiter` |
| `package.json` | Thêm `@google/genai` |

`chatLimiter`: 15 tin nhắn/phút cho mỗi IP. Chặt hơn các limiter khác vì mỗi
request tốn quota Gemini chứ không chỉ tốn CPU. Vẫn dùng `makeLimiter` sẵn có
để giữ nguyên hành vi `skip` trong môi trường test.

`optionalAuthenticate`: có `Authorization: Bearer` hợp lệ thì gắn `req.user`;
không có header, hoặc token hỏng/hết hạn, thì `next()` bình thường với
`req.user` undefined. Token hỏng **không** trả 401 — với endpoint này, khách có
token cũ vẫn nên chat được như khách vãng lai.

---

## 10. Kiểm thử

Vitest + supertest, theo pattern trong `src/__tests__`. Client Gemini được mock
— test không gọi API thật (chậm, tốn tiền, kết quả không ổn định).

Các trường hợp bắt buộc có:

1. Gửi tin nhắn → nhận `reply`, và cả tin của user lẫn tin của bot đều được lưu
2. Model yêu cầu gọi tool → tool chạy, kết quả được gửi lại, câu trả lời cuối
   chứa dữ liệu từ tool
3. Model gọi tool liên tục → dừng ở vòng 3, vẫn trả về 200
4. Khách vãng lai (không token) tạo phiên và chat được
5. User A không đọc được phiên của user B → 404
6. `message` rỗng hoặc quá 2000 ký tự → 400
7. Gemini ném lỗi → 503, không lộ chi tiết lỗi gốc
8. `searchProducts` không trả về sản phẩm `isActive: false`

Trường hợp 8 quan trọng nhất về mặt an toàn dữ liệu: nó khoá cứng ranh giới giữa
dữ liệu nội bộ và dữ liệu bot được phép nói ra.

---

## 11. Ghi chú vận hành

- Free tier của Gemini API đủ cho phát triển và demo đồ án. Mỗi lượt trả lời có
  gọi tool tốn khoảng 2–4 lần gọi API (tính cả vòng lặp tool).
- `gemini-2.5-flash` là mặc định; đổi `GEMINI_MODEL` sang bản mạnh hơn nếu chất
  lượng tư vấn chưa đạt — không cần sửa code.
- Chưa có cơ chế dọn `ChatSession` cũ. Với quy mô đồ án thì chưa cần; nếu triển
  khai thật thì thêm job xoá phiên ẩn danh quá 30 ngày.
