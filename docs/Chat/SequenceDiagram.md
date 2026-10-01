# Sequence Diagram — Luồng API
## Module: Chat
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01

---

## SD-01: Một lượt chat hoàn chỉnh

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (FE)
    participant M as Middleware chuỗi
    participant S as ChatService (orchestrator)
    participant A as Agent (Gemini)
    participant DB as PostgreSQL

    C->>M: POST /api/chat { sessionId?, message }
    M->>M: optionalAuthenticate → validate → chatLimiter (phút rồi ngày)
    M-->>C: 400/429/503 JSON nếu bị chặn trước khi mở stream

    M->>S: streamChatReply({ sessionId, message, user, signal })
    S->>DB: chatSession.findUnique / create / claim (AD-02)
    S-->>C: event: session { sessionId }

    S->>DB: chatMessage.create (USER) — lưu TRƯỚC khi gọi LLM
    Note over S,DB: LLM chết thì ý định của khách vẫn còn trong history

    S->>A: runAgentTurn(history 10 tin cuối, message, user, signal)
    loop Tối đa 4 lượt gọi model / 3 vòng tool
        A-->>C: event: delta { text } (stream từng đoạn)
        A->>A: executeTool khi model đòi (SD-02/SD-03)
    end
    A-->>S: { answerText, lastToolName }

    par Song song khi persist câu trả lời
        S->>DB: chatMessage.create (ASSISTANT, toolName)
    and
        S->>DB: chatSession.update updatedAt
    end
    S-->>C: event: done { messageId, sessionId }
```

> Heartbeat `: ping` mỗi 15 giây trong suốt stream, chống proxy cắt kết nối tưởng chết.

---

## SD-02: Tool tìm sản phẩm — event products bắn ngay

```mermaid
sequenceDiagram
    autonumber
    participant A as Agent (Gemini)
    participant T as ToolRegistry
    participant PS as ProductService
    participant C as Client (FE)

    A->>T: executeTool("search_products", args)
    T->>T: Chuẩn hoá: bỏ dấu, ip→iphone, 5tr→5000000, strip intent
    alt Thiếu từ khoá lẫn khoảng giá
        T-->>A: { result: "empty_query", note } — model hỏi lại khách
    else OK
        T->>PS: listProducts({ search, brand?, minPrice?, maxPrice?, page 1, limit 5 })
        alt 0 kết quả và có brand
            T->>PS: listProducts bỏ brand, thêm note "đã bỏ lọc brand"
        end
        T-->>C: event: products { items: ChatProductCard[] }
        T-->>A: functionResponse (tối đa 4000 ký tự)
    end
```

> `ChatProductCard` = `{ id, slug, name, brand, salePrice, originalPrice, imageUrl }` — giá ưu tiên variant rẻ nhất **có giá > 0**.

---

## SD-03: Tool riêng tư — ownership bám server

```mermaid
sequenceDiagram
    autonumber
    participant A as Agent (Gemini)
    participant T as ToolRegistry
    participant DB as PostgreSQL

    alt Guest đòi gọi tool userOnly (get_order_status / check_coupon)
        A->>T: executeTool(name, args, user = undefined)
        T-->>A: { result: "blocked", note } — KHÔNG thực thi, model mời đăng nhập
    else Customer
        A->>T: executeTool(name, args, user) — userId do SERVER inject
        Note over T: Không bao giờ nhận userId từ tham số LLM
        T->>DB: order.findFirst WHERE userId + (id = X OR orderCode = X)
        alt Không tìm thấy
            T-->>A: { result: "not_found", note } — model nói thật, không bịa đơn
        else OK
            DB-->>T: order + items + sepayTx mới nhất (select hẹp)
            T-->>A: { result: "success", order: compactOrder }
        end
    end
```

> `compactOrder` trả nhãn trạng thái tiếng Việt (Chờ xác nhận / Đã xác nhận / Đang giao / Đã giao / Đã huỷ) kèm trạng thái thanh toán SePay.

---

## SD-04: Claim session — guest đăng nhập giữa chừng

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (FE)
    participant S as ChatService
    participant DB as PostgreSQL

    Note over C: Guest đã chat vài lượt, FE giữ sessionId (session.userId = null)
    C->>S: POST /api/chat { sessionId cũ, message } + Bearer token mới
    S->>DB: chatSession.findUnique(sessionId)
    DB-->>S: session (userId = null)
    S->>DB: chatSession.update { userId }
    Note over S: CLAIM — lịch sử đi theo tài khoản, không đọc lại DB
    S->>DB: chatMessage.findMany WHERE sessionId, take 10
    Note over S: Context gồm cả tin nhắn khi còn guest
    S-->>C: event: session { sessionId } (giữ nguyên ID)
```

---

## SD-05: Session của người khác — phủ nhận, không đọc

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (FE)
    participant S as ChatService
    participant DB as PostgreSQL

    C->>S: POST /api/chat { sessionId của user khác }
    S->>DB: chatSession.findUnique(sessionId)
    DB-->>S: session (userId ≠ người hiện tại)
    Note over S: session.userId ≠ null và ≠ user?.userId → coi như KHÔNG tồn tại
    S->>DB: chatSession.create (session mới, title = tin nhắn đầu cắt 60 ký tự)
    S-->>C: event: session { sessionId MỚI }
    Note over C: Không bao giờ đọc/ghi context của người khác kể cả khi guest gửi nhầm ID
```
