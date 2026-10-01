# API Specification
## Module: Chat
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01  
> **Base URL:** `/api/chat`  
> **Auth:** Không bắt buộc — Bearer token (nếu có) chỉ dùng để nhận diện Customer; token hỏng/hết hạn không bị chặn, request đi tiếp như guest

---

### POST /chat
Gửi tin nhắn cho chatbot tư vấn, nhận câu trả lời dạng **SSE stream** (`text/event-stream`).

**Auth:** Tuỳ chọn — Bearer token mở tool tra đơn/mã giảm giá  
**Content-Type:** `application/json`

**Request body:**
```json
{
  "sessionId": "uuid-phiên-hiện-tại",
  "message": "Cho em xin máy chơi game dưới 8 triệu"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `sessionId` | string | ❌ | String ≤ 64 ký tự; không có/không tồn tại → tạo phiên mới |
| `message` | string | ✅ | Không rỗng, tối đa 2000 ký tự |

**Thứ tự middleware trên route:** `optionalAuthenticate` → `validateSendMessage` → `chatLimiter` → controller. Validate đứng **trước** limiter: body lỗi trả 400 JSON ngay mà không đốt hạn mức.

---

#### Lỗi JSON (trước khi mở stream — FE đọc status bình thường)

| HTTP | Điều kiện | Message |
|---|---|---|
| 400 | `sessionId` không phải string hoặc dài quá 64 | `sessionId không hợp lệ` |
| 400 | `message` rỗng/không phải string | `Tin nhắn không được để trống` |
| 400 | `message` dài quá 2000 ký tự | `Tin nhắn tối đa 2000 ký tự` |
| 429 | Vượt hạn mức phút | `Bạn nhắn tin quá nhanh, vui lòng chờ một lát` |
| 429 | Vượt hạn mức ngày | `Bạn đã dùng hết hạn mức chat, vui lòng thử lại sau 24 giờ` |
| 503 | `CHATBOT_ENABLED !== 'true'` | `Chatbot đang tạm tắt, vui lòng thử lại sau` |

Response lỗi luôn có dạng `{ "message": "..." }`.

---

#### Rate limit (NFR-chat-001)

Mỗi vai có sàn phút (chống spam liên tiếp) **và** sàn ngày (chống cháy quota LLM). Key = `userId` nếu đã đăng nhập, không thì IP chuẩn hoá (`ipKeyGenerator`).

| Vai | Mỗi phút | Mỗi ngày |
|---|---|---|
| Customer (đã đăng nhập) | 10 | 50 |
| Guest (key theo IP) | 5 | 20 |

- Cửa sổ ngày là **cửa sổ trôi 24h** tính từ lượt đầu (không reset lúc nửa đêm)
- Sàn phút đứng trước: request bị chặn ở phút không tính vào sàn ngày
- Header `RateLimit-*` chuẩn draft-7 kèm mỗi response

---

#### Response 200 — SSE stream

```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

Mỗi event đi ra đúng hợp đồng `event: <tên>\ndata: <JSON 1 dòng>\n\n`. Bình luận nhịp tim `: ping` mỗi 15 giây giữ kết nối sống.

**Danh sách event:**

| Event | Data | Ý nghĩa |
|---|---|---|
| `session` | `{ "sessionId": "..." }` | Luôn là event đầu — FE lấy sessionId để dùng cho các lượt sau |
| `delta` | `{ "text": "..." }` | Một đoạn chữ của câu trả lời; FE ghép liên tiếp |
| `products` | `{ "items": [ChatProductCard] }` | Bắn ngay khi tool tìm sản phẩm trả kết quả |
| `done` | `{ "messageId": "...", "sessionId": "..." }` | Kết thúc — câu trả lời đã được lưu DB |
| `error` | `{ "code": 500, "message": "..." }` | Chỉ xảy ra **sau** khi headers đã bắn; FE đọc code + message |

**`ChatProductCard`:**
```json
{
  "id": "prod-uuid",
  "slug": "iphone-15-pro",
  "name": "iPhone 15 Pro",
  "brand": "iPhone",
  "salePrice": 27990000,
  "originalPrice": 31990000,
  "imageUrl": "https://res.cloudinary.com/.../image/upload/....jpg"
}
```

**Ví dụ một lượt stream:**
```
event: session
data: {"sessionId":"a1b2c3d4-..."}

event: delta
data: {"text":"Dưới 8 triệu em có vài máy "}

event: delta
data: {"text":"chơi game tốt cho anh/chị nhé:"}

event: products
data: {"items":[{"id":"...","slug":"...","name":"...","brand":"...","salePrice":7500000,"originalPrice":8000000,"imageUrl":"..."}]}

event: done
data: {"messageId":"f9e8...","sessionId":"a1b2c3d4-..."}
```

**Lỗi trong stream (`event: error`):**

| code | Điều kiện |
|---|---|
| 503 | `GEMINI_API_KEY` chưa cấu hình — `Chatbot chưa được cấu hình, vui lòng thử lại sau` |
| 500 | Lỗi không phân loại — `Có lỗi khi xử lý tin nhắn, vui lòng thử lại` |

> Từ lúc headers đã bắn, mọi lỗi đều chuyển thành `event: error` rồi kết thúc stream — không còn cách nào đổi HTTP status.

---

#### Hành vi ngắt kết nối và giới hạn agent

| Tình huống | Hành vi server |
|---|---|
| Client đóng tab/huỷ fetch giữa chừng | Dừng gọi model/tool ngay (AbortController), vẫn lưu phần chữ đã stream vào history |
| Model câm (chạm cap tool, stream đứt sớm) | Bắn câu fallback: `Xin lỗi anh/chị, em chưa xử lý được yêu cầu này. Anh/chị thử hỏi lại theo cách khác, hoặc bấm "Kết nối nhân viên" để shop hỗ trợ trực tiếp nhé.` |
| Model bị cắt vì chạm trần output | Nối dấu `…` vào cuối câu thay vì im lặng cắt cụt |
| Model 429/503 | Thử model dự phòng theo chuỗi `GEMINI_MODEL` → `GEMINI_MODEL_FALLBACKS`, chờ backoff 1.2s giữa các lượt |

**Giới hạn mỗi lượt:** tối đa 4 lượt gọi model (3 vòng tool-call); context = 10 tin nhắn cuối của phiên; `maxOutputTokens` 2048; kết quả mỗi tool bị chặn tối đa 4000 ký tự.

---

## Tool chatbot có thể gọi

Tool do model đòi gọi trong luồng chat, **không phải endpoint HTTP**. `userId` cho tool riêng tư luôn do server inject — không bao giờ nhận từ tham số LLM.

| Tool | Quyền | Mục đích |
|---|---|---|
| `search_products` | Công khai | Tìm máy theo từ khoá/thương hiệu/khoảng giá (tối đa 5 kết quả) |
| `get_product_detail` | Công khai | Variants, giá từng bản, tồn kho, thông số theo slug |
| `search_blog` | Công khai | Tìm tối đa 3 bài viết blog (giữ nguyên dấu tiếng Việt) |
| `get_reviews` | Công khai | Điểm trung bình + phân bố sao theo slug |
| `get_order_status` | Chỉ đăng nhập | Đơn hàng + trạng thái SePay của chính user (tối đa 3 đơn gần nhất nếu bỏ trống) |
| `check_coupon` | Chỉ đăng nhập | Mã giảm giá có dùng được cho giỏ hiện tại |

> Guest không được khai báo 2 tool riêng tư. Model vẫn có thể đòi gọi tên tool cấm — server **không thực thi**, trả ghi chú `blocked` để model mời khách đăng nhập (không ép buộc).
