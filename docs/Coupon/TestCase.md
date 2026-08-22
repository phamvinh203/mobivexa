# Test Case Document
## Module: Coupon
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| GET /coupons (Customer) | 5 |
| POST /coupons/preview | 9 |
| GET /admin/coupons | 4 |
| GET /admin/coupons/:id | 2 |
| POST /admin/coupons (Create) | 12 |
| PUT /admin/coupons/:id (Update) | 6 |
| PATCH /admin/coupons/:id/status | 2 |
| DELETE /admin/coupons/:id | 4 |
| **Tổng** | **44** |

---

## TC-LIST: Danh sách mã (Customer)

### TC-LIST-01: Trả mã đang chạy

**Precondition:** Có mã `SUMMER20` isActive=true, startsAt < now, endsAt > now  
**Input:** `GET /api/coupons` với Customer token  
**Expected:**
- HTTP: `200`
- `data.coupons` có `SUMMER20`
- Không có `usedCount`, `usageLimit`, `startsAt`

---

### TC-LIST-02: Không trả mã hết lượt

**Precondition:** Mã `FULL10` có `usageLimit=5, usedCount=5`  
**Expected:** `FULL10` không có trong response

---

### TC-LIST-03: Mã đã dùng vẫn trả về nhưng cờ `used=true`

**Precondition:** Customer đã có CouponUsage cho mã `USED50`  
**Expected:** `USED50` có trong response với `used: true`

---

### TC-LIST-04: Sắp xếp theo endsAt tăng dần

**Precondition:** Hai mã A (endsAt xa) và B (endsAt gần)  
**Expected:** B xuất hiện trước A

---

### TC-LIST-05: Không có token → 401

**Input:** `GET /api/coupons` không có Authorization  
**Expected:** `401`

---

## TC-PREVIEW: Preview mã giảm giá

### TC-PREVIEW-01: Preview mã PERCENT hợp lệ

**Precondition:** Mã `SAVE10` type=PERCENT value=10 minOrderValue=0  
**Input:**
```json
{ "code": "save10", "items": [{ "variantId": "v1", "quantity": 2 }] }
```
**Expected:**
- HTTP: `200`
- `valid: true`
- `discount = subtotal * 0.10`

---

### TC-PREVIEW-02: Áp dụng maxDiscount (trần giảm)

**Precondition:** Mã `SAVE20` PERCENT value=20 maxDiscount=50000  
**Input:** subtotal = 500000  
**Expected:** `discount = 50000` (không phải 100000)

---

### TC-PREVIEW-03: Mã FIXED

**Precondition:** Mã `OFF50K` FIXED value=50000 minOrderValue=0  
**Input:** subtotal = 200000  
**Expected:** `discount = 50000`, `total = 150000`

---

### TC-PREVIEW-04: Đơn dưới sàn

**Precondition:** Mã có `minOrderValue = 500000`  
**Input:** subtotal = 100000  
**Expected:** `{ valid: false, reason: 'Đơn hàng tối thiểu 500.000đ' }`

---

### TC-PREVIEW-05: Đã dùng mã này rồi

**Precondition:** CouponUsage(userId, couponId) đã tồn tại  
**Expected:** `{ valid: false, reason: '...' }`

---

### TC-PREVIEW-06: Mã không tồn tại

**Input:** `{ "code": "NOTEXIST" }`  
**Expected:** `{ valid: false, reason: 'Mã giảm giá không tồn tại' }`

---

### TC-PREVIEW-07: Giỏ có biến thể ngừng bán → từ chối (không lọc)

**Precondition:** Item trong `items` có `isActive=false`  
**Expected:** `{ valid: false, reason: 'Giỏ hàng có sản phẩm không còn bán...' }`

---

### TC-PREVIEW-08: Code quá 32 ký tự

**Input:** `{ "code": "A".repeat(33) }`  
**Expected:** `400`

---

### TC-PREVIEW-09: Preview không có items (giỏ trống)

**Precondition:** Mã hợp lệ, không có sàn đơn  
**Input:** `{ "code": "FREE" }` (không gửi items)  
**Expected:** `{ valid: true, subtotal: 0, discount: 0, total: 0 }` hoặc valid theo logic

---

## TC-ADMIN-LIST: Danh sách mã (Admin)

### TC-ALIST-01: Lọc theo status=running

**Precondition:** Có mã running, scheduled, expired  
**Input:** `GET /admin/coupons?status=running`  
**Expected:** Chỉ trả mã isActive+startsAt≤now+endsAt≥now

---

### TC-ALIST-02: Tìm theo code (case-insensitive)

**Input:** `GET /admin/coupons?search=summer`  
**Expected:** Trả mã có code chứa `SUMMER`

---

### TC-ALIST-03: Kèm `_count.usages`

**Expected:** Mỗi coupon có `_count.usages` đúng số usage hiện tại

---

### TC-ALIST-04: Không có token → 401

**Expected:** `401`

---

## TC-DETAIL: Chi tiết mã (Admin)

### TC-DETAIL-01: Lấy mã hợp lệ

**Expected:** `200` + object coupon đầy đủ kèm `_count`

---

### TC-DETAIL-02: ID không tồn tại → 404

**Expected:** `404` `Mã giảm giá không tồn tại`

---

## TC-CREATE: Tạo mã

### TC-CREATE-01: Tạo mã PERCENT thành công

