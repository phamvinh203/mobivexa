# ERD — Entity Relationship Diagram
## Module: Order
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Sơ đồ ERD

```mermaid
erDiagram
    USER {
        string  id       PK
        string  fullName
        string  email
    }

    ADDRESS {
        string id       PK
        string userId
        string fullName
        string phone
        string province
        string district
        string ward
        string streetDetail
    }

    ORDER {
        string        id              PK
        string        orderCode       UK "ORD-YYYYMMDD-HEX"
        string        userId
        string        shippingName    "snapshot"
        string        shippingPhone   "snapshot"
        string        shippingProvince "snapshot"
        string        shippingDistrict "snapshot"
        string        shippingWard    "snapshot"
        string        shippingDetail  "snapshot"
        decimal       subtotal
        decimal       shippingFee     "default 0"
        decimal       discount        "default 0"
        decimal       total
        OrderStatus   status          "default PENDING"
        PaymentMethod paymentMethod   "default COD"
        PaymentStatus paymentStatus   "default UNPAID"
        string        note            "nullable"
        string        cancelReason    "nullable"
        string        couponCode      "nullable snapshot"
        datetime      paidAt          "nullable"
        datetime      createdAt
        datetime      updatedAt
    }

    ORDER_ITEM {
        string  id          PK
        string  orderId
        string  variantId   "nullable - SetNull khi variant bị xóa"
        string  productName "snapshot"
        string  sku         "snapshot"
        string  color       "nullable snapshot"
        string  storage     "nullable snapshot"
        string  ram         "nullable snapshot"
        decimal unitPrice   "snapshot = salePrice tại thời điểm đặt"
        int     quantity
        decimal subtotal
    }

    COUPON_USAGE {
        string   couponId  PK
        string   userId    PK
        string   orderId   UK "onDelete: Cascade - hủy đơn → mất usage"
        datetime createdAt
    }

    PRODUCT_VARIANT {
        string  id    PK
        int     stock "Giảm khi đặt, tăng khi hủy"
    }

    USER          ||--o{ ORDER         : "đặt hàng (1:N)"
    ORDER         ||--o{ ORDER_ITEM    : "chứa items (1:N Cascade)"
    ORDER_ITEM    }o--o| PRODUCT_VARIANT : "tham chiếu variant (N:1 SetNull)"
    ORDER         ||--o| COUPON_USAGE  : "dùng mã giảm giá (1:1)"
```

---

## 2. Mô tả các model

### Order

| Cột | Ghi chú |
|---|---|
| `orderCode` | Unique; format `ORD-{YYYYMMDD}-{6HEX}` |
| `shippingX` | Snapshot địa chỉ tại thời điểm đặt hàng; không FK tới Address |
| `couponCode` | Snapshot mã đã dùng; đơn cũ không đổi khi mã bị sửa/xóa |
| `paidAt` | Chỉ set khi `total = 0` hoặc qua webhook SePay |

**Index:** `@@index([userId])`

### OrderItem

| Cột | Ghi chú |
|---|---|
| `variantId` | Nullable; `onDelete: SetNull` — variant xóa không mất đơn |
| `unitPrice` | Snapshot `salePrice` tại thời điểm đặt |
| `productName`, `sku` | Snapshot — hiển thị đúng dù sản phẩm bị đổi tên/xóa |

**Index:** `@@index([orderId])`

### CouponUsage

| Cột | Ghi chú |
|---|---|
| `@@id([couponId, userId])` | 1 user chỉ dùng 1 mã 1 lần |
| `orderId` | Unique — 1 đơn chỉ gắn 1 usage; `onDelete: Cascade` — hủy đơn tự xóa usage |

---

## 3. Luồng trạng thái

### OrderStatus
```
PENDING → CONFIRMED → SHIPPING → DELIVERED (terminal)
         ↘           ↘          ↘
                   CANCELLED (terminal)
PENDING → CANCELLED
```

### PaymentStatus
```
UNPAID → PAID → REFUNDED
```

---

## 4. Quan hệ stock

```
Đặt hàng:   ProductVariant.stock -= quantity (atomic, rollback nếu count=0)
Hủy đơn:    ProductVariant.stock += quantity (batch theo quantity, skip null variantId)
```
