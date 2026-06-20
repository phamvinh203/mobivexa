# BRD — Business Requirement Document
## Module: Payment (Thanh toán)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-20  
> **Người soạn:** Product Manager  

---

## 1. Bối cảnh kinh doanh

Mobivexa là nền tảng thương mại điện tử bán thiết bị di động và phụ kiện tại Việt Nam. Module Payment là **bước chốt đơn hàng quan trọng nhất** — cho phép khách hàng lựa chọn phương thức thanh toán, hoàn tất chuyển khoản, và tự động xác nhận đơn hàng khi tiền về tài khoản.

Hệ thống phục vụ 3 nhóm người dùng chính:

| Nhóm | Mô tả |
|---|---|
| **Khách hàng (Customer)** | Người đặt hàng, lựa chọn phương thức thanh toán và thực hiện giao dịch |
| **Admin (Quản trị viên)** | Người theo dõi thống kê thanh toán, đối soát doanh thu |
| **Hệ thống SePay** | Hệ thống bên thứ ba giám sát tài khoản ngân hàng và gửi webhook khi phát hiện giao dịch |

### Workflow Thanh toán Ngân hàng:

1. Khách hàng tạo đơn hàng với phương thức `BANK_TRANSFER`
2. Hệ thống tạo mã QR VietQR chứa thông tin tài khoản Mobivexa + số tiền
3. Khách hàng quét mã QR và chuyển khoản qua ngân hàng
4. SePay giám sát tài khoản Mobivexa, phát hiện giao dịch khớp
5. SePay gửi webhook đến hệ thống Mobivexa với thông tin giao dịch
6. Hệ thống Mobivexa xác thực webhook, cập nhật trạng thái đơn hàng thành `PAID`
7. Khách hàng nhận thông báo đơn hàng đã được xác nhận

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường thành công |
|---|---|---|
| **BG-01** | Hỗ trợ đa phương thức thanh toán linh hoạt | Ít nhất 2 phương thức: COD và BANK_TRANSFER |
| **BG-02** | Tự động xác nhận thanh toán qua webhook SePay | 95%+ đơn BANK_TRANSFER được auto-confirm trong 5 phút |
| **BG-03** | Tạo mã QR VietQR chuẩn để khách dễ chuyển khoản | 100% QR tạo thành công, có thể quét bởi app ngân hàng |
| **BG-04** | Xử lý webhook an toàn với xác thực secret | 0% webhook giả mạo được xử lý thành công |
| **BG-05** | Cung cấp thống kê thanh toán cho admin đối soát | Dashboard hiển thị đúng số liệu theo real-time |
| **BG-06** | Ngăn chặn xử lý thanh toán trùng lặp | 0% đơn được xử lý thanh toán 2 lần |

---

## 3. Các bên liên quan (Stakeholders)

| Stakeholder | Vai trò | Kỳ vọng |
|---|---|---|
| **Khách hàng** | Người dùng cuối | Có thể chọn COD hoặc chuyển khoản; QR dễ quét; đơn hàng được tự động xác nhận sau khi chuyển tiền |
| **Finance team** | Đối soát doanh thu | Xem thống kê thanh toán theo thời gian thực; đối soát được từng giao dịch với SePay |
| **Admin** | Quản lý đơn hàng | Xem danh sách đơn chờ thanh toán; xử lý webhook lỗi; thủ công xác nhận nếu cần |
| **Dev team** | Phát triển & vận hành | Xử lý webhook idempotent; logs đầy đủ; rollback an toàn nếu lỗi |

---

## 4. Yêu cầu kinh doanh

### 4.1 Hỗ trợ phương thức thanh toán (Payment Methods)

**Mô tả:** Hệ thống hỗ trợ 2 phương thức thanh toán chính.

| Yêu cầu | Chi tiết |
|---|---|
| **COD (Cash on Delivery)** | Thanh toán khi nhận hàng; không cần xử lý thanh toán trước |
| **BANK_TRANSFER** | Chuyển khoản qua ngân hàng sử dụng QR code VietQR + SePay |
| **Enum PaymentMethod** | `COD` | `BANK_TRANSFER` |
| **Mặc định** | Nếu customer không chọn → mặc định `COD` |
| **Lưu trữ** | Order lưu `paymentMethod` và `paymentStatus` |

