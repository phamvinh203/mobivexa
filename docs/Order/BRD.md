# BRD — Business Requirement Document
## Module: Order (Đơn hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Người soạn:** Tự động sinh từ source code  

---

## 1. Bối cảnh kinh doanh

Mobivexa là nền tảng thương mại điện tử bán thiết bị di động và phụ kiện. Module Order là **hạt nhân của doanh thu** — quản lý toàn bộ vòng đời đơn hàng từ khi khách đặt đến khi giao thành công hoặc hủy.

Hệ thống phục vụ 2 nhóm người dùng chính:

| Nhóm | Mô tả |
|---|---|
| **Khách hàng (Customer)** | Đặt hàng, xem đơn, hủy đơn của chính mình |
| **Nhân viên (Staff+)** | Quản lý tất cả đơn hàng, cập nhật trạng thái, đối soát thanh toán |

Mỗi đơn hàng đại diện cho một giao dịch mua bán — chứa thông tin snapshot sản phẩm, giá, địa chỉ giao, và trạng thái thanh toán.

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường thành công |
|---|---|---|
| BG-01 | Khách hàng đặt hàng nhanh, ít ma sát | Thời gian đặt hàng < 30 giây; tỷ lệ đặt hàng thành công > 95% |
| BG-02 | Tránh overselling (bán nhiều hơn tồn kho) | 0 trường hợp stock âm; atomic check-and-decrement |
| BG-03 | Theo dõi trạng thái đơn hàng chính xác | 100% đơn hàng được update đúng trạng thái theo flow |
| BG-04 | Hỗ trợ hủy đơn dễ dàng cho khách | Tỷ lệ hủy thành công > 98%; hoàn stock tự động |
| BG-05 | Admin quản lý đơn hàng hiệu quả | Filter đa chiều, update trạng thái nhanh |
| BG-06 | Đối soát thanh toán chính xác | Lịch sử thanh toán rõ ràng, hỗ trợ COD và Bank Transfer |

---

## 3. Các bên liên quan (Stakeholders)

| Stakeholder | Vai trò | Kỳ vọng |
|---|---|---|
| **Khách hàng** | Người mua hàng | Đặt hàng dễ dàng, xem trạng thái, hủy đơn khi cần |
| **Nhân viên kho** | Xử lý đơn hàng | Cập nhật trạng thái nhanh, thông báo hàng hóa |
| **Nhân viên CSKH** | Hỗ trợ khách | Xem chi tiết đơn, xử lý hủy/hoàn tiền |
| **Kế toán** | Đối soát thanh toán | Xem lịch sử thanh toán, xác nhận COD/chuyển khoản |
| **Dev team** | Xây dựng & bảo trì | API rõ ràng, dễ tích hợp với Cart/Product/Payment |
| **Management** | Ra quyết định | Báo cáo doanh thu, tỷ lệ hủy, hiệu suất giao hàng |

---

## 4. Yêu cầu kinh doanh

### 4.1 Đặt hàng (Order Placement)

**Mô tả:** Khách hàng có thể đặt hàng từ giỏ hàng hoặc mua ngay (bypass giỏ).

| Yêu cầu | Chi tiết |
|---|---|
| **Nguồn items** | Tự động lấy từ giỏ hàng (nếu không gửi `items`) hoặc dùng items trực tiếp |
| **Địa chỉ giao** | Bắt buộc chọn địa chỉ đã lưu |
| **Phương thức thanh toán** | COD (mặc định) hoặc Bank Transfer |
| **Ghi chú** | Tùy chọn — để lại lời nhắn cho shop |
| **Snapshot dữ liệu** | Lưu tên sản phẩm, SKU, màu, RAM, giá tại thời điểm đặt |
| **Atomic stock** | Check-and-decrement trong transaction — chống race condition |
| **Xóa giỏ hàng** | Xóa CartItems trong cùng transaction khi đặt từ giỏ |

**Ràng buộc:**
- `addressId` bắt buộc — phải tồn tại và thuộc về user
- Giỏ hàng không trống khi đặt từ giỏ
- Tất cả variants phải tồn tại và `isActive = true`
- Stock phải đủ (`stock >= quantity`) tại thời điểm đặt trong transaction
- Nếu stock vừa hết trong transaction → rollback toàn bộ

---

### 4.2 Trạng thái đơn hàng (Order Status Flow)

**Mô tả:** Đơn hàng có state machine rõ ràng — chỉ chuyển trạng thái theo quy định.

| Trạng thái | Ý nghĩa | Chuyển sang được |
|---|---|---|
| `PENDING` | Chờ xác nhận | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | Đã xác nhận | `SHIPPING`, `CANCELLED` |
| `SHIPPING` | Đang giao hàng | `DELIVERED`, `CANCELLED` |
| `DELIVERED` | Đã giao thành công | *(kết thúc)* |
| `CANCELLED` | Đã hủy | *(kết thúc)* |

