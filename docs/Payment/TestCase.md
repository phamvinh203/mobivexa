# Tài Liệu Kiểm Thử Module Thanh Toán - Payment Module

## Tổng Quan
Module thanh toán quản lý quy trình thanh toán qua chuyển khoản ngân hàng với tích hợp webhook SePay, bao gồm:
- Tạo mã QR thanh toán
- Xử lý webhook từ SePay
- Quản lý trạng thái thanh toán
- Thống kê thanh toán cho admin

---

## 1. UNIT TESTS - Kiểm Thử Đơn Vị (8 Tests)

### UT-01: Hàm buildQrUrl() - Tạo URL QR với tham số đúng
**Mô tả**: Kiểm tra hàm tạo URL mã QR VietQR với các tham số chính xác

**Điều kiện tiên quyết**:
- Biến môi trường `SEPAY_BANK_ID`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME` đã được cấu hình
- Hàm `buildQrUrl()` có thể được import và test độc lập

**Các bước thực hiện**:
1. Import hàm `buildQrUrl()` từ payment service
2. Gọi hàm với orderCode = 'ORD-20240101-AABBCC' và amount = 500000
3. Kiểm tra URL trả về có đúng format VietQR
4. Xác nhận các tham số trong URL (amount, addInfo, accountName)

**Kết quả mong đợi**:
- URL trả về có format: `https://img.vietqr.io/image/{BANK_ID}-{ACCOUNT_NO}-compact2.jpg?amount=500000&addInfo=ORD-20240101-AABBCC&accountName={ACCOUNT_NAME}`
- URL có thể truy cập được và hiển thị mã QR hợp lệ
- Các tham số được encode đúng định dạng URL

**Ưu tiên**: Cao
**Loại test**: Positive

---

### UT-02: Regex Order Code - Khớp mẫu /ORD-\d{8}-[0-9A-F]{6}/i
**Mô tả**: Kiểm tra regex trích xuất mã đơn hàng từ nội dung chuyển khoản

**Điều kiện tiên quyết**:
- Biến `ORDER_CODE_RE` đã được định nghĩa trong payment service

**Các bước thực hiện**:
1. Tạo các test case với nội dung chuyển khoản khác nhau
2. Test case đúng: "Thanh toan ORD-20240101-AABBCC" → khớp
3. Test case đúng: "ORD-20241231-ABCDEF" → khớp
4. Test case sai: "ORD-2024-AB" → không khớp
5. Test case sai: "ord-20240101-aabbcc" → khớp (case-insensitive)

**Kết quả mong đợi**:
- Regex khớp chính xác với format `ORD-YYYYMMDD-XXXXXX` (YYYYMMDD: 8 chữ số, XXXXXX: 6 ký tự hex)
- Regex hoạt động case-insensitive
- Regex không khớp với các định dạng sai

**Ưu tiên**: Cao
**Loại test**: Positive

---

### UT-03: Webhook transferType Validation - Từ chối giao dịch 'out'
**Mô tả**: Kiểm tra webhook chỉ xử lý giao dịch nhận tiền (transferType = 'in')

**Điều kiện tiên quyết**:
- Service `processSePayWebhook()` có thể test độc lập

**Các bước thực hiện**:
1. Gọi `processSePayWebhook()` với payload có transferType = 'out'
2. Payload đầy đủ các trường khác (content, transferAmount, transactionDate)
3. Kiểm tra kết quả trả về

**Kết quả mong đợi**:
- Trả về `{ handled: false }` mà không throw error
- Không thực hiện bất kỳ database update nào
- Function kết thúc sớm ngay ở bước đầu tiên

**Ưu tiên**: Cao
**Loại test**: Negative

---

### UT-04: OrderCode Parsing - Trích xuất mã đơn từ nội dung
**Mô tả**: Kiểm tra trích xuất orderCode từ field content sử dụng regex

**Điều kiện tiên quyết**:
- Regex ORDER_CODE_RE đã được định nghĩa

**Các bước thực hiện**:
1. Test với content = "Thanh toan ORD-20240101-AABBCC" → "ORD-20240101-AABBCC"
2. Test với content = "Chuyen khoan ORD-20240520-123456 cam on" → "ORD-20240520-123456"
3. Test với content = "No order code here" → null
4. Test với content = "Multiple ORD-20240101-AABBCC and ORD-20240102-BBCCDD" → match đầu tiên

**Kết quả mong đợi**:
- Trích xuất chính xác orderCode từ nội dung chuyển khoản
- Chuyển đổi sang uppercase (ORD-20240101-AABBCC)
- Trả về null nếu không tìm thấy khớp

