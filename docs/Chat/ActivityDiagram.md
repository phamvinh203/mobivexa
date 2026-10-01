# Activity Diagram
## Module: Chat
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01

---

## AD-01: Luồng request POST /api/chat

```mermaid
flowchart TD
    Start([Client POST /api/chat]) --> Identify[optionalAuthenticate\nBearer hợp lệ → req.user\nkhông/kém → guest, không bao giờ 401]
    Identify --> Validate{validateSendMessage}
    Validate -- sessionId > 64 ký tự --> E400a[400 sessionId không hợp lệ]
    Validate -- message rỗng --> E400b[400 Tin nhắn không được để trống]
    Validate -- message > 2000 ký tự --> E400c[400 Tin nhắn tối đa 2000 ký tự]
    Validate -- OK --> Limiter1{Limiter phút\nuser 10 / guest 5}
    Limiter1 -- Vượt --> E429a[429 Bạn nhắn tin quá nhanh...]
    Limiter1 -- OK --> Limiter2{Limiter ngày cửa sổ trôi 24h\nuser 50 / guest 20}
    Limiter2 -- Vượt --> E429b[429 Bạn đã dùng hết hạn mức chat...]
    Limiter2 -- OK --> Flag{CHATBOT_ENABLED = true?}
    Flag -- Không --> E503[503 Chatbot đang tạm tắt...]
    Flag -- Có --> Open[200 + text/event-stream\nheartbeat : ping mỗi 15s]
    Open --> Stream[streamChatReply yield từng event]
    Stream -- lỗi sau khi headers bắn --> ErrEvent[event: error code + message\nrồi kết thúc stream]
    Stream -- OK --> Done[event: session → delta* → products* → done]
```

> Validate đứng **trước** limiter: 400 không đốt hạn mức của guest (20/ngày).

---

## AD-02: Resolve session (ownership + claim)

```mermaid
flowchart TD
    Start([Có sessionId do FE gửi]) --> Find[chatSession.findUnique id]
    Find --> Exists{Session tồn tại?}
    Exists -- Không --> Create[create session mới\nuserId = user?.userId ?? null\ntitle = tin nhắn đầu cắt 60 ký tự]
    Exists -- Có --> Owner{session.userId ≠ null\nvà ≠ user hiện tại?}
    Owner -- Có, kể cả guest --> Discard[Bỏ session — tạo session mới\nKHÔNG đọc/ghi context người khác]
    Owner -- Không --> Guest{session.userId = null\nvà user đã đăng nhập?}
    Guest -- Có --> Claim[CLAIM: update userId vào session\ndùng luôn object đang có]
    Guest -- Không --> Reuse[Dùng tiếp session]
    Create --> Emit[event: session sessionId]
    Discard --> Emit
    Claim --> Emit
    Reuse --> Emit
```

---

## AD-03: Vòng agent tool-calling

```mermaid
flowchart TD
    Start([runAgentTurn]) --> LoadContext[history = 10 tin nhắn cuối của phiên\n+ tin nhắn mới của khách đã lưu DB]
    LoadContext --> Call[Gọi Gemini stream\nmaxOutputTokens 2048\nthinkingBudget 0]
    Call --> Stream{Chunk có chữ?}
    Stream -- Có --> Delta[delta += text\ngửi event delta ra SSE]
    Stream -- Có functionCall --> Tool[executeTool theo TOOL_REGISTRY]
    Delta --> Calls{Model đòi tool\nvà còn vòng?}
    Calls -- Không --> End{answerText rỗng?}
    Calls -- Có, tool userOnly + guest --> Blocked[Không thực thi — trả ghi chú blocked\nmodel mời đăng nhập]
    Calls -- Có --> Exec[Thực thi tool\nuserId do server inject]
    Exec --> Card{Tool có card sản phẩm?}
    Card -- Có --> Products[event: products items\nbắn NGAY khi tool trả]
    Card -- Không --> Truncate[truncateToolResult ≤ 4000 ký tự\nđưa functionResponse về model]
    Products --> Truncate
    Truncate --> Call
    Blocked --> Truncate
    End -- Có, client chưa ngắt --> Fallback[delta câu fallback thân thiện]
    End -- Không --> Save[lưu tin nhắn ASSISTANT\ntoolName = tool cuối]
    Fallback --> Save
    Save --> Done[event: done messageId + sessionId]
```

> Tối đa 4 lượt gọi model / 3 vòng tool. Model 429/503 → rơi xuống model dự phòng trong chuỗi, chờ 1.2s. Lỗi cấu hình khác ném ngay, không che giấu.

---

## AD-04: Client ngắt kết nối giữa chừng

```mermaid
flowchart TD
    Trigger([Client đóng tab / huỷ fetch]) --> Res[res phát close\nnghe trên res, KHÔNG phải req\nreq close ngay với POST JSON]
    Res --> Abort[AbortController.abort]
    Abort --> Loop[Vòng lặp agent dừng gọi Gemini\nkhông burn quota]
    Loop --> Drain[Controller vẫn kéo generator chạy hết\nchỉ thôi ghi vào socket đã đóng]
    Drain --> Persist[Service persist phần chữ đã stream\nkhông lưu fallback cho người đã đi]
    Persist --> Clean[clearInterval heartbeat\nres.end]
```