**Ràng buộc:**
- Không được nhảy trạng thái (ví dụ: `PENDING → DELIVERED` bị từ chối)
- Chỉ admin được phép chuyển trạng thái
- `DELIVERED` và `CANCELLED` là trạng thái cuối — không thể chuyển tiếp

---

### 4.3 Hủy đơn hàng (Order Cancellation)

**Mô tả:** Khách hàng và admin đều có thể hủy đơn (theo điều kiện khác nhau).

**Khách hàng hủy:**
- Chỉ hủy được nếu trạng thái hiện tại cho phép chuyển sang `CANCELLED`
- ✅ `PENDING`, `CONFIRMED`, `SHIPPING` → có thể hủy
- ❌ `DELIVERED`, `CANCELLED` → không thể hủy
- Lý do mặc định: "Khách hàng hủy đơn" nếu không gửi
- Tự động hoàn trả stock cho tất cả items

**Admin hủy:**
- Có thể hủy từ bất kỳ trạng thái nào (trừ `DELIVERED`, `CANCELLED`)
- Bắt buộc gửi `cancelReason`
- Hoàn trả stock trong transaction

**Ràng buộc:**
- Hoàn stock phải atomic với cập nhật status trong cùng transaction
- Stock được hoàn trả chính xác bằng `quantity` của từng item

---

### 4.4 Cập nhật trạng thái (Admin)

**Mô tả:** Admin cập nhật trạng thái đơn hàng theo tiến độ thực tế.

| Yêu cầu | Chi tiết |
|---|---|
| **Theo flow** | Chuyển theo `VALID_TRANSITIONS` — không nhảy cách |
| **Hủy đơn** | Bắt buộc gửi `cancelReason` |
| **Các chuyển khác** | Cập nhật thẳng, không cần transaction phức tạp |
| **Không hủy** | Chỉ update status — không ảnh hưởng stock |

---

### 4.5 Cập nhật thanh toán (Admin)

**Mô tả:** Admin cập nhật trạng thái thanh toán cho đối soát.

| Yêu cầu | Chi tiết |
|---|---|
| **Trạng thái** | `UNPAID` / `PAID` / `REFUNDED` |
| **Không có state machine** | Admin được phép set tự do |
| **Mục đích** | Đối soát thủ công, ghi nhận COD, xử lý hoàn tiền |
| **Timestamp** | `paidAt` được set khi `paymentStatus = PAID` |

---

### 4.6 Xem đơn hàng (View Orders)

**Khách hàng:**
- Xem danh sách đơn của chính mình (không thấy đơn người khác)
- Filter theo trạng thái
- Xem chi tiết từng đơn (kèm items snapshot)

**Admin:**
- Xem tất cả đơn hàng của hệ thống
- Filter đa chiều: trạng thái, user, thanh toán, khoảng thời gian
- Xem chi tiết đơn bất kỳ

**Ràng buộc:**
- Customer chỉ thấy đơn thuộc về mình (check ở DB: `WHERE id AND userId`)
- Admin list trả về `_count.items` thay vì hydrate toàn bộ items (tối ưu data)

---

### 4.7 Mã đơn hàng (Order Code)

**Mô tả:** Mã đơn hàng tự sinh, dùng làm nội dung chuyển khoản.

| Yêu cầu | Chi tiết |
|---|---|
| **Format** | `ORD-{YYYYMMDD}-{6 ký tự hex ngẫu nhiên viết hoa}` |
| **Ví dụ** | `ORD-20240619-A3F9C2` |
| **Unique** | Đảm bảo không trùng trong hệ thống |
| **Dùng cho** | Nội dung chuyển khoản Bank Transfer |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Yêu cầu | Giá trị |
|---|---|
| Thời gian đặt hàng (transaction) | < 500ms (p95) |
| Thời gian xem danh sách đơn | < 300ms (p95) |
| Thời gian update trạng thái | < 200ms (p95) |
| Atomic stock check-and-decrement | Không DB connection timeout |

---

### 5.2 Scalability

| Yêu cầu | Chi tiết |
|---|---|
| Số lượng đơn tối đa | 100,000+ orders |
| Items per order | Tối đa 50 items/order |
| Concurrent đặt hàng | Hỗ trợ 100+ concurrent orders |
| Race condition prevention | Atomic transaction + WHERE clause |

---

### 5.3 Security

| Yêu cầu | Chi tiết |
|---|---|
| Customer endpoints | Yêu cầu JWT token (CUSTOMER+) |
| Admin endpoints | Yêu cầu JWT token + role STAFF+ |
| Ownership check | Check ở DB (không fetch rồi check in-memory) |
| SQL Injection prevention | Prisma ORM escape input |

---

### 5.4 Availability

| Yêu cầu | Giá trị |
|---|---|
| Uptime target | 99.9% |
| Transaction rollback | Đảm bảo rollback nếu stock check fail |
| No data loss | Snapshot orderItem không bị mất |

