# Activity Diagram
## Module: Coupon
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## AD-01: Tạo mã giảm giá (Admin)

```mermaid
flowchart TD
    Start([Admin gửi POST /admin/coupons]) --> NullCheck{Field NOT NULL\nnào bị null?}
    NullCheck -- Có --> E400a[400 field không được trống]
    NullCheck -- Không --> CodeCheck{code hợp lệ?\nA-Z0-9_- 3-32 ký tự}
    CodeCheck -- Không --> E400b[400 Mã không đúng định dạng]
    CodeCheck -- Có --> TypeCheck{type hợp lệ?}
    TypeCheck -- Không --> E400c[400 Loại mã không hợp lệ]
    TypeCheck -- Có --> ValueCheck{value > 0?\nvà nếu PERCENT ≤ 100?}
    ValueCheck -- Không --> E400d[400 Giá trị giảm không hợp lệ]
    ValueCheck -- Có --> MaxCheck{maxDiscount\ngửi kèm FIXED?}
    MaxCheck -- Có --> E400e[400 FIXED không có trần giảm]
    MaxCheck -- Không --> DateCheck{endsAt > startsAt?}
    DateCheck -- Không --> E400f[400 Thời gian kết thúc phải sau bắt đầu]
    DateCheck -- Có --> Normalize[normalizeCode → UPPERCASE]
    Normalize --> Create[prisma.coupon.create]
    Create -- P2002 --> E409[409 Mã đã tồn tại]
    Create -- OK --> Serialize[serializeCoupon\nDecimal → Number]
    Serialize --> R201[201 Created]
```

---

## AD-02: Preview mã giảm giá (Customer)

```mermaid
flowchart TD
    Start([Customer gửi POST /coupons/preview]) --> RateLimit{Vượt rate limit?}
    RateLimit -- Có --> E429[429 Too Many Requests]
    RateLimit -- Không --> ValidateCode{code ≤ 32 ký tự?\nitems hợp lệ nếu gửi?}
    ValidateCode -- Không --> E400[400 Bad Request]
    ValidateCode -- Có --> Parallel[Thực hiện song song]

    Parallel --> LC[Lookup Coupon\nby normalized code]
    Parallel --> LU[Lookup CouponUsage\ncủa userId]
    Parallel --> ST[Tính subtotal\ntừ giỏ hàng]

    LC & LU & ST --> UnavCheck{Giỏ có biến thể\nngừng bán?}
    UnavCheck -- Có --> RInvalid1[200 valid=false\nreason: cập nhật giỏ]
    UnavCheck -- Không --> Usable{checkCouponUsable\nok?}
    Usable -- Không --> RInvalid2[200 valid=false\nreason: lý do cụ thể]
    Usable -- Có --> Compute[computeDiscount\ndiscount = f type, value, maxDiscount, subtotal]
    Compute --> RValid[200 valid=true\nsubtotal, discount, total]
```

---

## AD-03: Xóa mã (Admin)

```mermaid
flowchart TD
    Start([Admin gửi DELETE /admin/coupons/:id]) --> FindCoupon[findCouponOrThrow id]
    FindCoupon -- 404 --> E404[404 Mã không tồn tại]
    FindCoupon -- OK --> CountUsage[đếm CouponUsage\nwhere couponId=id]
    CountUsage -- count > 0 --> E409[409 Mã đã có người sử dụng\nhãy tắt thay vì xóa]
    CountUsage -- count = 0 --> Delete[prisma.coupon.delete]
    Delete -- P2025 --> E404b[404]
    Delete -- OK --> R200[200 Xóa thành công]
```

---

## AD-04: Bật / Tắt mã (Admin)

```mermaid
flowchart TD
    Start([PATCH /admin/coupons/:id/status]) --> Find[findCouponOrThrow id]
    Find -- 404 --> E404[404]
    Find -- OK --> Toggle[isActive = !isActive]
    Toggle --> Update[prisma.coupon.update]
    Update --> Serialize[serializeCoupon]
    Serialize --> R200[200 + coupon updated]
```

---

## AD-05: Xem danh sách mã (Customer)

```mermaid
flowchart TD
    Start([GET /api/coupons]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> QueryRunning[Query mã isActive+startsAt≤now+endsAt≥now\nsorted by endsAt ASC]
    QueryRunning --> QueryUsage[Query CouponUsage\nwhere userId + couponId IN mã trên]
    QueryUsage --> Filter[Lọc bỏ mã hết lượt\nusedCount >= usageLimit]
    Filter --> Map[Map: thêm cờ used=true\ncho mã khách đã dùng]
    Map --> R200[200 coupons array]
```
