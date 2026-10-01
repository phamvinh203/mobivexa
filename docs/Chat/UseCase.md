# Use Case Document
## Module: Chat
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-10-01

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Guest** | Khách chưa đăng nhập — được chat, dùng 4 tool công khai, hạn mức thấp hơn |
| **Customer** | Khách đã đăng nhập — dùng thêm 2 tool riêng (tra đơn, kiểm mã), hạn mức cao hơn |
| **Gemini (LLM)** | Sinh câu trả lời, đòi gọi tool khi cần dữ liệu cửa hàng |
| **PostgreSQL** | Lưu phiên (ChatSession) và tin nhắn (ChatMessage) |

---

## 2. Danh sách Use Case

| ID | Tên | Actor | Ưu tiên |
|---|---|---|---|
| UC-01 | Gửi tin nhắn nhận tư vấn | Guest, Customer | Cao |
| UC-02 | Tìm sản phẩm qua chatbot | Guest, Customer | Cao |
| UC-03 | Tìm bài viết tư vấn | Guest, Customer | Trung bình |
| UC-04 | Xem tóm tắt đánh giá sản phẩm | Guest, Customer | Trung bình |
| UC-05 | Tra trạng thái đơn hàng | Customer | Cao |
| UC-06 | Kiểm tra mã giảm giá | Customer | Trung bình |
| UC-07 | Tiếp tục phiên chat sau khi đăng nhập (claim session) | Customer | Trung bình |

> **Không có:** quản lý phiên chat cho Admin, xoá/sửa tin nhắn, gửi ảnh trong chat.

---

## 3. Chi tiết Use Case

---

### UC-01: Gửi tin nhắn nhận tư vấn

| | |
|---|---|
| **Actor** | Guest hoặc Customer |
| **Mục tiêu** | Nhận câu trả lời tư vấn stream từng đoạn (SSE) |
| **Tiền điều kiện** | `CHATBOT_ENABLED=true`; body hợp lệ |
| **Hậu điều kiện** | Tin nhắn của khách + câu trả lời được lưu vào DB |

**Luồng chính:**
1. `POST /api/chat { sessionId?, message }`
2. Token Bearer (nếu có) chỉ dùng để nhận diện — token hỏng/hết hạn vẫn coi là guest, **không bao giờ 401**
3. Validate body → rate limit theo vai (user/guest) → mở stream SSE
4. Trả chuỗi event: `session` → `delta`* → (`products`)* → `done`

**Đặc điểm:**
- Mọi request hợp lệ đều được lưu lịch sử — kể cả guest (session với `userId = null`)
- Client ngắt giữa chừng: server dừng gọi model nhưng vẫn lưu phần chữ đã stream
- Model câm → câu fallback thân thiện, mời bấm "Kết nối nhân viên"

---

### UC-02: Tìm sản phẩm qua chatbot

| | |
|---|---|
| **Actor** | Guest, Customer |
| **Mục tiêu** | Tư vấn máy theo nhu cầu/ngân sách, hiển thị card sản phẩm |
| **Tiền điều kiện** | Trong luồng UC-01 |
| **Hậu điều kiện** | Không đổi dữ liệu |

**Luồng chính:**
1. Model gọi tool `search_products(search?, brand?, minPrice?, maxPrice?)`
2. Query được chuẩn hoá: bỏ dấu tiếng Việt, đổi viết tắt (`ip` → `iphone`, `ss` → `samsung`, `xmi` → `xiaomi`), nở `5tr` → 5000000
3. Gọi `listProducts` (chỉ sản phẩm đang bán, tối đa 5 kết quả)
4. Model đòi chi tiết → tool `get_product_detail(slug)` trả variants, giá từng bản, tồn kho, thông số
5. FE nhận event `products` kèm card render ngay khi tool trả kết quả

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| Không có từ khoá lẫn khoảng giá | Trả `empty_query` — model hỏi lại khách, không nổ listing |
| Brand đoán sai, 0 kết quả | Tự bỏ lọc brand, tra lại, nói rõ với khách |
| Không có máy thỏa | Model nói thật, gợi ý phương án gần nhất |

---

### UC-03: Tìm bài viết tư vấn

| | |
|---|---|
| **Actor** | Guest, Customer |
| **Mục tiêu** | Gợi ý bài viết blog liên quan câu hỏi |
| **Tiền điều kiện** | Trong luồng UC-01 |
| **Hậu điều kiện** | Không đổi dữ liệu |