---

## 6. Dependencies

| Module | Dependency | Chi tiết |
|---|---|---|
| **Order ↔ User** | FK | `userId` → User.id |
| **Order ↔ Address** | Read-only | Snapshot shipping address từ Address |
| **Order ↔ Cart** | Conditional | Đặt từ giỏ → xóa CartItems |
| **Order ↔ Product** | Read-only | Snapshot ProductVariant info |
| **Order ↔ Payment** | Future | Webhook từ SePay/Bank (tương lai) |
| **OrderItem ↔ ProductVariant** | Optional FK | `variantId` → ProductVariant (nullable) |

---

## 7. Risks & Assumptions

### 7.1 Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Race condition stock | Cao | Atomic check-and-decrement trong transaction |
| R-02 | Overselling | Cao | WHERE clause `stock >= quantity` → rollback nếu fail |
| R-03 | Giỏ hàng trống khi đặt | Trung bình | Validate trước transaction |
| R-04 | Product/Variant bị xóa sau đặt | Trung bình | Snapshot info vào OrderItem |
| R-05 | Hủy đơn nhưng stock fail hoàn | Cao | Atomic transaction trong hủy |
| R-06 | Payment webhook thất bại | Trung bình | Admin update thủ công được phép |
| R-07 | Order code trùng | Thấp | Random hex + date — đủ unique |
| R-08 | Customer hủy sai trạng thái | Thấp | Validate theo VALID_TRANSITIONS |

---

### 7.2 Assumptions

| ID | Assumption |
|---|---|
| A-01 | Shipping fee = 0 (miễn phí vận chuyển) — hiện tại |
| A-02 | Discount = 0 (chưa có coupon) — hiện tại |
| A-03 | Payment webhook (SePay) được xử lý ở module riêng |
| A-04 | User đã có địa chỉ saved trước khi đặt hàng |
| A-05 | Cart module hoạt động bình thường |
| A-06 | ProductVariant stock được cập nhật chính xác |

---

## 8. Success Metrics

| Metric | Target | How to measure |
|---|---|---|
| **Order placement time** | < 30 giây (p95) | Track thời gian từ click đến success |
| **Order success rate** | > 95% | Total orders / Total placement attempts |
| **Cancellation rate** | < 10% | Cancelled orders / Total orders |
| **Stock accuracy** | 100% | 0 trường hợp stock âm |
| **On-time delivery** | > 90% | DELIVERED on time / Total DELIVERED |
| **Payment accuracy** | > 98% | PAID đúng / Total PAID |

---

## 9. Timeline & Phases

### Phase 1: MVP (Week 1-2)
- ✅ Đặt hàng từ giỏ hàng
- ✅ Xem đơn hàng của tôi
- ✅ Hủy đơn (Customer)
- ✅ Admin xem tất cả đơn
- ✅ Admin cập nhật trạng thái
- ✅ COD payment method

### Phase 2: Enhanced (Week 3-4)
- ✅ Mua ngay (bypass giỏ hàng)
- ✅ Bank Transfer payment method
- ✅ Admin cập nhật thanh toán
- ✅ Filter nâng cao cho admin
- ✅ Snapshot info vào OrderItem

### Phase 3: Advanced (Future)
- ⏳ Payment webhook integration (SePay)
- ⏳ Coupon/Discount system
- ⏳ Shipping fee calculation
- ⏳ Order analytics dashboard
- ⏳ Auto-assign shipping partner

---

## 10. Appendix

### 10.1 Terminology

| Term | Definition |
|---|---|
| **Order** | Đơn hàng — đại diện một giao dịch mua bán |
| **OrderItem** | Mỗi sản phẩm trong đơn hàng (snapshot) |
| **Order Code** | Mã đơn hàng tự sinh — dùng chuyển khoản |
| **Snapshot** | Thông tin được lưu tại thời điểm đặt (không thay đổi theo sau) |
| **Atomic check-and-decrement** | Kiểm tra và trừ stock trong 1 operation — chống race condition |
| **VALID_TRANSITIONS** | Các chuyển trạng thái được phép theo flow |
| **State Machine** | Máy trạng thái — quy định các chuyển trạng thái hợp lệ |

---

### 10.2 Related Documents

| Document | Link |
|---|---|
| SRS - Software Requirements | [SRS.md](./SRS.md) |
| Use Case Document | [UseCase.md](./UseCase.md) |
| API Specification | [APISpec.md](./APISpec.md) |
| Activity Diagram | [ActivityDiagram.md](./ActivityDiagram.md) |
| Sequence Diagram | [SequenceDiagram.md](./SequenceDiagram.md) |
| ERD | [ERD.md](./ERD.md) |
| Test Cases | [TestCase.md](./TestCase.md) |

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Next Review:** After MVP completion
