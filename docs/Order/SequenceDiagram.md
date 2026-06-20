# Sequence Diagram — Luồng API
## Module: Order (Đơn hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Ghi chú:** Sử dụng cú pháp Mermaid sequenceDiagram

---

## SD-01: Đặt hàng từ giỏ hàng

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Customer)
    participant M as Middleware (Auth)
    participant API as OrderController
    participant S as OrderService
    participant Cart as CartService
    participant DB as PostgreSQL

    C->>M: POST /api/orders + JWT + { addressId }
    M->>M: verify JWT + check role CUSTOMER+
    alt Auth fail
        M-->>C: 401/403
    else Auth success
        M->>API: pass request
        API->>S: createOrder(userId, { addressId })
        S->>Cart: getCartItems(userId)
        Cart-->>S: CartItems array
        alt Cart empty
            S-->>API: 400 Giỏ hàng trống
            API-->>C: 400
        else Cart not empty
            S->>DB: SELECT variants FROM CartItem variantIds
            DB-->>S: Variant records
            alt Variant not exists or inactive
                S-->>API: 400 Sản phẩm không tồn tại/ngừng bán
                API-->>C: 400
            else All variants valid
                S->>S: calculate prices
                S->>S: generate orderCode
                S->>DB: BEGIN transaction
                S->>DB: INSERT Order + OrderItems
                S->>DB: UPDATE ProductVariant SET stock = stock - quantity WHERE id = ? AND stock >= quantity
                DB-->>S: Update count (0 or 1)
                alt count = 0 (stock not enough)
                    S->>DB: ROLLBACK
                    S-->>API: 400 Sản phẩm không đủ hàng
                    API-->>C: 400
                else count > 0 (success)
                    S->>DB: DELETE CartItems WHERE userId = ?
                    S->>DB: COMMIT
                    DB-->>S: Transaction success
                    S-->>API: 201 + order object
                    API-->>C: 201 + order data
                end
            end
        end
    end
```

---

## SD-02: Đặt hàng mua ngay (bypass giỏ)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Customer)
    participant M as Middleware (Auth)
    participant API as OrderController
    participant S as OrderService
    participant DB as PostgreSQL

    C->>M: POST /api/orders + JWT + { addressId, items }
    M->>M: verify JWT + check role CUSTOMER+
    alt Auth fail
        M-->>C: 401/403
    else Auth success
        M->>API: pass request
        API->>S: createOrder(userId, { addressId, items })
        S->>S: resolve variants from items
        S->>DB: SELECT variants FROM item variantIds
        DB-->>S: Variant records
        alt Variant not valid
            S-->>API: 400
            API-->>C: 400
        else All valid
            S->>S: calculate prices + generate orderCode
            S->>DB: BEGIN transaction
            S->>DB: INSERT Order + OrderItems
            S->>DB: UPDATE ProductVariant SET stock = stock - quantity WHERE id = ? AND stock >= quantity
            DB-->>S: Update count
            alt count = 0
                S->>DB: ROLLBACK
                S-->>API: 400
                API-->>C: 400
            else count > 0
                S->>DB: COMMIT
                S-->>API: 201 + order
                API-->>C: 201
            end
        end
    end
```

---

## SD-03: Xem danh sách đơn của tôi

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Customer)
    participant M as Middleware (Auth)
    participant API as OrderController
    participant S as OrderService
    participant DB as PostgreSQL

    C->>M: GET /api/orders?page=1 + JWT
    M->>M: verify JWT
    alt Auth fail
        M-->>C: 401
    else Auth success
        M->>S: listMyOrders(userId, query)
        S->>DB: SELECT orders WHERE userId = ? + pagination
        DB-->>S: Order records
        S-->>API: 200 + { orders, pagination }
        API-->>C: 200
    end