**Ưu tiên**: Cao
**Loại test**: Positive

---

### UT-05: Amount Validation - Kiểm tra transferAmount === order.total
**Mô tả**: Kiểm tra số tiền chuyển khoản khớp với tổng tiền đơn hàng

**Điều kiện tiên quyết**:
- Order tồn tại trong database với total = 500000

**Các bước thực hiện**:
1. Mock order với total = 500000
2. Gọi webhook với transferAmount = 500000 → handled: true
3. Gọi webhook với transferAmount = 499999 → handled: false
4. Gọi webhook với transferAmount = 500001 → handled: false
5. Gọi webhook với transferAmount = 100000 → handled: false

**Kết quả mong đợi**:
- Chỉ chấp nhận khi transferAmount KHÁC HỆT bằng order.total (so sánh strictly equal)
- Số chênh lệch哪怕 1 đồng cũng bị từ chối
- Trả về `{ handled: false }` khi số tiền không khớp

**Ưu tiên**: Cao
**Loại test**: Positive/Negative

---

### UT-06: TransactionDate Validation - Parse được ngày giao dịch
**Mô tả**: Kiểm tra parsing và validate ngày giao dịch từ SePay

**Điều kiện tiên quyết**:
- Payload có field transactionDate theo format string

**Các bước thực hiện**:
1. Test với transactionDate = "2024-01-01 10:00:00" → parsed successfully
2. Test với transactionDate = "2024-12-31 23:59:59" → parsed successfully
3. Test với transactionDate = "invalid-date" → handled: false
4. Test với transactionDate = "" → handled: false
5. Test với transactionDate = null → handled: false

**Kết quả mong đợi**:
- Date hợp lệ được parse thành công bằng `new Date()`
- Date không hợp lệ (isNaN) trả về `{ handled: false }`
- Không throw error khi parse date thất bại

**Ưu tiên**: Trung bình
**Loại test**: Positive/Negative

---

### UT-07: Idempotency Check - Bỏ qua nếu đơn đã PAID
**Mô tả**: Kiểm tra webhook idempotent - không xử lý lại đơn đã thanh toán

**Điều kiện tiên quyết**:
- Order có paymentStatus = 'PAID' trong database

**Các bước thực hiện**:
1. Mock order với paymentStatus = 'PAID'
2. Gửi webhook với payload hợp lệ cho order này
3. Kiểm tra kết quả và database

**Kết quả mong đợi**:
- Trả về `{ handled: false }` ngay khi phát hiện order đã PAID
- Không thực hiện UPDATE database
- Function kết thúc sớm, không throw error
- Đảm bảo idempotent - gửi nhiều lần webhook giống nhau không gây lỗi

**Ưu tiên**: Cao
**Loại test**: Positive/Edge

---

### UT-08: Auto-confirm Logic - PENDING → CONFIRMED khi thanh toán
**Mô tả**: Kiểm tra logic tự động chuyển trạng thái đơn khi thanh toán thành công

**Điều kiện tiên quyết**:
- Order có status = 'PENDING' và paymentStatus = 'UNPAID'
- Webhook với payload hợp lệ

**Các bước thực hiện**:
1. Mock order với status = 'PENDING', paymentStatus = 'UNPAID'
2. Gửi webhook với amount và orderCode đúng
3. Kiểm tra database update

**Kết quả mong đợi**:
- paymentStatus cập nhật từ 'UNPAID' → 'PAID'
- paidAt được set với transactionDate từ webhook
- status cập nhật từ 'PENDING' → 'CONFIRMED' (chỉ khi gốc là PENDING)
- Nếu status gốc khác PENDING, chỉ cập nhật paymentStatus

**Ưu tiên**: Cao
**Loại test**: Positive

---

## 2. INTEGRATION TESTS - Kiểm Thử Tích Hợp (7 Tests)

### IT-01: Get Payment Info - Lấy thông tin thanh toán đơn BANK_TRANSFER hợp lệ
**Mô tả**: Kiểm tra API GET /api/orders/:id/payment với đơn hàng chuyển khoản hợp lệ

**Điều kiện tiên quyết**:
- User đã đăng nhập và có JWT token hợp lệ
- Đơn hàng tồn tại với paymentMethod = 'BANK_TRANSFER'
- Đơn hàng chưa thanh toán (paymentStatus = 'UNPAID')
- User là chủ đơn hàng (userId khớp)