**Ràng buộc:**
- Chỉ chấp nhận 2 phương thức trên → các giá trị khác → `400` `Phương thức thanh toán không hợp lệ`
- `paymentStatus` enum: `PENDING` | `PAID` | `FAILED` | `REFUNDED`

---

### 4.2 Tạo mã QR VietQR (QR Code Generation)

**Mô tả:** Khi đơn hàng chọn `BANK_TRANSFER`, hệ thống tạo mã QR chứa thông tin chuyển khoản.

| Yêu cầu | Chi tiết |
|---|---|
| **Thông tin trong QR** | Số tài khoản Mobivexa, tên ngân hàng, số tiền (exact amount), nội dung CK (mã đơn hàng) |
| **Chuẩn VietQR** | Theo chuẩn EMVCo, tương thích với tất cả app ngân hàng Việt Nam |
| **Dữ liệu QR** | `bankAccount` + `bankName` + `amount` + `orderCode` (content) |
| **Lưu trữ** | QR string được lưu vào `Order.paymentInfo.qrData` |
| **Hiển thị** | Frontend render QR thành image để customer quét |

**Business Rules:**
- QR code phải chứa **exact amount** → customer chuyển đúng số tiền mới được SePay detect
- Nội dung chuyển khoản phải chứa **orderCode** → để match đơn hàng khi webhook về
- QR expire sau **24 giờ** → nếu quá hạn, customer cần tạo QR mới (hoặc admin approve thủ công)

**Ràng buộc:**
- Nếu `amount` <= 0 → `400` `Số tiền phải lớn hơn 0`
- Nếu `orderCode` rỗng → `500` `Lỗi hệ thống: không tạo được mã đơn`

---

### 4.3 Xử lý Webhook SePay (SePay Webhook Processing)

**Mô tả:** SePay gửi webhook khi phát hiện giao dịch khớp → hệ thống tự động xác nhận đơn hàng.

| Yêu cầu | Chi tiết |
|---|---|
| **Endpoint webhook** | `POST /api/webhooks/sepay` |
| **Xác thực webhook** | Verify signature từ `sepaySignature` header với `SEPAY_WEBHOOK_SECRET` |
| **Payload webhook** | `{ transactionId, amount, content, transferDate, bankAccountId }` |
| **Match đơn hàng** | Parse `content` → extract `orderCode` → tìm Order theo `code` |
| **Validate amount** | Kiểm tra `webhook.amount === order.totalAmount` (cho phép sai lệch ±1 đồng làm tròn) |
| **Idempotent** | Check if transaction đã được xử lý → nếu có → skip nhưng vẫn return 200 |
| **Cập nhật đơn** | Nếu valid → `Order.paymentStatus = PAID`, `Order.paidAt = now`, lưu `paymentInfo.gatewayTransactionId` |
| **Gửi notification** | Gửi email/SMS cho customer thông báo đơn đã thanh toán |

**Business Rules:**
- Webhook phải **idempotent** → SePay có thể gửi lại nhiều lần nếu network lỗi
- Signature verification bắt buộc → reject webhook không hợp lệ với `401`
- Chỉ xử lý webhook cho đơn **PENDING** → nếu đơn đã `PAID`/`CANCELLED` → skip
- Amount phải khớp → nếu sai số → log warning, không update đơn, notify admin kiểm tra
- Timeout webhook xử lý ≤ **5 giây** → SePay retry nếu quá timeout

**Ràng buộc:**
- Signature invalid → `401` `Invalid webhook signature`
- Order không tồn tại → `404` → log lỗi, admin investigate
- Order không phải `BANK_TRANSFER` → `400` → log lỗi, có thể dấu fraud
- Amount mismatch → `202` (accepted but not processed) → notify admin

**Quy trình xử lý webhook:**

```
1. Nhận webhook từ SePay
2. Verify signature với secret
3. Extract orderCode từ content
4. Tìm Order theo code
5. Validate: paymentStatus == PENDING && paymentMethod == BANK_TRANSFER
6. Validate: amount khớp (±1 đồng)
7. Check if transactionId đã processed → nếu có → return 200
8. Update Order: paymentStatus = PAID, paidAt = now, gatewayTransactionId = webhook.transactionId
9. Gửi notification cho customer
10. Return 200 OK
```