**Input:**
```json
{
  "code": "SUMMER20",
  "type": "PERCENT",
  "value": 20,
  "maxDiscount": 100000,
  "minOrderValue": 200000,
  "startsAt": "2026-08-01T00:00:00Z",
  "endsAt": "2026-08-31T23:59:59Z"
}
```
**Expected:** `201` + `data.coupon.code === "SUMMER20"`

---

### TC-CREATE-02: Tạo mã FIXED thành công (không cần maxDiscount)

**Input:** `{ type: "FIXED", value: 50000, ... }`  
**Expected:** `201`

---

### TC-CREATE-03: Code tự động UPPERCASE

**Input:** `{ "code": "summer20" }`  
**Expected:** `data.coupon.code === "SUMMER20"`

---

### TC-CREATE-04: Code đã tồn tại → 409

**Precondition:** Mã `SUMMER20` đã có  
**Expected:** `409` `Mã giảm giá đã tồn tại`

---

### TC-CREATE-05: Code không đúng định dạng

**Input:** `{ "code": "ab" }` (chỉ 2 ký tự)  
**Expected:** `400`

---

### TC-CREATE-06: PERCENT value > 100

**Input:** `{ "type": "PERCENT", "value": 150 }`  
**Expected:** `400`

---

### TC-CREATE-07: FIXED với maxDiscount → 400

**Input:** `{ "type": "FIXED", "value": 50000, "maxDiscount": 30000 }`  
**Expected:** `400` `Mã giảm số tiền cố định không có trần giảm`

---

### TC-CREATE-08: endsAt <= startsAt → 400

**Input:** `{ "startsAt": "2026-09-01", "endsAt": "2026-08-01" }`  
**Expected:** `400` `Thời gian kết thúc phải sau thời gian bắt đầu`

---

### TC-CREATE-09: minOrderValue âm → 400

**Input:** `{ "minOrderValue": -1 }`  
**Expected:** `400`

---

### TC-CREATE-10: usageLimit không phải số nguyên dương

**Input:** `{ "usageLimit": 0 }`  
**Expected:** `400`

---

### TC-CREATE-11: isActive không phải boolean

**Input:** `{ "isActive": "true" }` (string)  
**Expected:** `400` `Trạng thái phải là true hoặc false`

---

### TC-CREATE-12: Null trên field NOT NULL → 400

**Input:** `{ "code": null }`  
**Expected:** `400` `Mã giảm giá không được để trống`

---

## TC-UPDATE: Cập nhật mã

### TC-UPDATE-01: Partial update endsAt (gia hạn)

**Input:** `PUT /admin/coupons/:id { "endsAt": "2026-12-31T23:59:59Z" }`  
**Expected:** `200` + endsAt cập nhật, các field khác không thay đổi

---

### TC-UPDATE-02: Đổi type PERCENT → FIXED tự xóa maxDiscount

**Input:** `{ "type": "FIXED" }` trên mã có maxDiscount=50000  
**Expected:** `200` + `data.coupon.maxDiscount === null`

---

### TC-UPDATE-03: Push startsAt vượt endsAt hiện tại → 400

**Precondition:** Mã có endsAt=2026-08-31  
**Input:** `{ "startsAt": "2026-09-01T00:00:00Z" }` (không gửi endsAt)  
**Expected:** `400` `Thời gian kết thúc phải sau thời gian bắt đầu`

---

### TC-UPDATE-04: Code trùng khi cập nhật → 409

**Expected:** `409`

---

### TC-UPDATE-05: ID không tồn tại → 404

**Expected:** `404`

---

### TC-UPDATE-06: PERCENT value > 100 khi type đang PERCENT

**Input:** `PUT { "value": 110 }` trên mã PERCENT  
**Expected:** `400`

---

## TC-TOGGLE: Bật/Tắt mã

### TC-TOGGLE-01: Toggle từ true → false

**Precondition:** Mã `isActive=true`  
**Expected:** `200` + `data.coupon.isActive === false`

---

### TC-TOGGLE-02: Toggle từ false → true

**Precondition:** Mã `isActive=false`  
**Expected:** `200` + `data.coupon.isActive === true`

---

## TC-DELETE: Xóa mã

### TC-DELETE-01: Xóa mã chưa được dùng

**Precondition:** Mã không có CouponUsage  
**Expected:** `200`

---

### TC-DELETE-02: Xóa mã đã có người dùng → 409

**Precondition:** Có ít nhất 1 CouponUsage cho mã  
**Expected:** `409` `Mã đã có người sử dụng, hãy tắt thay vì xóa`

---

### TC-DELETE-03: ID không tồn tại → 404

**Expected:** `404`

---

### TC-DELETE-04: Sau khi xóa, GET /admin/coupons không còn mã đó

**Expected:** Mã không xuất hiện trong danh sách

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Code luôn UPPERCASE | TC-CREATE-03 |
| Code unique (409) | TC-CREATE-04 |
| Code format 3-32 A-Z0-9_- | TC-CREATE-05 |
| PERCENT value ≤ 100 | TC-CREATE-06, TC-UPDATE-06 |
| FIXED không có maxDiscount | TC-CREATE-07 |
| FIXED auto-clear maxDiscount khi đổi type | TC-UPDATE-02 |
| endsAt > startsAt | TC-CREATE-08 |
| Partial update thời gian check với DB | TC-UPDATE-03 |
| Delete guard (usedCount > 0) | TC-DELETE-02 |
| Preview luôn 200 | TC-PREVIEW-01..09 |
| Preview từ chối giỏ có biến thể ngừng bán | TC-PREVIEW-07 |
| used=true cho mã đã dùng | TC-LIST-03 |
| Lọc mã hết lượt | TC-LIST-02 |