**Các bước thực hiện**:
1. Tạo đơn hàng với paymentMethod = 'BANK_TRANSFER', total = 500000
2. Login để lấy JWT token của user sở hữu đơn hàng
3. Gọi GET /api/orders/{order_id}/payment với Authorization header
4. Kiểm tra response

**Kết quả mong đợi**:
- HTTP Status: 200 OK
- Response body chứa:
  - `bankId`: Mã ngân hàng từ env
  - `accountNo`: Số tài khoản từ env
  - `accountName`: Tên tài khoản từ env
  - `amount`: 500000 (số tiền đơn hàng)
  - `content`: Mã đơn hàng (orderCode)
  - `qrUrl`: URL đầy đủ của mã QR VietQR

**Ưu tiên**: Cao
**Loại test**: Positive

---

### IT-02: Get Payment Info - Từ chối đơn COD (400)
**Mô tả**: Kiểm tra API từ chối đơn hàng thanh toán COD

**Điều kiện tiên quyết**:
- Đơn hàng tồn tại với paymentMethod = 'COD'
- User đã đăng nhập

**Các bước thực hiện**:
1. Tạo đơn hàng với paymentMethod = 'COD'
2. Gọi GET /api/orders/{order_id}/payment với Authorization header
3. Kiểm tra response

**Kết quả mong đợi**:
- HTTP Status: 400 Bad Request
- Response body chứa error message: "Đơn hàng không dùng phương thức chuyển khoản ngân hàng"
- Không trả về thông tin thanh toán

**Ưu tiên**: Cao
**Loại test**: Negative

---

### IT-03: Get Payment Info - Từ chối đơn đã thanh toán (400)
**Mô tả**: Kiểm tra API từ chối khi đơn hàng đã được thanh toán

**Điều kiện tiên quyết**:
- Đơn hàng tồn tại với paymentStatus = 'PAID'
- User đã đăng nhập

**Các bước thực hiện**:
1. Tạo đơn hàng với paymentStatus = 'PAID'
2. Gọi GET /api/orders/{order_id}/payment với Authorization header
3. Kiểm tra response

**Kết quả mong đợi**:
- HTTP Status: 400 Bad Request
- Response body chứa error message: "Đơn hàng đã được thanh toán"
- Không trả về thông tin thanh toán

**Ưu tiên**: Cao
**Loại test**: Negative

---

### IT-04: Get Payment Info - Đơn không tồn tại (404)
**Mô tả**: Kiểm tra API xử lý khi đơn hàng không tồn tại

**Điều kiện tiên quyết**:
- User đã đăng nhập

**Các bước thực hiện**:
1. Gọi GET /api/orders/non-existent-id/payment với Authorization header
2. Kiểm tra response

**Kết quả mong đợi**:
- HTTP Status: 404 Not Found
- Response body chứa error message: "Đơn hàng không tồn tại"

**Ưu tiên**: Cao
**Loại test**: Negative

---

### IT-05: Webhook Processing - Xử lý webhook hợp lệ và đánh dấu PAID
**Mô tả**: Kiểm tra API webhook xử lý payload hợp lệ từ SePay

**Điều kiện tiên quyết**:
- Đơn hàng tồn tại với status = 'UNPAID'
- Environment variable `SEPAY_WEBHOOK_SECRET` đã set
- Webhook call có header `x-sepay-secret` đúng

**Các bước thực hiện**:
1. Tạo đơn hàng với orderCode = 'ORD-20240101-AABBCC', total = 500000
2. Gửi POST /api/webhooks/sepay với:
   - Header: `x-sepay-secret: {WEBHOOK_SECRET}`
   - Body: `{ transferType: 'in', transferAmount: 500000, content: 'Thanh toan ORD-20240101-AABBCC', transactionDate: '2024-01-01 10:00:00' }`
3. Kiểm tra database sau khi webhook

**Kết quả mong đợi**:
- HTTP Status: 200 OK
- Response body: `{ success: true, handled: true, orderCode: 'ORD-20240101-AABBCC' }`
- Database được cập nhật:
  - paymentStatus: 'UNPAID' → 'PAID'
  - paidAt: set với '2024-01-01 10:00:00'
  - status: 'PENDING' → 'CONFIRMED'

**Ưu tiên**: Cao
**Loại test**: Positive

---

### IT-06: Webhook Validation - Sai secret (401)
**Mô tả**: Kiểm tra API webhook từ chối khi secret sai

**Điều kiện tiên quyết**:
- Environment variable `SEPAY_WEBHOOK_SECRET` = 'correct-secret'

