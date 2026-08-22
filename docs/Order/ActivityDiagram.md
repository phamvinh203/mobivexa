# Activity Diagram
## Module: Order
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## AD-01: Tạo đơn hàng

```mermaid
flowchart TD
    Start([POST /api/orders]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> Validate[validateCreateOrder\naddressId, paymentMethod, couponCode, items]
    Validate --> ValidOK{Hợp lệ?}
    ValidOK -- Không --> E400[400]
    ValidOK -- Có --> Parallel1[Song song:\nTìm address by id+userId\nresolveItems - giỏ hoặc items param]
    Parallel1 --> AddrOK{Address tồn tại?}
    AddrOK -- Không --> E404[404]
    AddrOK -- Có --> ItemsOK{Items rỗng?}
    ItemsOK -- Có --> E400b[400 Giỏ hàng trống]
    ItemsOK -- Không --> FetchVariants[Fetch variants\nValidate isActive]
    FetchVariants --> ActiveOK{Tất cả active?}
    ActiveOK -- Không --> E400c[400 Sản phẩm ngừng bán]
    ActiveOK -- Có --> CalcSubtotal[Tính subtotal\nshippingFee=0]
    CalcSubtotal --> HasCoupon{Có couponCode?}
    HasCoupon -- Có --> CheckCoupon[checkCouponUsable\ncomputeDiscount]
    CheckCoupon --> CouponOK{Hợp lệ?}
    CouponOK -- Không --> E400d[400 reason]
    CouponOK -- Có --> CalcTotal[total = subtotal + fee - discount]
    HasCoupon -- Không --> CalcTotal
    CalcTotal --> IsZero{total === 0?}
    IsZero -- Có --> SetPaid[paymentStatus=PAID\npaidAt=now]
    IsZero -- Không --> NoSetPaid[paymentStatus=UNPAID]
    SetPaid & NoSetPaid --> TX[BEGIN TRANSACTION]
    TX --> CreateOrder[order.create + items.create]
    CreateOrder --> DecrStock[updateMany WHERE stock >= qty\nfor each variant]
    DecrStock --> StockOK{count > 0?}
    StockOK -- Không --> Rollback1[ROLLBACK\n400 không đủ hàng]
    StockOK -- Có --> HasCouponTX{Có coupon?}
    HasCouponTX -- Có --> IncrUsed[updateMany usedCount += 1\nWHERE usedCount < usageLimit]
    IncrUsed --> UsedOK{count > 0 hoặc\nkhông có limit?}
    UsedOK -- Không --> Rollback2[ROLLBACK\n409 mã hết lượt]
    UsedOK -- Có --> CreateUsage[couponUsage.create\nP2002 → ROLLBACK 409]
    HasCouponTX -- Không --> FromCart{Đặt từ giỏ?}
    CreateUsage --> FromCart
    FromCart -- Có --> ClearCart[cartItem.deleteMany]
    FromCart -- Không --> Commit[COMMIT]
    ClearCart --> Commit
    Commit --> R201[201 order + items]
```

---

## AD-02: Hủy đơn (cancelAndRestoreStock)

```mermaid
flowchart TD
    Start([cancelAndRestoreStock order, reason]) --> TX[BEGIN TRANSACTION]
    TX --> UpdateStatus[order.update\nWHERE id=order.id\nAND status=order.status\n→ CANCELLED]
    UpdateStatus --> P2025{P2025?}
    P2025 -- Có --> E409[ROLLBACK\n409 Đơn vừa được cập nhật]
    P2025 -- Không --> BatchItems[Group items by quantity\nSkip variantId=null]
    BatchItems --> RestoreStock[updateMany stock += qty\ncho mỗi batch]
    RestoreStock --> FindUsage[Tìm CouponUsage by orderId]
    FindUsage --> HasUsage{Tồn tại?}
    HasUsage -- Có --> DelUsage[Xóa CouponUsage]
    DelUsage --> DecrUsed[coupon.updateMany\nusedCount -= 1\nWHERE usedCount > 0]
    HasUsage -- Không --> Commit[COMMIT]
    DecrUsed --> Commit
    Commit --> R200[200 order CANCELLED]
```

---

## AD-03: Admin chuyển trạng thái

```mermaid
flowchart TD
    Start([PATCH /admin/orders/:id/status]) --> Auth{STAFF+?}
    Auth -- Không --> E401_403[401/403]
    Auth -- Có --> Validate[validateUpdateStatus\nstatus enum\nif CANCELLED → cancelReason required]
    Validate --> ValOK{Hợp lệ?}
    ValOK -- Không --> E400[400]
    ValOK -- Có --> FindOrder[Tìm order\nselect id, status, items]
    FindOrder --> Exist{Tồn tại?}
    Exist -- Không --> E404[404]
    Exist -- Có --> CheckTransition{VALID_TRANSITIONS\ncurrentStatus\nchứa targetStatus?}
    CheckTransition -- Không --> E400b[400 Transition không hợp lệ]
    CheckTransition -- Có --> IsCancelled{targetStatus\n=== CANCELLED?}
    IsCancelled -- Có --> Cancel[cancelAndRestoreStock]
    IsCancelled -- Không --> Guard[order.update\nWHERE id AND status=currentStatus]
    Guard --> P2025{P2025?}
    P2025 -- Có --> E409[409 Concurrency conflict]
    P2025 -- Không --> R200[200 order updated]
    Cancel --> R200b[200 order CANCELLED]
```
