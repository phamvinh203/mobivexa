# SRS — Software Requirement Specification
## Module: Chat
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01 | **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Endpoints tổng quan

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/chat` | Tuỳ chọn (optional) | Gửi tin nhắn, nhận câu trả lời SSE stream |

**Module chỉ có 1 endpoint.** Middleware trên route theo thứ tự: `optionalAuthenticate` → `validateSendMessage` → `chatLimiter` (phút → ngày) → controller. LLM: Google Gemini qua `@google/genai`, cấu hình bằng `GEMINI_API_KEY`, chuỗi model `GEMINI_MODEL` (mặc định `gemini-3-flash-preview`) + `GEMINI_MODEL_FALLBACKS` (mặc định `gemini-3.1-flash-lite`).

---

## 2. Schema dữ liệu

### Bảng `chat_sessions` (ChatSession)

| Trường | Kiểu | Nullable | Ghi chú |
|---|---|---|---|
| `id` | string uuid | No | PK |
| `userId` | string | **Yes** | FK → User; Cascade; null = guest |
| `title` | string | No | Tin nhắn đầu của phiên, cắt 60 ký tự |
| `createdAt` / `updatedAt` | DateTime | No | `updatedAt` chạm mỗi lượt bot trả lời |

### Bảng `chat_messages` (ChatMessage)

| Trường | Kiểu | Nullable | Ghi chú |
|---|---|---|---|
| `id` | string uuid | No | PK |
| `sessionId` | string | No | FK → ChatSession; Cascade |
| `role` | enum `ChatRole` | No | `USER` / `ASSISTANT` |
| `content` | string | No | Nội dung |
| `toolName` | string | Yes | Tool cuối đã gọi — chỉ để debug/đối chiếu |
| `createdAt` | DateTime | No | — |

- Index: `chat_sessions(userId)`; `chat_messages(sessionId, createdAt)` — phục vụ "10 tin nhắn cuối của phiên"
- Giới hạn nội dung: `MAX_CHAT_MESSAGE_LENGTH = 2000` ký tự; `CHAT_HISTORY_LIMIT = 10` tin nhắn context

---

## 3. Yêu cầu chức năng

### FR-01: Gửi tin nhắn — SSE stream

| | |
|---|---|
| **Endpoint** | `POST /api/chat` |
| **Auth** | Tuỳ chọn — `optionalAuthenticate` nhận diện Bearer token; token hỏng/hết hạn coi như guest, **không bao giờ 401** |

**Body:** `{ sessionId?: string (≤64), message: string (1–2000 ký tự) }`

**Xử lý (thứ tự cố ý):**
1. Validate body → 400 JSON ngay, **không đốt hạn mức** (validate đứng trước limiter)
2. Rate limit 2 tầng theo vai (FR-06)
3. Feature flag `CHATBOT_ENABLED !== 'true'` → 503 JSON, chặn **trước khi** mở stream
4. Mở stream: `200` + `text/event-stream`, header `X-Accel-Buffering: no` (nginx không buffer), heartbeat `: ping` mỗi 15 giây
5. Event theo hợp đồng ghim cứng: `session` → `delta`* → (`products`)* → `done`; lỗi sau khi headers bắn → `event: error { code, message }`

**Client ngắt giữa chừng:** `res` phát `close` → AbortController dừng gọi model/tool (nghe trên `res`, không phải `req` — từ Node 16, `req` phát `close` ngay khi POST JSON) — controller vẫn kéo generator chạy hết để service persist phần chữ đã stream.

---

### FR-02: Phiên chat — ownership và claim

**Resolve session (3 nhánh):**
1. Session có chủ (`userId ≠ null`) mà không khớp người hiện tại → coi như **không tồn tại**, tạo session mới (không bao giờ đọc/ghi context người khác)
2. Session guest (`userId = null`) + người hiện tại đã đăng nhập → **CLAIM**: update `userId`, lịch sử đi theo tài khoản
3. Session mới hoặc khớp chủ → dùng tiếp; `title` = tin nhắn đầu cắt 60 ký tự

**Persist:** tin nhắn của khách lưu **trước** khi gọi LLM; câu trả lời lưu kèm `toolName` của tool cuối; `updatedAt` session chạm cùng lúc (Promise.all).

---

### FR-03: Vòng agent tool-calling

- Tối đa **4 lượt gọi model / 3 vòng tool** mỗi lượt chat; vòng cuối ép trả chữ (không khai báo tool)
- `maxOutputTokens` 2048, `thinkingBudget: 0` (ưu tiên độ trễ thấp), giữ nguyên `thoughtSignature` giữa các vòng (thiếu là Gemini 400)
- Model 429/503 → thử model kế trong chuỗi fallback, backoff 1.2s; lỗi khác (key sai, model không tồn tại) ném ngay
- Model câm → câu fallback thân thiện (mời "Kết nối nhân viên"); bị cắt vì chạm trần output → nối dấu `…`
- Kết quả mỗi tool chặn tối đa 4000 ký tự trước khi trả về model

---

### FR-04: Bộ 6 tool

| Tool | Quyền | Đầu vào | Nguồn dữ liệu / hành vi |
|---|---|---|---|
| `search_products` | Công khai | `search?` (≤120), `brand?` (≤60), `minPrice?`, `maxPrice?` (≥0) | `listProducts` — chỉ máy đang bán, limit 5. Chuẩn hoá query: bỏ dấu, `ip→iphone`, `ss→samsung`, `xmi→xiaomi`, nở `5tr→5000000`, tách `iphone15`, strip từ ý định. Thiếu mọi tín hiệu → `empty_query`. Brand đoán sai + 0 kết quả → bỏ brand tra lại, nói rõ với khách |
| `get_product_detail` | Công khai | `slug` (bắt buộc) | Variants (màu/RAM/bộ nhớ/giá/tồn kho), tối đa 10 thông số, mô tả thu text ≤500. Card ưu tiên variant có giá > 0 |
| `search_blog` | Công khai | `query` (bắt buộc) | `searchPosts` limit 3 — giữ nguyên dấu tiếng Việt (FTS `simple` khớp từng token đúng dấu), khác cách chuẩn hoá của `search_products` |
| `get_reviews` | Công khai | `slug` (bắt buộc) | `averageRating`, `totalCount`, phân bố breakdown từng sao |
| `get_order_status` | Chỉ đăng nhập | `orderId?` (≤60) | Khớp cả ID lẫn mã `ORD-...` (UPPERCASE); bỏ trống → tối đa 3 đơn gần nhất. Luôn `WHERE userId` — **userId do server inject, không bao giờ nhận từ LLM**. Trả nhãn trạng thái tiếng Việt + trạng thái SePay mới nhất |
| `check_coupon` | Chỉ đăng nhập | `code` (≤40) | Dùng lại `previewCoupon` — trả `valid`, `discount`, `subtotal`, lý do nếu không dùng được |

**Guest gọi tool `userOnly`:** không thực thi, không crash — trả `{ result: 'blocked', note }` để model mời đăng nhập (không ép buộc). Lỗi nghiệp vụ (404/400) thành ghi chú cho model, không đứt stream.

---

### FR-05: System prompt và chính sách tĩnh

- Nhân vật: "Trợ lý mua sắm Mobivexa", xưng "em" — gọi "anh/chị", giọng nhân viên tại quầy
- Chỉ nêu model/giá/thông số/tồn kho từ kết quả tool; không tìm thấy → nói thật
- Chính sách (bảo hành 12 tháng máy mới / 6 tháng like-new, đổi mới 30 ngày, freeship từ 5 triệu, thanh toán SePay/COD…) là **khối hằng số trong mã nguồn** — DB chưa có bảng chính sách; đổi nội dung = sửa hằng số
- Bảo vệ prompt injection: không tiết lộ hướng dẫn/API key/cấu trúc DB kể cả khi bị yêu cầu "bỏ qua hướng dẫn trước đó"
- Tool được khai báo cho model **lọc theo quyền**: guest chỉ thấy 4 tool công khai

---

### FR-06: Rate limit theo vai (NFR-chat-001)

| Vai | Mỗi phút | Mỗi ngày |
|---|---|---|
| Customer (key theo `userId`) | 10 | 50 |
| Guest (key theo IP chuẩn hoá `ipKeyGenerator`) | 5 | 20 |

- Sàn phút đứng trước: bị chặn ở phút không tính vào sàn ngày
- Cửa sổ ngày là **cửa sổ trôi 24h** tính từ lượt đầu (không reset lúc nửa đêm)
- 429 body: `{ "message": "Bạn nhắn tin quá nhanh, vui lòng chờ một lát" }` / `{ "message": "Bạn đã dùng hết hạn mức chat, vui lòng thử lại sau 24 giờ" }`; kèm header `RateLimit-*` draft-7
- UUID và IP không bao giờ trùng — user với guest không chung counter dù chung store

---

## 4. Yêu cầu phi chức năng

| | |
|---|---|
| **Streaming** | SSE đúng hợp đồng `event: <tên>\ndata: <JSON 1 dòng>\n\n`; heartbeat 15s; `X-Accel-Buffering: no` chống buffer proxy |
| **Chi phí** | Hạn mức 2 tầng theo vai; feature flag `CHATBOT_ENABLED` tắt nhanh trả 503 thật; dừng gọi model khi client ngắt |
| **Ownership** | Session của user khác → tạo phiên mới; tool riêng tư bám `userId` server; không bao giờ nhận userId từ LLM |
| **Bền bỉ** | Fallback model 429/503 + backoff; fallback câu trả lời khi model câm; persist ý định khách trước khi gọi LLM |
| **Quan sát được** | Log `[Chat] tool call` (tool, userId, args) và log trước/sau chuẩn hoá query phục vụ QA |