**Các bước thực hiện**:
1. Gửi POST /api/webhooks/sepay với:
   - Header: `x-sepay-secret: wrong-secret`
   - Body: payload hợp lệ bất kỳ
2. Kiểm tra response

**Kết quả mong đợi**:
- HTTP Status: 401 Unauthorized
- Response body chứa error message: "Webhook secret không hợp lệ"
- Không thực hiện bất kỳ database update nào

**Ưu tiên**: Cao
**Loại test**: Negative

---

### IT-07: Payment Stats - Admin xem thống kê thanh toán
**Mô tả**: Kiểm tra API thống kê thanh toán cho admin dashboard

**Điều kiện tiên quyết**:
- User có role 'STAFF' hoặc 'ADMIN'
- Có nhiều đơn hàng với các trạng thái thanh toán khác nhau

**Các bước thực hiện**:
1. Tạo dữ liệu test:
   - 5 đơn PAID với tổng tiền 2,500,000
   - 3 đơn UNPAID (COD) với tổng tiền 600,000
   - 2 đơn UNPAID (BANK_TRANSFER) với tổng tiền 400,000
   - 1 đơn REFUNDED với tổng tiền 200,000
2. Login với user có role 'ADMIN'
3. Gọi GET /api/admin/payments/stats với Authorization header
4. Kiểm tra response

**Kết quả mong đợi**:
- HTTP Status: 200 OK
- Response body:
  ```json
  {
    "revenue": 2500000,
    "pending": { "count": 3, "amount": 600000 },
    "refunded": { "count": 1, "amount": 200000 },
    "awaitingBankTransfer": { "count": 2, "amount": 400000 }
  }
  ```
- revenue: tổng tiền của các đơn PAID
- pending: tổng count và amount của UNPAID
- refunded: tổng count và amount của REFUNDED
- awaitingBankTransfer: count và amount của BANK_TRANSFER + UNPAID

**Ưu tiên**: Trung bình
**Loại test**: Positive

---

## 3. E2E TESTS - Kiểm Thử End-to-End (5 Tests)

### E2E-01: Complete BANK_TRANSFER Flow - Quy trình thanh toán hoàn chỉnh
**Mô tả**: Kiểm tra quy trình đầy đủ từ tạo đơn đến thanh toán thành công

**Điều kiện tiên quyết**:
- User đã đăng nhập
- Products tồn tại trong database
- SePay webhook endpoint có thể nhận gọi

**Các bước thực hiện**:
1. Tạo đơn hàng mới với paymentMethod = 'BANK_TRANSFER', total = 500000
2. Gọi GET /api/orders/{order_id}/payment để lấy thông tin thanh toán
3. Xác nhận response có đầy đủ bank info, amount, content, qrUrl
4. User thực hiện chuyển khoản với nội dung đúng orderCode và số tiền đúng
5. Chờ SePay gửi webhook về hệ thống
6. Webhook được xử lý và đánh dấu đơn hàng là PAID
7. Kiểm tra GET /api/orders/{order_id} để xác nhận status = 'CONFIRMED', paymentStatus = 'PAID'

**Kết quả mong đợi**:
- Bước 2: Trả về thông tin thanh toán đầy đủ (bank info, amount, QR URL)
- Bước 5: Webhook nhận được payload từ SePay
- Bước 6: Webhook trả về `{ handled: true, orderCode: 'ORD-...' }`
- Bước 7: Đơn hàng có status = 'CONFIRMED', paymentStatus = 'PAID', paidAt có giá trị

**Ưu tiên**: Cao
**Loại test**: Positive

---

### E2E-02: Webhook Idempotency - Webhook trùng lặp bị bỏ qua
**Mô tả**: Kiểm tra webhook idempotent - không xử lý lại khi nhận trùng lặp

**Điều kiện tiên quyết**:
- Đơn hàng tồn tại với paymentStatus = 'PAID'
- SePay gửi webhook trùng lặp (có thể do retry mechanism)

**Các bước thực hiện**:
1. Tạo đơn hàng và xử lý webhook lần đầu → đơn thành PAID
2. Gửi lại webhook chính xác như lần đầu (same payload)
3. Kiểm tra kết quả và database

**Kết quả mong đợi**:
- Webhook lần 2 trả về `{ handled: false }` (vì đơn đã PAID)
- Database không thay đổi (không update lại)
- Không throw error
- Hệ thống xử lý graceful khi nhận webhook trùng lặp