**Luồng chính:**
1. Model gọi tool `search_blog(query)`
2. Từ khoá giữ NGUYÊN dấu tiếng Việt (FTS `simple` của blog khớp từng token đúng dấu — khác cách chuẩn hoá của `search_products`)
3. Trả tối đa 3 bài: title, slug, excerpt

---

### UC-04: Xem tóm tắt đánh giá sản phẩm

| | |
|---|---|
| **Actor** | Guest, Customer |
| **Mục tiêu** | Nhắc điểm trung bình, phân bố sao của sản phẩm |
| **Tiền điều kiện** | Trong luồng UC-01 |
| **Hậu điều kiện** | Không đổi dữ liệu |

**Luồng chính:**
1. Model gọi tool `get_reviews(slug)`
2. Trả `averageRating`, `totalCount`, phân bố breakdown từng sao
3. Chưa có đánh giá → model nói thật "sản phẩm chưa có đánh giá nào"

---

### UC-05: Tra trạng thái đơn hàng

| | |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Xem trạng thái đơn + thanh toán SePay của chính mình |
| **Tiền điều kiện** | Đã đăng nhập (tool `userOnly`); trong luồng UC-01 |
| **Hậu điều kiện** | Không đổi dữ liệu |

**Luồng chính:**
1. Model gọi tool `get_order_status(orderId?)`
2. `userId` do server inject — **không bao giờ nhận từ tham số LLM**
3. Bỏ trống `orderId` → trả tối đa 3 đơn gần nhất
4. Có `orderId` → khớp cả ID lẫn mã đơn `ORD-...`, luôn scope theo `userId`

**Luồng thay thế:**

| Điều kiện | Xử lý |
|---|---|
| Guest gọi tool | Không thực thi — trả ghi chú `blocked`, model mời đăng nhập (không ép buộc) |
| Không tìm thấy đơn trong các đơn của user | Trả `not_found`, model nói thật, không bịa thông tin đơn |

---

### UC-06: Kiểm tra mã giảm giá

| | |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Biết mã có dùng được cho giỏ hàng hiện tại hay không |
| **Tiền điều kiện** | Đã đăng nhập (tool `userOnly`); trong luồng UC-01 |
| **Hậu điều kiện** | Không đổi dữ liệu |

**Luồng chính:**
1. Model gọi tool `check_coupon(code)`
2. Dùng lại nghiệp vụ `previewCoupon` — trả `valid`, `discount`, `subtotal`, lý do nếu không dùng được
3. Mã không dùng được → model nói thật lý do, không đoán thêm điều kiện

---

### UC-07: Tiếp tục phiên chat sau khi đăng nhập (claim session)

| | |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Lịch sử chat khi còn guest đi theo tài khoản |
| **Tiền điều kiện** | Đang có session guest (`userId = null`) do FE giữ |
| **Hậu điều kiện** | Session được gắn `userId` |

**Luồng chính:**
1. FE gửi tiếp `sessionId` cũ kèm Bearer token mới đăng nhập
2. Server thấy session guest + user đã đăng nhập → **CLAIM**: update `userId` vào session
3. Lịch sử cũ được dùng làm context; các lượt sau tra đơn/coupon bình thường

**Bảo vệ ownership:**

| Điều kiện | Xử lý |
|---|---|
| Session của user khác (kể cả guest gửi nhầm ID) | Bỏ session đó, tạo session mới — không bao giờ đọc/ghi context người khác |
| `sessionId` không tồn tại | Tạo session mới, trả `sessionId` mới qua event `session` |

---

## 4. Quan hệ Use Cases

```
UC-01 Gửi tin nhắn (SSE)
   │
   ├─ UC-02 search_products + get_product_detail ──► event products (card FE)
   ├─ UC-03 search_blog
   ├─ UC-04 get_reviews
   ├─ UC-05 get_order_status    ── chỉ Customer, userId do server inject
   └─ UC-06 check_coupon        ── chỉ Customer, userId do server inject
                     │
        UC-07 claim session: guest đăng nhập giữa chừng
        → lịch sử giữ nguyên, mở khoá UC-05/UC-06
```

---

## 5. So sánh vai Guest / Customer

| Tiêu chí | Guest | Customer |
|---|---|---|
| Số tool được khai báo cho model | 4 | 6 |
| Tra đơn hàng / mã giảm giá | ❌ (mời đăng nhập) | ✅ |
| Hạn mức chat | 5/phút + 20/ngày | 10/phút + 50/ngày |
| Lịch sử | Theo sessionId tạm | Claim theo userId |
| Context mỗi lượt | 10 tin nhắn cuối | 10 tin nhắn cuối |
