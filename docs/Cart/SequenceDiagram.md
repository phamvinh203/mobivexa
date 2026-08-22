# Sequence Diagram — Luồng API
## Module: Cart
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## SD-01: Thêm sản phẩm vào giỏ

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant Val as validateAddItem
    participant Svc as cart.service
    participant DB as PostgreSQL

    C->>Val: POST /api/cart/items { variantId, quantity }
    Val-->>C: 400 nếu variantId sai hoặc quantity không 1-100
    Val->>Svc: addItem(userId, body)

    par Song song
        Svc->>DB: productVariant.findUnique WHERE id=variantId\nselect id, isActive, stock
        DB-->>Svc: variant | null
    and
        Svc->>DB: cart.upsert WHERE userId\ncreate { userId } nếu chưa có\nselect { id }
        DB-->>Svc: cart
    end

    Svc-->>C: 404 nếu variant null hoặc !isActive
    Svc-->>C: 400 nếu stock < quantity

    Svc->>DB: cartItem.findUnique WHERE cartId_variantId
    DB-->>Svc: existing | null

    alt Đã có trong giỏ
        Svc->>Svc: newQty = existing.quantity + quantity
        Svc-->>C: 400 nếu newQty > stock
        Svc->>DB: cartItem.update quantity = newQty
    else Chưa có
        Svc->>DB: cartItem.create { cartId, variantId, quantity }
    end

    Svc->>DB: cartItem.count WHERE cartId
    DB-->>Svc: itemCount
    Svc-->>C: 200 { cartId, itemCount }
```

---

## SD-02: Xem giỏ hàng

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant Svc as cart.service
    participant DB as PostgreSQL

    C->>Svc: GET /api/cart
    Svc->>DB: cart.upsert WHERE userId\ninclude items → variant → product + images
    Note over DB: Tạo giỏ mới nếu chưa có;\nkhông tạo khi đã có (update: {})
    DB-->>Svc: cart (items sắp xếp createdAt ASC)
    Svc-->>C: 200 Cart đầy đủ
```

---

## SD-03: Cập nhật số lượng

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant Svc as cart.service
    participant DB as PostgreSQL

    C->>Svc: PUT /api/cart/items/:itemId { quantity }
    Svc->>DB: cart.findUnique WHERE userId
    DB-->>Svc: cart | null
    Svc-->>C: 404 nếu null

    Svc->>DB: cartItem.findFirst WHERE id=itemId AND cartId=cart.id
    DB-->>Svc: item | null
    Svc-->>C: 404 nếu null (không phải của giỏ này)

    Svc->>DB: productVariant.findUnique WHERE id=item.variantId\nselect stock
    DB-->>Svc: variant | null
    Svc-->>C: 400 nếu quantity > stock

    Svc->>DB: cartItem.update WHERE id=itemId SET quantity
    Svc->>DB: cartItem.count WHERE cartId
    DB-->>Svc: itemCount
    Svc-->>C: 200 { cartId, itemCount }
```