**Ưu tiên**: Cao
**Loại test**: Positive/Edge

---

### E2E-03: Amount Mismatch - Webhook trả về handled: false
**Mô tả**: Kiểm tra webhook từ chối khi số tiền không khớp

**Điều kiện tiên quyết**:
- Đơn hàng tồn tại với total = 500000

**Các bước thực hiện**:
1. Gửi webhook với transferAmount = 499999 (ít hơn 1 đồng)
2. Gửi webhook với transferAmount = 500001 (nhiều hơn 1 đồng)
3. Gửi webhook với transferAmount = 100000 (ít hơn nhiều)
4. Kiểm tra kết quả và database

**Kết quả mong đợi**:
- Tất cả trường hợp đều trả về `{ handled: false }`
- Database không update (paymentStatus vẫn 'UNPAID')
- Không throw error
- Hệ thống reject silent với handled: false

**Ưu tiên**: Cao
**Loại test**: Negative

---

### E2E-04: Wrong OrderCode - Webhook trả về handled: false
**Mô tả**: Kiểm tra webhook từ chối khi orderCode không tồn tại

**Điều kiện tiên quyết**:
- Không có đơn hàng với orderCode = 'ORD-99999999-XXXXXX' trong database

**Các bước thực hiện**:
1. Gửi webhook với content chứa orderCode không tồn tại
2. Kiểm tra kết quả

**Kết quả mong đợi**:
- Trả về `{ handled: false }`
- Không tạo mới đơn hàng
- Không throw error
- Hệ thống reject silent với handled: false

**Ưu tiên**: Trung bình
**Loại test**: Negative

---

### E2E-05: Admin Stats Dashboard - Admin xem metrics thanh toán
**Mô tả**: Kiểm tra admin có thể xem dashboard thống kê thanh toán

**Điều kiện tiên quyết**:
- Admin user đã đăng nhập
- Database có đủ dữ liệu đa dạng các trạng thái

**Các bước thực hiện**:
1. Login với admin account
2. Mở dashboard page tại route '/admin/dashboard' hoặc '/admin/payments'
3. Kiểm tra hiển thị metrics:
   - Total Revenue (tổng doanh thu)
   - Pending Payments (số lượng và tổng tiền chờ thanh toán)
   - Refunded Payments (số lượng và tổng tiền hoàn)
   - Awaiting Bank Transfer (chờ đối soát chuyển khoản)
4. Test filter theo date range nếu có
5. Test export report nếu có feature

**Kết quả mong đợi**:
- Dashboard hiển thị đúng số liệu từ database
- Metrics tính toán chính xác:
  - Revenue = sum(total của các đơn PAID)
  - Pending count/count và amount của UNPAID
  - Refunded count và amount của REFUNDED
  - AwaitingBankTransfer = BANK_TRANSFER + UNPAID
- UI responsive và load data trong thời gian chấp nhận được (< 2s)

**Ưu tiên**: Trung bình
**Loại test**: Positive

---

## 4. EDGE CASES - Các Trường Hợp Biên (10 Tests)

### EC-01: transferType = 'out' - handled: false
**Mô tả**: Webhook bỏ qua khi nhận giao dịch chuyển tiền ra (out)

**Các bước thực hiện**:
1. Gửi webhook với transferType = 'out'
2. Payload đầy đủ các trường khác hợp lệ

**Kết quả mong đợi**:
- Trả về `{ handled: false }` ngay lập tức
- Không truy vấn database
- Không throw error
- Không log là lỗi

**Ưu tiên**: Cao
**Loại test**: Negative/Edge

---

### EC-02: No OrderCode in Content - handled: false
**Mô tả**: Webhook bỏ qua khi nội dung không chứa orderCode

**Các bước thực hiện**:
1. Gửi webhook với content = "Chuyen khoan khong co ma don"
2. Các trường khác hợp lệ

**Kết quả mong đợi**:
- Regex trả về null (không match)
- Trả về `{ handled: false }`
- Không truy vấn database
- Không throw error

**Ưu tiên**: Cao
**Loại test**: Edge

---

### EC-03: Invalid OrderCode Format - handled: false
**Mô tả**: Webhook bỏ qua khi orderCode sai định dạng

**Các bước thực hiện**:
1. Gửi webhook với content = "ORD-2024-AB" (định dạng sai)
2. Gửi webhook với content = "ORDER-20240101-AABBCC" (tiền tố sai)
3. Gửi webhook với content = "ORD-20240101-AABBCCDD" (quá dài)