```

---

## SD-04: Xem chi tiết đơn hàng của tôi

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Customer)
    participant M as Middleware (Auth)
    participant API as OrderController
    participant S as OrderService
    participant DB as PostgreSQL

    C->>M: GET /api/orders/:id + JWT
    M->>M: verify JWT
    alt Auth fail
        M-->>C: 401
    else Auth success
        M->>S: getMyOrder(userId, orderId)
        S->>DB: SELECT WHERE id = ? AND userId = ?
        DB-->>S: Order or null
        alt Order not found or not belongs to user
            S-->>API: 404
            API-->>C: 404
        else Order found
            S->>DB: INCLUDE OrderItems, User
            DB-->>S: Full order data
            S-->>API: 200 + order object
            API-->>C: 200
        end
    end
```

---

## SD-05: Hủy đơn hàng (Customer)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Customer)
    participant M as Middleware (Auth)
    participant API as OrderController
    participant S as OrderService
    participant DB as PostgreSQL

    C->>M: PATCH /api/orders/:id/cancel + JWT + { cancelReason }
    M->>M: verify JWT
    alt Auth fail
        M-->>C: 401
    else Auth success
        M->>S: cancelMyOrder(userId, orderId, cancelReason)
        S->>DB: SELECT WHERE id = ? AND userId = ?
        DB-->>S: Order or null
        alt Order not found
            S-->>API: 404
            API-->>C: 404
        else Order found
            S->>S: validate status can be CANCELLED
            alt Cannot cancel (DELIVERED, CANCELLED)
                S-->>API: 400
                API-->>C: 400
            else Can cancel
                S->>DB: BEGIN transaction
                S->>DB: UPDATE Order SET status = CANCELLED, cancelReason = ?
                S->>DB: UPDATE ProductVariant SET stock = stock + quantity WHERE id IN (variantIds)
                S->>DB: COMMIT
                DB-->>S: Success
                S-->>API: 200 + order
                API-->>C: 200
            end
        end
    end
```

---

## SD-06: Admin xem danh sách tất cả đơn

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Admin)
    participant M as Middleware (Auth+Role)
    participant API as OrderController
    participant S as OrderService
    participant DB as PostgreSQL

    C->>M: GET /api/admin/orders?status=PENDING + JWT
    M->>M: verify JWT + check role STAFF+
    alt Auth fail or role insufficient
        M-->>C: 401/403
    else Auth success
        M->>S: listOrders(query)
        S->>DB: SELECT orders with filters + pagination
        S->>DB: INCLUDE User + _count.items
        DB-->>S: Order records with user info
        S-->>API: 200 + { orders, pagination }
        API-->>C: 200
    end
```

---

## SD-07: Admin xem chi tiết đơn hàng bất kỳ

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Admin)
    participant M as Middleware (Auth+Role)
    participant API as OrderController
    participant S as OrderService
    participant DB as PostgreSQL

    C->>M: GET /api/admin/orders/:id + JWT
    M->>M: verify JWT + check role STAFF+
    alt Auth fail or role insufficient
        M-->>C: 401/403
    else Auth success
        M->>S: getOrderById(orderId)
        S->>DB: SELECT WHERE id = ?
        DB-->>S: Order or null
        alt Not found
            S-->>API: 404
            API-->>C: 404
        else Found
            S->>DB: INCLUDE OrderItems, User, Address
            DB-->>S: Full order data
            S-->>API: 200 + order
            API-->>C: 200
        end
    end