---

### 4.4 Thống kê thanh toán (Payment Statistics)

**Mô tả:** Admin dashboard hiển thị thống kê thanh toán cho đối soát.

| Yêu cầu | Chi tiết |
|---|---|
| **Tổng quan** | Tổng doanh thu, số đơn thanh toán, tỷ lệ COD vs BANK_TRANSFER |
| **Theo thời gian** | Filter theo ngày/tuần/tháng → chart doanh thu |
| **Theo trạng thái** | Số đơn `PENDING`, `PAID`, `FAILED` |
| **Chi tiết giao dịch** | List các giao dịch từ SePay với link ra SePay dashboard |
| **Đối soát** | So khớp số liệu giữa Mobivexa và SePay (reconciliation) |

**Dashboard metrics:**
- `totalRevenue` - Tổng doanh thu đã thanh toán
- `pendingPaymentCount` - Số đơn chờ thanh toán
- `paidCount` - Số đơn đã thanh toán thành công
- `bankTransferRate` - Tỷ lệ khách chọn BANK_TRANSFER vs COD
- `webhookSuccessRate` - Tỷ lệ webhook xử lý thành công
- `avgPaymentTime` - Thời gian trung bình từ tạo đơn đến thanh toán

**Ràng buộc:**
- Thống kê real-time → cập nhật trong 1 phút sau khi webhook xử lý
- Export CSV cho accountant → chứa đầy đủ thông tin đối soát

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Chỉ tiêu | Giá trị |
|---|---|
| Tạo mã QR VietQR | < 200ms (p95) |
| Xử lý webhook SePay | < 5000ms (timeout) |
| Truy vấn thống kê thanh toán | < 1000ms (p95) |
| Verify webhook signature | < 100ms (p95) |

---

### 5.2 Security

| Yêu cầu | Mô tả |
|---|---|
| **Webhook signature** | Bắt buộc verify signature với `SEPAY_WEBHOOK_SECRET` |
| **Secret management** | Lưu secret ở environment variable, không commit vào code |
| **HTTPS** | Webhook endpoint chỉ accept HTTPS (production) |
| **Rate limiting** | Giới hạn webhook từ 1 IP để tránh DDoS |
| **Logging** | Log tất cả webhooks received + processed (cho audit) |
| **Idempotent** | Đảm bảo webhook gửi lại nhiều lần không gây double payment |

---

### 5.3 Availability

| Yêu cầu | Giá trị |
|---|---|
| **Webhook uptime** | 99.9% (SePay retry nếu fail) |
| **QR generation** | 99.9% (fallback to manual payment info nếu QR fail) |
| **Recovery time** | < 5 phút nếu service crash (webhook queue) |

---

### 5.4 Scalability

| Yêu cầu | Chi tiết |
|---|---|
| **Webhook throughput** | Xử lý 100+ webhooks/phút |
| **Concurrent payments** | 50+ đơn thanh toán cùng lúc |
| **Database scaling** | Index `orderCode` để lookup nhanh khi webhook về |

---

## 6. Dependencies

| Module | Dependency | Chi tiết |
|---|---|---|
| **Payment ↔ Order** | FK | `orderId` → Order.id (cập nhật paymentStatus) |
| **Payment ↔ SePay** | External API | Webhook endpoint đăng ký với SePay dashboard |
| **Payment ↔ VietQR** | External API | Gọi API VietQR để tạo QR code |
| **Payment ↔ Notification** | Service | Gửi email/SMS khi đơn được thanh toán |
| **Payment ↔ User** | FK | `userId` → User.id (customer thanh toán) |

---

## 7. Risks & Assumptions

### 7.1 Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| **R-01** | Webhook SePay delay hoặc fail | Cao | Implement webhook queue; cho phép admin xác nhận thủ công |
| **R-02** | Webhook bị gửi duplicate (idempotent fail) | Cao | Lưu `processedTransactionIds` set; check trước khi process |
| **R-03** | Signature verification fail (secret sai) | Cao | Monitor alerts; validate secret trong dev/test kỹ |
| **R-04** | QR code expire nhưng customer vẫn chuyển tiền | Trung bình | Admin manual approve; policy refund nếu cần |
| **R-05** | Amount mismatch do customer chuyển thiếu | Trung bình | Admin manual review; policy giữ đơn chờ bổ sung |
| **R-06** | SePay bị downtime | Cao | Fallback: admin check bank statement manual approve |
| **R-07** | Ngân hàng delay giao dịch | Trung bình | QR expire 24h; customer có thể chuyển lại |
| **R-08** | Webhook bị giả mạo (tiền tấn công) | Cao | Verify signature; validate amount match; alert admin |

