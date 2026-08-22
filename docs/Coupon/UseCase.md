# Use Case Document
## Module: Coupon
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Customer** | Khách đã đăng nhập — xem và preview mã |
| **Staff / Admin** | Quản trị toàn bộ mã giảm giá |
| **System (Order)** | Ghi `CouponUsage` khi đặt hàng; xóa khi hủy đơn |

---

## 2. Danh sách Use Case

| ID | Tên | Actor | Ưu tiên |
|---|---|---|---|
| UC-01 | Xem danh sách mã đang chạy | Customer | Cao |
| UC-02 | Preview mức giảm | Customer | Cao |
| UC-03 | Tạo mã giảm giá | Staff/Admin | Cao |
| UC-04 | Cập nhật mã | Staff/Admin | Trung bình |
| UC-05 | Bật / Tắt mã | Staff/Admin | Trung bình |
| UC-06 | Xóa mã | Staff/Admin | Thấp |
| UC-07 | Xem danh sách mã (Admin) | Staff/Admin | Trung bình |
| UC-08 | Xem chi tiết mã | Staff/Admin | Thấp |

---

## 3. Chi tiết Use Case

---

### UC-01: Xem danh sách mã đang chạy

| | |
|---|---|
| **Actor** | Customer (đăng nhập) |
| **Mục tiêu** | Chọn mã phù hợp trước khi đặt hàng |
| **Tiền điều kiện** | Đã đăng nhập |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/coupons`
2. Lọc mã `isActive + startsAt <= now + endsAt >= now`
3. Lọc bỏ mã đã hết lượt
4. Đánh dấu `used: true` với mã khách đã dùng
5. Trả danh sách (không phân trang)

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 1 | Không có token | `401` |

**Điểm khác biệt:**
- Mã đã dùng vẫn trả về (cờ `used: true`), không bị ẩn
- Không lộ `usedCount`, `usageLimit` cho customer

---

### UC-02: Preview mức giảm

| | |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Kiểm tra mã có hợp lệ không và xem mức giảm |
| **Tiền điều kiện** | Đã đăng nhập |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `POST /api/coupons/preview` với `{ code, items? }`
2. Validate: code ≤ 32 ký tự; items hợp lệ nếu gửi
3. Song song: lookup coupon, lookup usage, tính subtotal
4. Nếu giỏ có biến thể ngừng bán → `{ valid: false, reason: '...' }`
5. `checkCouponUsable` → kiểm tra: tồn tại, isActive, thời hạn, sàn đơn, đã dùng chưa, còn lượt không
6. Nếu hợp lệ → `computeDiscount` → trả `{ valid: true, subtotal, discount, total }`

**Luồng thay thế:**

| Điều kiện | Phản hồi |
|---|---|
| Mã không tồn tại | `{ valid: false, reason: 'Mã giảm giá không tồn tại' }` |
| Mã đã hết hạn | `{ valid: false, reason: '...' }` |
| Đơn dưới sàn | `{ valid: false, reason: 'Đơn hàng tối thiểu ...' }` |
| Đã dùng mã này rồi | `{ valid: false, reason: '...' }` |
| Giỏ có biến thể ngừng bán | `{ valid: false, reason: 'Giỏ hàng có sản phẩm không còn bán...' }` |

> Endpoint **luôn trả 200**. Client đọc cờ `valid`, không phân nhánh theo HTTP status.

---

### UC-03: Tạo mã giảm giá

| | |
|---|---|
| **Actor** | Staff / Admin |
| **Mục tiêu** | Tạo mã mới cho đợt khuyến mãi |
| **Tiền điều kiện** | Đã đăng nhập STAFF+ |
| **Hậu điều kiện** | Mã tạo mới trong DB, `isActive=true` mặc định |

**Luồng chính:**
1. `POST /api/admin/coupons` với body đầy đủ
2. Validate tất cả fields
3. Normalize code → UPPERCASE
4. `prisma.coupon.create()`
5. Serialize Decimal → Number
6. Trả `201`

**Luồng thay thế:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Code đã tồn tại | 409 | `Mã giảm giá đã tồn tại` |
| Value > 100 với PERCENT | 400 | `Giảm theo phần trăm không được vượt quá 100` |
| maxDiscount gửi với FIXED | 400 | `Mã giảm số tiền cố định không có trần giảm` |
| endsAt <= startsAt | 400 | `Thời gian kết thúc phải sau thời gian bắt đầu` |

---

### UC-04: Cập nhật mã

- Partial update: chỉ field gửi lên được cập nhật
- Kiểm tra cross-field sau khi merge với DB (xem SRS FR-05)

---

### UC-05: Bật / Tắt mã

- `PATCH /api/admin/coupons/:id/status` — toggle `isActive`
- Không cần body

---

### UC-06: Xóa mã

**Luồng chính:**
1. `DELETE /api/admin/coupons/:id`
2. Đếm `CouponUsage` của mã
3. Nếu `usedCount > 0` → **409** → yêu cầu tắt thay vì xóa

**Lý do guard:** Bảo toàn khả năng đối chiếu lịch sử và tránh mất mã của khách đang giữ giữa chừng.

---

### UC-07: Danh sách mã (Admin)

- Lọc theo `search`, `isActive`, `status` (running/scheduled/expired)
- Phân trang `page/limit`
- Kèm `_count.usages`

---

## 4. Quan hệ Use Cases

```
UC-03 Tạo mã ──► Mã trong DB
                      │
                UC-01 / UC-02 (customer xem + preview)
                      │
              System: đặt hàng → CouponUsage.create
              System: hủy đơn → CouponUsage.delete (mã khả dụng lại)
                      │
              UC-05 Bật/tắt (admin quản trị)
              UC-06 Xóa (chỉ khi usedCount=0)
```