```

---

## SD-08: Admin cập nhật trạng thái đơn hàng

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Admin)
    participant M as Middleware (Auth+Role)
    participant V as Validator
    participant API as OrderController
    participant S as OrderService
    participant DB as PostgreSQL

    C->>M: PATCH /api/admin/orders/:id/status + JWT + { status }
    M->>M: verify JWT + check role STAFF+
    alt Auth fail or role insufficient
        M-->>C: 401/403
    else Auth success
        M->>V: validate status + cancelReason
        V->>V: status is valid OrderStatus?
        alt Invalid status
            V-->>C: 400 Trạng thái không hợp lệ
        else status = CANCELLED without cancelReason
            V-->>C: 400 Vui lòng nhập lý do hủy
        else Valid
            V->>S: updateOrderStatus(orderId, status, cancelReason)
            S->>DB: SELECT WHERE id = ?
            DB-->>S: Order or null
            alt Not found
                S-->>API: 404
                API-->>C: 404
            else Found
                S->>S: validate transition per VALID_TRANSITIONS
                alt Invalid transition
                    S-->>API: 400 Không thể chuyển từ... sang...
                    API-->>C: 400
                else Valid transition
                    alt status = CANCELLED
                        S->>DB: BEGIN transaction
                        S->>DB: UPDATE Order SET status = CANCELLED, cancelReason = ?
                        S->>DB: UPDATE ProductVariant SET stock = stock + quantity WHERE id IN (variantIds)
                        S->>DB: COMMIT
                        DB-->>S: Success
                        S-->>API: 200 + order
                        API-->>C: 200
                    else status != CANCELLED
                        S->>DB: UPDATE Order SET status = ?
                        DB-->>S: Updated order
                        S-->>API: 200 + order
                        API-->>C: 200
                    end
                end
            end
        end
    end
```

---

## SD-09: Admin cập nhật thanh toán

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Admin)
    participant M as Middleware (Auth+Role)
    participant V as Validator
    participant API as OrderController
    participant S as OrderService
    participant DB as PostgreSQL

    C->>M: PATCH /api/admin/orders/:id/payment + JWT + { paymentStatus }
    M->>M: verify JWT + check role STAFF+
    alt Auth fail or role insufficient
        M-->>C: 401/403
    else Auth success
        M->>V: validate paymentStatus
        V->>V: paymentStatus is UNPAID/PAID/REFUNDED?
        alt Invalid
            V-->>C: 400 Trạng thái thanh toán không hợp lệ
        else Valid
            V->>S: updatePaymentStatus(orderId, paymentStatus)
            S->>DB: SELECT WHERE id = ? (lean check)
            DB-->>S: Order or null
            alt Not found
                S-->>API: 404
                API-->>C: 404
            else Found
                S->>DB: UPDATE Order SET paymentStatus = ?
                alt paymentStatus = PAID
                    S->>DB: UPDATE Order SET paidAt = NOW()
                end
                DB-->>S: Updated order
                S-->>API: 200 + order
                API-->>C: 200
            end
        end
    end
```

---

## SD-10: Atomic Stock Check-and-Decrement

```mermaid
sequenceDiagram
    autonumber
    participant T1 as Transaction 1
    participant T2 as Transaction 2 (Race)
    participant DB as PostgreSQL
    participant L as Lock (Row Level)

    T1->>DB: BEGIN transaction
    T2->>DB: BEGIN transaction
    
    T1->>DB: SELECT stock FROM ProductVariant WHERE id = ? (current: 10)
    DB-->>T1: stock = 10
    
    T2->>DB: SELECT stock FROM ProductVariant WHERE id = ? (current: 10)
    DB-->>T2: stock = 10
    
    T1->>DB: UPDATE ProductVariant SET stock = stock - 5 WHERE id = ? AND stock >= 5
    DB-->>T1: Update count = 1 (success, stock becomes 5)
    
    T2->>DB: UPDATE ProductVariant SET stock = stock - 7 WHERE id = ? AND stock >= 7
    DB-->>T2: Update count = 0 (FAIL - stock now 5, need 7)
    
    T1->>DB: COMMIT
    DB-->>T1: Transaction 1 success
    
    T2->>DB: ROLLBACK (due to count = 0)
    DB-->>T2: Transaction 2 fail
    
    Note over T1,T2: Transaction 1 wins, Transaction 2 rollback - race condition prevented
```

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Total Diagrams:** 10  
> **Next Review:** After implementation complete