---

### 7.2 Assumptions

| ID | Assumption |
|---|---|
| **A-01** | SePay gửi webhook với signature hợp lệ theo docs |
| **A-02** | Nội dung chuyển khoản chứa `orderCode` để match đơn hàng |
| **A-03** | Khách hàng sử dụng app ngân hàng hỗ trợ VietQR (100% banks VN) |
| **A-04** | Số tiền trong webhook khớp 100% với `order.totalAmount` |
| **A-05** | Webhook endpoint có thể access được từ internet (SePay server) |
| **A-06** | Customer có thể chuyển khoản trong vòng 24h sau khi tạo đơn |
| **A-07** | Admin có quyền manual approve payment nếu webhook fail |
| **A-08** | SePay retention logs ít nhất 30 ngày để đối soát |
| **A-09** | Mỗi `transactionId` từ SePay là unique global |

---

## 8. Success Metrics

| Metric | Target | How to measure |
|---|---|---|
| **Webhook success rate** | ≥ 98% | Số webhook processed thành công / Tổng webhook received |
| **Auto-confirmation rate** | ≥ 95% | Số đơn auto-confirmed / Tổng đơn BANK_TRANSFER |
| **Payment confirmation time** | ≤ 5 phút (p95) | Thời gian từ customer chuyển tiền → đơn PAID |
| **Manual approval rate** | ≤ 5% | Số đơn admin manual approve / Tổng đơn BANK_TRANSFER |
| **QR generation success** | 100% | Số QR tạo thành công / Tổng đơn BANK_TRANSFER |
| **Payment reconciliation accuracy** | 100% | Số liệu Mobivexa === Số liệu SePay (monthly) |
| **Customer satisfaction** | ≥ 4.5/5 | CSAT survey sau thanh toán |
| **Payment fraud rate** | = 0% | Số webhook giả mạo được xử lý = 0 |

---

## 9. Timeline & Phases

### Phase 1: Foundation (Week 1)
- ✅ Thiết lập `PaymentMethod` enum và `paymentStatus` trong Order schema
- ✅ Lưu thông tin payment vào `Order.paymentInfo`
- ✅ Admin dashboard: thống kê cơ bản (total revenue, paid count)

### Phase 2: QR Code Integration (Week 2)
- ✅ Tích hợp VietQR API để tạo QR code
- ✅ Endpoint GET `/orders/:id/payment-info` trả về QR string
- ✅ Frontend hiển thị QR image để customer quét
- ✅ QR expire logic (24h)

### Phase 3: Webhook Processing (Week 3-4)
- ✅ Endpoint `POST /api/webhooks/sepay` với signature verification
- ✅ Idempotent processing (check `processedTransactionIds`)
- ✅ Match order code từ webhook content
- ✅ Validate amount và cập nhật đơn hàng
- ✅ Gửi notification khi thanh toán thành công
- ✅ Webhook logs và error handling

### Phase 4: Enhanced Admin Tools (Week 5)
- ✅ Dashboard thống kê thanh toán chi tiết
- ✅ List giao dịch từ SePay với reconciliation
- ✅ Manual approve payment cho cases lỗi
- ✅ Export CSV cho accountant
- ✅ Alerts cho webhook failures

### Phase 5: Monitoring & Optimization (Week 6)
- ⏳ Webhook retry queue cho cases fail
- ⏳ Analytics: payment method distribution, avg payment time
- ⏳ A/B test: QR placement trong checkout flow
- ⏳ Backup thủ công: check bank statement nếu SePay downtime

---

## 10. Appendix

### 10.1 Terminology

