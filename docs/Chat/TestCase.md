# Test Case Document
## Module: Chat
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01  
> **Framework:** Vitest + Supertest (chat.test.ts, chat.qa.test.ts)

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| POST /chat — validate body | 5 |
| Rate limit & feature flag | 4 |
| SSE hợp đồng event | 4 |
| Session ownership & claim | 4 |
| Tool công khai | 6 |
| Tool riêng tư | 5 |
| Agent & fallback | 4 |
| **Tổng** | **32** |

---

## TC-VAL: Validate body

### TC-VAL-01: message rỗng → 400

**Input:** `POST /api/chat { "message": "   " }`  
**Expected:** HTTP `400` `Tin nhắn không được để trống`; **không** đốt hạn mức chat

---

### TC-VAL-02: message dài quá 2000 ký tự → 400

**Expected:** `400` `Tin nhắn tối đa 2000 ký tự`

---

### TC-VAL-03: sessionId dài quá 64 ký tự → 400

**Expected:** `400` `sessionId không hợp lệ`

---

### TC-VAL-04: Body lỗi trả trước khi mở stream

**Expected:** Response là JSON `{ "message": ... }` với status rõ ràng, **không** phải `text/event-stream`

---

### TC-VAL-05: Thiếu field message → 400

**Input:** `{}`  
**Expected:** `400` `Tin nhắn không được để trống`

---

## TC-LIMIT: Rate limit & feature flag

### TC-LIMIT-01: Guest vượt 5 tin/phút → 429

**Expected:** `429` `Bạn nhắn tin quá nhanh, vui lòng chờ một lát`; lượt bị chặn ở phút **không** tính vào sàn ngày

---

### TC-LIMIT-02: Guest vượt 20 tin/ngày → 429 với message riêng

**Expected:** `429` `Bạn đã dùng hết hạn mức chat, vui lòng thử lại sau 24 giờ`

---

### TC-LIMIT-03: User và guest không chung counter

**Precondition:** Guest (cùng IP) đã dùng 5 lượt  
**Action:** Đăng nhập, tiếp tục chat  
**Expected:** User có hạn mức riêng 10/phút + 50/ngày — không bị chặn vì lượt của guest

---

### TC-LIMIT-04: CHATBOT_ENABLED ≠ 'true' → 503

**Expected:** `503` `Chatbot đang tạm tắt, vui lòng thử lại sau` — JSON thật (chặn trước khi mở stream)

---

## TC-SSE: Hợp đồng event

### TC-SSE-01: event đầu tiên luôn là session

**Expected:** `event: session` với `data: {"sessionId": "..."}` đúng 1 field

---

### TC-SSE-02: delta stream từng đoạn

**Expected:** Nhiều event `delta { text }` — ghép liên tiếp được câu trả lời hoàn chỉnh

---

### TC-SSE-03: Hợp đồng data ghim cứng

**Expected:** `session` chỉ có `{sessionId}`; `delta` chỉ có `{text}`; `done` chỉ có `{messageId, sessionId}` — không nhét `type` vào data

---

### TC-SSE-04: Lỗi sau khi headers bắn → event error

**Precondition:** `GEMINI_API_KEY` chưa cấu hình  
**Expected:** Stream mở 200, nhận `event: error` với `code: 503` và message thân thiện, rồi stream kết thúc

---

## TC-SESSION: Ownership & claim

### TC-SESSION-01: Guest được tạo session với userId null

**Input:** POST không có token  
**Expected:** `event: session` trả sessionId mới; lịch sử được lưu (lượt sau tiếp tục được)

---

### TC-SESSION-02: Claim — guest đăng nhập giữa chừng

**Precondition:** Session guest có 2 tin nhắn cũ  
**Input:** POST tiếp với sessionId cũ + Bearer token  
**Expected:** Cùng `sessionId` trả về; context gồm cả 2 tin cũ; session gắn userId

---

### TC-SESSION-03: Session của user khác → tạo phiên mới

**Precondition:** Session S1 thuộc user A  
**Input:** POST với `sessionId = S1` của user B  
**Expected:** `event: session` trả sessionId **mới**; không đọc/ghi context của A

---

### TC-SESSION-04: Tiêu đề phiên = tin nhắn đầu cắt 60 ký tự

**Expected:** `chat_sessions.title` = 60 ký tự đầu của message đầu tiên

---

## TC-TOOL-PUBLIC: Tool công khai

### TC-TOOL-PUBLIC-01: search_products chuẩn hoá viết tắt và bỏ dấu

**Input:** khách gõ "chi ei may choi gam duoi 8tr"  
**Expected:** Log `[Chat] search_products query` cho thấy trước: câu gốc, sau: từ khoá đã bỏ dấu/có brand, maxPrice 8000000; chỉ sản phẩm `isActive=true` được trả