**Kết quả mong đợi**:
- Regex không match với các format sai
- Trả về `{ handled: false }`
- Không truy vấn database

**Ưu tiên**: Trung bình
**Loại test**: Edge

---

### EC-04: Order Not Found - handled: false
**Mô tả**: Webhook bỏ qua khi orderCode không tìm thấy trong database

**Các bước thực hiện**:
1. Gửi webhook với content chứa orderCode không tồn tại
2. Regex trích xuất orderCode thành công
3. Database query trả về null

**Kết quả mong đợi**:
- Trả về `{ handled: false }`
- Không throw error
- Không log là lỗi critical
- Quiet rejection

**Ưu tiên**: Cao
**Loại test**: Edge

---

### EC-05: Amount Mismatch (Less or More) - handled: false
**Mô tả**: Webhook bỏ qua khi số tiền chênh lệch (ít hơn hoặc nhiều hơn)

**Các bước thực hiện**:
1. Order total = 500000
2. Gửi webhook với transferAmount = 499999
3. Gửi webhook với transferAmount = 500001
4. Gửi webhook với transferAmount = 0

**Kết quả mong đợi**:
- Tất cả đều trả về `{ handled: false }`
- Số chênh lệch哪怕 1 đồng cũng bị từ chối
- So sánh strictly equal (type và value đều khớp)

**Ưu tiên**: Cao
**Loại test**: Negative/Edge

---

### EC-06: Invalid TransactionDate - handled: false
**Mô tả**: Webhook bỏ qua khi transactionDate không parse được

**Các bước thực hiện**:
1. Gửi webhook với transactionDate = "invalid-date-string"
2. Gửi webhook với transactionDate = ""
3. Gửi webhook với transactionDate = null
4. Gửi webhook thiếu field transactionDate

**Kết quả mong đợi**:
- `new Date(payload.transactionDate)` trả về Invalid Date (isNaN)
- Trả về `{ handled: false }`
- Không throw error
- Không crash application

**Ưu tiên**: Trung bình
**Loại test**: Edge

---

### EC-07: Order Already PAID - handled: false
**Mô tả**: Webhook bỏ qua khi đơn hàng đã được thanh toán

**Các bước thực hiện**:
1. Mock order với paymentStatus = 'PAID'
2. Gửi webhook với orderCode và amount đúng

**Kết quả mong đợi**:
- Trả về `{ handled: false }` ngay khi phát hiện PAID
- Không thực database UPDATE
- Idempotent behavior
- Không throw error

**Ưu tiên**: Cao
**Loại test**: Edge

---

### EC-08: Empty Content Field - handled: false
**Mô tả**: Webhook xử lý khi content rỗng

**Các bước thực hiện**:
1. Gửi webhook với content = ""
2. Gửi webhook với content = null
3. Gửi webhook thiếu field content

**Kết quả mong đợi**:
- Regex match trả về null
- Trả về `{ handled: false }`
- Không throw error
- Không crash application

**Ưu tiên**: Trung bình
**Loại test**: Edge

---

### EC-09: Null/Undefined Fields - handled: false
**Mô tả**: Webhook xử lý khi các field bắt buộc là null hoặc undefined

**Các bước thực hiện**:
1. Gửi webhook với transferType = null
2. Gửi webhook với transferAmount = undefined
3. Gửi webhook với transactionDate = null
4. Gửi webhook với body = {} (empty object)

**Kết quả mong đợi**:
- Validation logic xử lý graceful
- Trả về `{ handled: false }` hoặc HTTP 400 nếu malformed
- Không throw uncaught error
- Không crash application

**Ưu tiên**: Trung bình
**Loại test**: Edge

---

### EC-10: Malformed JSON - 400 Error
**Mô tả**: Webhook từ chối khi body không phải JSON hợp lệ

**Các bước thực hiện**:
1. Gửi POST /api/webhooks/sepay với header `Content-Type: application/json`
2. Body là string không phải JSON: "not a json"
3. Body là JSON syntax error: "{ invalid json }"
4. Body là text/plain: "plain text"

**Kết quả mong đợi**:
- Express JSON parser reject trước khi đến controller
- HTTP Status: 400 Bad Request
- Response body chứa parse error message
- Không crash application
- Không log as critical error

**Ưu tiên**: Trung bình
**Loại test**: Negative

---

## 5. SECURITY TESTS - Kiểm Thử Bảo Mật (5 Tests)

### SEC-01: Webhook Secret Verification - Thiếu header (401)
**Mô tả**: Kiểm tra webhook từ chối khi thiếu header x-sepay-secret

