# SRS — Software Requirement Specification
## Module: Coupon
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22 | **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Endpoints tổng quan

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/coupons` | Customer | Danh sách mã đang chạy (kèm cờ used) |
| POST | `/api/coupons/preview` | Customer | Xem trước mức giảm |
| GET | `/api/admin/coupons` | STAFF+ | Danh sách admin (pagination, filter) |
| GET | `/api/admin/coupons/:id` | STAFF+ | Chi tiết mã |
| POST | `/api/admin/coupons` | STAFF+ | Tạo mã |
| PUT | `/api/admin/coupons/:id` | STAFF+ | Cập nhật mã |
| PATCH | `/api/admin/coupons/:id/status` | STAFF+ | Bật/tắt mã |
| DELETE | `/api/admin/coupons/:id` | STAFF+ | Xóa mã |

---

## 2. Schema dữ liệu

### Bảng `Coupon`

| Trường | Kiểu | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| `id` | uuid | No | uuid() | PK |
| `code` | string | No | — | Unique; UPPERCASE |
| `description` | string | Yes | — | Mô tả (nullable) |
| `type` | CouponType | No | — | PERCENT \| FIXED |
| `value` | Decimal(12,2) | No | — | Giá trị giảm |
| `maxDiscount` | Decimal(12,2) | Yes | — | Trần giảm; CHỈ PERCENT |
| `minOrderValue` | Decimal(12,2) | No | 0 | Sàn đơn hàng |
| `usageLimit` | Int | Yes | — | null = không giới hạn |
| `usedCount` | Int | No | 0 | Tổng lượt đã dùng |
| `startsAt` | DateTime | No | — | Thời điểm hiệu lực |
| `endsAt` | DateTime | No | — | Thời điểm hết hạn |
| `isActive` | Boolean | No | true | Trạng thái bật/tắt |
| `createdAt` | DateTime | No | now() | |
| `updatedAt` | DateTime | No | updatedAt | |

### Bảng `CouponUsage`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `couponId` | string | FK → Coupon; onDelete: Cascade |
| `userId` | string | FK → User; onDelete: Cascade |
| `orderId` | string | FK → Order; onDelete: Cascade; Unique |
| `createdAt` | DateTime | |

- **Composite PK: `(couponId, userId)`** — ràng buộc 1 lượt/khách/mã ở DB level
- `orderId` unique: 1 đơn dùng tối đa 1 mã

### Enum `CouponType`

```
PERCENT   // value = 10 → giảm 10%, có thể kèm maxDiscount
FIXED     // value = 100000 → giảm thẳng 100.000đ, không có maxDiscount
```

---

## 3. Yêu cầu chức năng

### FR-01: Danh sách mã đang chạy (Customer)

| | |
|---|---|
| **Endpoint** | `GET /api/coupons` |
| **Auth** | ✅ Customer |

**Điều kiện lọc:** `isActive=true AND startsAt <= now AND endsAt >= now`  
**Sắp xếp:** `endsAt ASC` (mã sắp hết hạn trước)  
**Không phân trang:** Toàn bộ danh sách, payload vài KB.

**Xử lý thêm:**
1. Lọc bỏ mã đã hết lượt: `usageLimit !== null AND usedCount >= usageLimit`
2. Đánh dấu mã khách đã dùng: `used: true` (không giấu mã, để FE làm mờ kèm lý do)

**Fields trả về (CUSTOMER_COUPON_SELECT):** `id, code, description, type, value, maxDiscount, minOrderValue, endsAt, used`

> `usedCount`, `usageLimit`, `createdAt`, `updatedAt`, `startsAt` **không ra client** — tránh lộ số liệu kinh doanh.

---

### FR-02: Preview mã giảm giá (Customer)

| | |
|---|---|
| **Endpoint** | `POST /api/coupons/preview` |
| **Auth** | ✅ Customer |
| **Rate limit** | `couponPreviewLimiter` |

**Body:**
| Field | Type | Required | Validation |
|---|---|---|---|
| `code` | string | ✅ | ≤ 32 ký tự |
| `items` | array | ❌ | Nếu có: mỗi phần tử cần `variantId` và `quantity > 0` |

**Xử lý:**
1. Normalize code → UPPERCASE
2. Song song: tìm coupon, tìm usage, tính subtotal từ giỏ hàng
3. Nếu giỏ có biến thể ngừng bán → trả `{ valid: false, reason: '...' }` (TỪ CHỐI, không lọc)
4. `checkCouponUsable(coupon, hasUsage, subtotal)` → kiểm tra tất cả điều kiện
5. `computeDiscount(rule, subtotal)` → trả `{ valid, subtotal, discount, total }`

**Response luôn là 200** — client đọc cờ `valid`:
```json
{
  "valid": true,
  "subtotal": 500000,
  "discount": 50000,
  "total": 450000
}
```
Hoặc:
```json
{
  "valid": false,
  "subtotal": 100000,
  "discount": 0,
  "total": 100000,
  "reason": "Đơn hàng tối thiểu 200.000đ"
}
```

---

### FR-03: Danh sách admin (STAFF+)

| | |
|---|---|
| **Endpoint** | `GET /api/admin/coupons` |
| **Auth** | ✅ STAFF+ |

**Query params:**
| Param | Mô tả |
|---|---|
| `page`, `limit` | Phân trang |
| `search` | Tìm theo code (UPPERCASE, không dùng ILIKE) |
| `isActive` | `"true"` \| `"false"` |
| `status` | `running` \| `scheduled` \| `expired` |

**Status filter:**
- `running`: `isActive=true AND startsAt <= now AND endsAt >= now`
- `scheduled`: `startsAt > now`
- `expired`: `endsAt < now`

**Include:** `_count.usages` (tổng lượt đã dùng)

---

### FR-04: Tạo mã (STAFF+)

**Validation:**
- `code`: 3-32 ký tự, chỉ `A-Z 0-9 _ -`
- `type`: PERCENT | FIXED
- `value` > 0; nếu PERCENT thì ≤ 100
- `maxDiscount` chỉ được gửi khi `type=PERCENT`
- `minOrderValue` ≥ 0
- `usageLimit` nguyên dương nếu gửi
- `startsAt` và `endsAt` phải hợp lệ; `endsAt > startsAt`
- `isActive` phải là boolean nếu gửi

**Lỗi:** 409 nếu `code` đã tồn tại (P2002).

---

### FR-05: Cập nhật mã (STAFF+)

- Partial update: chỉ các field gửi lên mới được cập nhật
- Kiểm tra DB: nếu đổi type → FIXED thì xóa `maxDiscount` tự động
- Kiểm tra cặp thời gian sau khi merge với giá trị DB

---

### FR-06: Bật/tắt mã (STAFF+)

Toggle `isActive` — không cần gửi body.

---

### FR-07: Xóa mã (STAFF+)

**Guard:** Nếu `CouponUsage.count(couponId) > 0` → **409** `Mã đã có người sử dụng, hãy tắt thay vì xóa`  
Lý do: xóa mã đang chạy làm mất khả năng đối chiếu lịch sử.

---

## 4. Yêu cầu phi chức năng

| | |
|---|---|
| **Idempotency** | Preview luôn 200; duplicate coupon trả 409 |
| **Rate limit** | Preview endpoint bị giới hạn tần suất |
| **Data integrity** | Decimal → Number khi serialize, tránh lỗi hiển thị |
| **Index** | `@@index([isActive, startsAt, endsAt])` tối ưu query "mã đang chạy" |