---

### TC-TOOL-PUBLIC-02: search_products thiếu mọi tín hiệu → không nổ listing

**Expected:** Tool trả `empty_query` — model hỏi lại, không gọi listProducts

---

### TC-TOOL-PUBLIC-03: Brand đoán sai → tự bỏ lọc brand

**Input:** brand "apple" (không trong danh sách)  
**Expected:** Tra lại bỏ brand, kèm note; `event: products` vẫn bắn card khi có kết quả

---

### TC-TOOL-PUBLIC-04: get_product_detail trả variants và thông số

**Expected:** variants (màu/RAM/bộ nhớ/giá/tồn kho), tối đa 10 dòng specs, card ưu tiên variant giá > 0

---

### TC-TOOL-PUBLIC-05: search_blog giữ nguyên dấu tiếng Việt

**Input:** query "chọn máy chơi game"  
**Expected:** Trả tối đa 3 bài (title, slug, excerpt); query bỏ dấu trả 0 bài — không chuẩn hoá như search_products

---

### TC-TOOL-PUBLIC-06: get_reviews trả tóm tắt và phân bố sao

**Precondition:** Sản phẩm chưa có đánh giá  
**Expected:** Trả `totalCount: 0` kèm note — model nói thật, không bịa điểm

---

## TC-TOOL-PRIVATE: Tool riêng tư

### TC-TOOL-PRIVATE-01: Guest gọi get_order_status → không thực thi

**Expected:** Tool trả `{ result: "blocked", note }` — model mời đăng nhập, **không crash**, stream tiếp diễn

---

### TC-TOOL-PRIVATE-02: Guest không thấy tool userOnly trong declaration

**Expected:** `toolDeclarationsFor(undefined)` chỉ gồm 4 tool công khai

---

### TC-TOOL-PRIVATE-03: Tra đơn luôn scope theo userId của server

**Precondition:** Đơn D1 của user A  
**Input:** user B (qua tool) đòi tra D1  
**Expected:** `not_found` — model nói thật, không lộ thông tin đơn của A; không bao giờ nhận userId từ tham số LLM

---

### TC-TOOL-PRIVATE-04: Bỏ trống orderId → 3 đơn gần nhất

**Precondition:** User có 5 đơn  
**Expected:** Trả đúng 3 đơn mới nhất, mỗi đơn có nhãn trạng thái tiếng Việt + trạng thái SePay mới nhất

---

### TC-TOOL-PRIVATE-05: check_coupon trả valid/reason thật

**Expected:** Dùng lại previewCoupon — mã hết hạn/hết lượt trả lý do thật; model không đoán thêm điều kiện

---

## TC-AGENT: Agent & fallback

### TC-AGENT-01: Model câm → câu fallback

**Expected:** Stream `delta` câu fallback mời "Kết nối nhân viên"; câu này được lưu vào history như tin ASSISTANT

---

### TC-AGENT-02: Chạm trần output → nối dấu …

**Precondition:** `finishReason = MAX_TOKENS`  
**Expected:** Thêm `delta` với text `…`, không cắt cụt im lặng

---

### TC-AGENT-03: Client ngắt giữa chừng — vẫn persist phần đã stream

**Action:** Đóng kết nối khi đang nhận delta  
**Expected:** Server dừng gọi model (không burn quota), tin ASSISTANT trong DB chứa phần chữ đã stream; **không** lưu fallback cho người đã đi

---

### TC-AGENT-04: Model 429/503 → rơi xuống model dự phòng

**Expected:** Thử model kế sau backoff 1.2s; lỗi cấu hình (key sai, model không tồn tại) ném ngay thành `event: error`, không che giấu

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| 400 không đốt hạn mức (validate trước limiter) | TC-VAL-01 |
| Hạn mức tách vai + cửa sổ trôi 24h | TC-LIMIT-01..03 |
| Feature flag 503 thật trước stream | TC-LIMIT-04 |
| Hợp đồng SSE ghim cứng | TC-SSE-01..03 |
| Lỗi sau headers → event error | TC-SSE-04 |
| Claim guest→user giữ lịch sử | TC-SESSION-02 |
| Chặn đọc context người khác | TC-SESSION-03 |
| Chuẩn hoá query / chặn empty_query | TC-TOOL-PUBLIC-01, 02 |
| Giữ dấu cho search_blog | TC-TOOL-PUBLIC-05 |
| Guest bị chặn tool userOnly, không crash | TC-TOOL-PRIVATE-01, 02 |
| Ownership đơn hàng bám server | TC-TOOL-PRIVATE-03 |
| Fallback + persist khi client ngắt | TC-AGENT-01, 03, 04 |