**Các bước thực hiện**:
1. Gửi POST /api/webhooks/sepay với:
   - Body: payload hợp lệ
   - KHÔNG có header `x-sepay-secret`
2. Kiểm tra response

**Kết quả mong đợi**:
- HTTP Status: 401 Unauthorized
- Response body: "Webhook secret không hợp lệ"
- Không process webhook
- Middleware reject trước khi đến controller

**Ưu tiên**: Cao
**Loại test**: Security/Negative

---

### SEC-02: Webhook Secret Verification - Sai secret (401)
**Mô tả**: Kiểm tra webhook từ chối khi secret không đúng

**Điều kiện tiên quyết**:
- Environment variable `SEPAY_WEBHOOK_SECRET` = 'correct-secret'

**Các bước thực hiện**:
1. Gửi POST /api/webhooks/sepay với:
   - Header: `x-sepay-secret: wrong-secret`
   - Body: payload hợp lệ
2. Gửi với `x-sepay-secret: ` (empty string)
3. Gửi với `x-sepay-secret: Correct-Secret` (case-sensitive)

**Kết quả mong đợi**:
- Tất cả đều HTTP Status: 401 Unauthorized
- Case-sensitive comparison
- Empty string bị từ chối
- Không process webhook

**Ưu tiên**: Cao
**Loại test**: Security/Negative

---

### SEC-03: Ownership Check - User không thể truy cập đơn của người khác (404)
**Mô tả**: Kiểm tra user không thể xem thông tin thanh toán của đơn hàng người khác

**Điều kiện tiên quyết**:
- User A và User B đã đăng nhập
- Đơn hàng thuộc về User A

**Các bước thực hiện**:
1. Login với User B token
2. Gọi GET /api/orders/{order_of_user_A}/payment
3. Kiểm tra response

**Kết quả mong đợi**:
- HTTP Status: 404 Not Found
- Response body: "Đơn hàng không tồn tại"
- User B không biết đơn hàng có tồn tại (không reveal information)
- Prisma query: `findFirst({ where: { id: orderId, userId: userId } })` return null

**Ưu tiên**: Cao
**Loại test**: Security/Negative

---

### SEC-04: SQL Injection Prevention - Ngăn chặn trong content field
**Mô tả**: Kiểm tra hệ thống không bị SQL injection qua field content

**Các bước thực hiện**:
1. Gửi webhook với content = "'; DROP TABLE orders; --"
2. Gửi webhook với content = "ORD-20240101-AABBCC' OR '1'='1"
3. Gửi webhook với content chứa SQL commands khác

**Kết quả mong đợi**:
- Webhook trả về `{ handled: false }` (không match regex)
- Không execute SQL injection
- Database không bị ảnh hưởng
- Prisma ORM bảo vệ khỏi SQL injection
- Không crash application

**Ưu tiên**: Cao
**Loại test**: Security

---

### SEC-05: Authorization - Stats require STAFF+ role
**Mô tả**: Kiểm tra chỉ STAFF và ADMIN mới có thể truy cập stats

**Điều kiện tiên quyết**:
- Users với các role khác nhau: CUSTOMER, STAFF, ADMIN

**Các bước thực hiện**:
1. Login với CUSTOMER role
2. Gọi GET /api/admin/payments/stats với Authorization header
3. Kiểm tra response
4. Login với STAFF role
5. Gọi lại GET /api/admin/payments/stats
6. Kiểm tra response

**Kết quả mong đợi**:
- Bước 2-3: HTTP Status: 403 Forbidden (hoặc 401 nếu không có role)
- Bước 5-6: HTTP Status: 200 OK (trả về stats)
- Middleware `authorize(...STAFF_ROLES)` enforce quyền truy cập
- CUSTOMER không thể access admin endpoints

**Ưu tiên**: Cao
**Loại test**: Security/Negative

---

## 6. PERFORMANCE TESTS - Kiểm Thử Hiệu Năng (3 Tests)

### PT-01: Get Payment Info < 200ms (p95)
**Mô tả**: Kiểm tra API GET /api/orders/:id/payment đáp ứng trong thời gian SLA

**Điều kiện tiên quyết**:
- Database có dữ liệu test đủ lớn
- Server ở môi trường production-like

**Các bước thực hiện**:
1. Gọi GET /api/orders/:id/payment 100 lần (hoặc dùng k6 load test)
2. Measure response time cho mỗi request
3. Calculate p50, p95, p99 latency