| Term | Definition |
|---|---|
| **COD (Cash on Delivery)** | Thanh toán khi nhận hàng — shipper thu tiền từ customer |
| **BANK_TRANSFER** | Chuyển khoản qua ngân hàng sử dụng QR code |
| **VietQR** | Chuẩn QR code thanh toán của Việt Nam (EMVCo compliant) |
| **SePay** | Service giám sát tài khoản ngân hàng và gửi webhook khi phát hiện giao dịch |
| **Webhook** | HTTP POST request từ SePay → Mobivexa khi có giao dịch khớp |
| **Idempotent** | Tính chất đảm bảo xử lý webhook nhiều lần không gây duplicate payment |
| **Signature verification** | Xác thực webhook bằng cách hash payload với secret và so sánh với header |
| **orderCode** | Mã đơn hàng unique (ví dụ: `ORD-123456`) — dùng để match trong webhook |
| **Auto-confirmation** | Tự động xác nhận đơn hàng khi webhook valid — không cần thủ công |
| **Reconciliation** | Đối soát — so khớp số liệu thanh toán giữa 2 hệ thống |
| **Exact amount QR** | QR code chứa số tiền chính xác — customer chuyển đúng mới được detect |
| **Webhook retry** | SePay gửi lại webhook nếu lần trước fail (timeout, 5xx) |

---

### 10.2 Related Documents

| Document | Link |
|---|---|
| Business Requirements (Current) | [BRD.md](./BRD.md) |
| Software Requirements | [SRS.md](./SRS.md) |
| Use Case Document | [UseCase.md](./UseCase.md) |
| API Specification | [APISpec.md](./APISpec.md) |
| SePay Webhook Documentation | [SePay Docs](https://developer.sepay.vn/en/sepay-webhooks) |
| VietQR API Documentation | [VietQR Docs](https://www.vietqr.io/en/) |

---

### 10.3 Webhook Payload Example

```json
{
  "transactionId": "SEPAY_123456789",
  "amount": 1500000,
  "content": "ORD-67890 CHUYEN KHOAN",
  "transferDate": "2026-06-20T10:30:00Z",
  "bankAccountId": "MB123456789",
  "customerName": "NGUYEN VAN A"
}
```

**Processing flow:**
1. Extract `orderCode = "ORD-67890"` từ `content`
2. Find Order where `code = "ORD-67890"`
3. Validate `amount === order.totalAmount` (1500000 === 1500000 ✓)
4. Check if `transactionId` đã processed → chưa có
5. Update `Order.paymentStatus = PAID`, `paidAt = now`
6. Save `gatewayTransactionId = "SEPAY_123456789"`
7. Send notification to customer

---

### 10.4 Payment Status Lifecycle

```
Order Created (paymentStatus = PENDING)
    ↓
Customer chooses BANK_TRANSFER
    ↓
System generates QR (paymentInfo.qrData)
    ↓
Customer scans QR → transfers money
    ↓
SePay detects transaction → sends webhook
    ↓
System processes webhook → validates → updates
    ↓
Order PAID (paymentStatus = PAID, paidAt = timestamp)
```

**Alternative paths:**
- Webhook fail → Admin manual approve → Order PAID
- Amount mismatch → Admin review → Order PAID hoặc REJECTED
- Webhook duplicate → Idempotent check → Skip (no change)

---

### 10.5 Business Rules Summary

| Rule | Description |
|---|---|
| **BR-01** | Chỉ 2 phương thức thanh toán: COD và BANK_TRANSFER |
| **BR-02** | QR expire sau 24 giờ → customer cần tạo QR mới nếu quá hạn |
| **BR-03** | Webhook phải idempotent → transactionId unique globally |
| **BR-04** | Chỉ update đơn PENDING → nếu đã PAID/CANCELLED → skip |
| **BR-05** | Amount phải khớp ±1 đồng → sai số → admin review |
| **BR-06** | Signature verification bắt buộc → reject 401 nếu invalid |
| **BR-07** | Webhook timeout ≤ 5 giây → SePay retry nếu quá |
| **BR-08** | Log tất cả webhooks → audit trail cho đối soát |
| **BR-09** | Admin có quyền manual approve → fallback khi webhook fail |
| **BR-10** | Thống kê real-time → dashboard update < 1 phút |

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-20  
> **Next Review:** Before Phase 3 (Webhook Processing)  
> **Approvals Needed:** Tech Lead, Finance Manager, Product Owner
