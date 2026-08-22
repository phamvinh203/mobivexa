# Sequence Diagram — Luồng API
## Module: Coupon
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## SD-01: Tạo mã giảm giá (Admin)

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant V as Validator
    participant S as CouponService
    participant DB as PostgreSQL

    A->>V: POST /api/admin/coupons { code, type, value, ... }
    V-->>A: 400 nếu body không hợp lệ
    V->>S: createCoupon(body)
    S->>S: couponData(body) → normalizeCode UPPERCASE
    S->>DB: coupon.create(data)
    alt P2002 — code trùng
        DB-->>S: UniqueConstraintError
        S-->>A: 409 Mã giảm giá đã tồn tại
    else OK
        DB-->>S: Coupon record
        S->>S: serializeCoupon (Decimal → Number)
        S-->>A: 201 { coupon }
    end
```

---

## SD-02: Preview mã giảm giá (Customer)

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant RL as RateLimiter
    participant V as Validator
    participant S as CouponService
    participant DB as PostgreSQL

    C->>RL: POST /api/coupons/preview { code, items? }
    RL-->>C: 429 nếu vượt giới hạn tần suất
    RL->>V: validatePreviewCoupon
    V-->>C: 400 nếu code > 32 ký tự hoặc items không hợp lệ
    V->>S: previewCoupon(userId, code, items?)

    par Thực hiện song song
        S->>DB: coupon.findUnique WHERE code=UPPERCASE(code)
        DB-->>S: coupon | null
    and
        S->>DB: couponUsage.findFirst WHERE userId + couponCode
        DB-->>S: usage | null
    and
        S->>S: subtotalOf(userId, items?) → resolveItems
        S->>DB: productVariant.findMany WHERE id IN variantIds SELECT salePrice, isActive
        DB-->>S: variants
        S->>S: tính subtotal, kiểm tra unavailable
    end

    alt Giỏ có biến thể ngừng bán
        S-->>C: 200 { valid: false, reason: 'Giỏ hàng có sản phẩm không còn bán...' }
    else Coupon không usable
        S->>S: checkCouponUsable(coupon, hasUsage, subtotal) → { ok: false, reason }
        S-->>C: 200 { valid: false, subtotal, discount: 0, total: subtotal, reason }
    else OK
        S->>S: computeDiscount(rule, subtotal)
        S-->>C: 200 { valid: true, subtotal, discount, total }
    end
```

---

## SD-03: Xem danh sách mã (Customer)

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant S as CouponService
    participant DB as PostgreSQL

    C->>S: GET /api/coupons
    S->>DB: coupon.findMany WHERE isActive+startsAt≤now+endsAt≥now ORDER BY endsAt ASC
    Note over DB: SELECT CUSTOMER_COUPON_SELECT + usageLimit + usedCount
    DB-->>S: coupons[]

    S->>DB: couponUsage.findMany WHERE userId + couponId IN [ids]
    DB-->>S: usages[]

    S->>S: Filter: bỏ mã usedCount >= usageLimit
    S->>S: Map: thêm used=true cho mã khách đã dùng
    S->>S: bóc usageLimit, usedCount ra khỏi response
    S-->>C: 200 { coupons: [...] }
```

---

## SD-04: Xóa mã (Admin)

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant S as CouponService
    participant DB as PostgreSQL

    A->>S: DELETE /api/admin/coupons/:id
    S->>DB: couponUsage.count WHERE couponId=id
    DB-->>S: count

    alt count > 0
        S-->>A: 409 Mã đã có người sử dụng, hãy tắt thay vì xóa
    else count = 0
        S->>DB: coupon.delete WHERE id
        alt P2025 — không tìm thấy
            DB-->>S: RecordNotFound
            S-->>A: 404 Mã giảm giá không tồn tại
        else OK
            DB-->>S: deleted
            S-->>A: 200 Xóa thành công
        end
    end
```

---

## SD-05: Cập nhật mã (Admin — partial update)

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant V as Validator
    participant S as CouponService
    participant DB as PostgreSQL

    A->>V: PUT /api/admin/coupons/:id { ...partial fields }
    V-->>A: 400 nếu field gửi lên không hợp lệ
    V->>S: updateCoupon(id, body)
    S->>DB: coupon.findUnique WHERE id → current
    DB-->>S: current coupon

    S->>S: type = body.type ?? current.type
    S->>S: value = body.value ?? current.value
    Note over S: Kiểm tra PERCENT value ≤ 100
    Note over S: Kiểm tra FIXED không có maxDiscount
    S->>S: Kiểm tra cặp thời gian sau merge với DB

    S->>DB: coupon.update(data)
    alt P2002 — code trùng
        DB-->>S: UniqueConstraintError
        S-->>A: 409 Mã giảm giá đã tồn tại
    else OK
        DB-->>S: updated coupon
        S->>S: serializeCoupon
        S-->>A: 200 { coupon }
    end
```