**Kết quả mong đợi**:
- p50 (median) < 100ms
- p95 < 200ms
- p99 < 500ms
- Max response time < 1000ms
- Database query được tối ưu (sử dụng index)
- Nên có index trên `(id, userId)` và `orderCode`

**Ưu tiên**: Cao
**Loại test**: Performance

---

### PT-02: Webhook Processing < 500ms (p95)
**Mô tả**: Kiểm tra webhook processing đáp ứng trong thời gian SLA

**Điều kiện tiên quyết**:
- Database có đủ dữ liệu
- Webhook payload hợp lệ

**Các bước thực hiện**:
1. Gửi POST /api/webhooks/sepay 100 lần với payloads khác nhau
2. Measure response time
3. Include cả cases handled: true và handled: false
4. Calculate p50, p95, p99 latency

**Kết quả mong đợi**:
- p50 (median) < 200ms
- p95 < 500ms
- p99 < 1000ms
- Max response time < 2000ms
- Database update và query đều nhanh
- Should use database index on `orderCode`

**Ưu tiên**: Cao
**Loại test**: Performance

---

### PT-03: Stats Aggregation < 300ms (p95)
**Mô tả**: Kiểm tra API stats aggregation trả về nhanh

**Điều kiện tiên quyết**:
- Database có nhiều records (1000+ orders)
- Server production-like

**Các bước thực hiện**:
1. Gọi GET /api/admin/payments/stats 100 lần
2. Measure response time
3. Calculate p50, p95, p99 latency

**Kết quả mong đợi**:
- p50 (median) < 150ms
- p95 < 300ms
- p99 < 600ms
- Max response time < 1000ms
- Aggregation queries được tối ưu (4 parallel aggregations)
- Nên có index trên `paymentStatus` và `paymentMethod`
- Nên cân nhắc caching stats cho dashboard

**Ưu tiên**: Trung bình
**Loại test**: Performance

---

## Tổng Kết

### Phủ Đề Kiểm Thử
- **Total Tests**: 38 test cases
- **Unit Tests**: 8 tests (21%)
- **Integration Tests**: 7 tests (18%)
- **E2E Tests**: 5 tests (13%)
- **Edge Cases**: 10 tests (26%)
- **Security Tests**: 5 tests (13%)
- **Performance Tests**: 3 tests (8%)

### Ưu Tiên Thực Hiện
1. **Cao (High)**: 24 tests - Bắt buộc phải pass trước release
2. **Trung bình (Medium)**: 11 tests - Nên pass để đảm bảo chất lượng
3. **Thấp (Low)**: 3 tests - Có thể defer nếu time constraint

### Loại Test Phổ Biến
1. **Positive**: 14 tests - Test happy path
2. **Negative**: 11 tests - Test error handling
3. **Edge**: 10 tests - Test boundary cases
4. **Security**: 5 tests - Test security vulnerabilities
5. **Performance**: 3 tests - Test SLA compliance

### API Endpoints Được Test
1. `GET /api/orders/:id/payment` - 5 integration tests
2. `POST /api/webhooks/sepay` - 10 integration/security tests
3. `GET /api/admin/payments/stats` - 2 integration/security tests

### Coverage Mục Tiêu
- **Code Coverage**: ≥ 95% (lines, branches, functions)
- **API Coverage**: 100% (3 endpoints)
- **Happy Path Coverage**: 100%
- **Error Path Coverage**: ≥ 90%
- **Security Coverage**: 100% (authentication, authorization, input validation)
- **Performance SLA**: 100% (p95 latency targets)

### Kế Hoạch Test Execution
1. **Unit Tests**: Chạy mỗi lần code change (fast feedback)
2. **Integration Tests**: Chạy trong CI/CD pipeline trước merge
3. **E2E Tests**: Chạy nightly hoặc pre-release
4. **Security Tests**: Chạy trong CI/CD + quarterly security audit
5. **Performance Tests**: Chạy weekly + pre-release

### Go/No-Go Criteria
- **Go Condition**: 
  - 100% High priority tests pass
  - ≥ 95% Medium priority tests pass
  - 0 critical security vulnerabilities
  - Performance SLA met (p95)
- **No-Go Condition**:
  - Bất kỳ High priority test fail
  - Critical security vulnerability detected
  - Performance SLA missed (p95)
  - Database integrity issue detected

---

**Document Version**: 1.0  
**Last Updated**: 2026-06-20  
**Author**: API Testing Specialist  
**Approved By**: [To be filled]  
**Status**: Draft - Pending Review
