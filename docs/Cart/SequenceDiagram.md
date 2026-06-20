# Sequence Diagram — Module Cart (Giỏ hàng)
## Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-20  
> **Tham chiếu:** [BRD.md](./BRD.md) | [SRS.md](./SRS.md)

---

## Danh sách Diagram

1. [Xem Giỏ Hàng (View Cart)](#1-xem-giỏ-hàng-view-cart)
2. [Thêm Sản Phẩm Vào Giỏ (Add to Cart)](#2-thêm-sản-phẩm-vào-giỏ-add-to-cart)
3. [Cập Nhật Số Lượng (Update Quantity)](#3-cập-nhật-số-lượng-update-quantity)
4. [Xóa Sản Phẩm (Remove Item)](#4-xóa-sản-phẩm-remove-item)
5. [Xóa Toàn Bộ Giỏ Hàng (Clear Cart)](#5-xóa-toàn-bộ-giỏ-hàng-clear-cart)

---

## 1. Xem Giỏ Hàng (View Cart)

### Mô tả
Khách hàng lấy toàn bộ thông tin giỏ hàng với đầy đủ chi tiết variant, product và ảnh bìa.

### Participants

| Actor | Mô tả |
|---|---|
| **Customer** | Khách hàng đã đăng nhập |
| **API Controller** | REST API endpoint handler |
| **Cart Service** | Business logic layer |
| **Prisma Client** | ORM wrapper |
| **Database** | PostgreSQL database |

### Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    participant Customer as Khách hàng
    participant API as API Controller
    participant Service as Cart Service
    participant Prisma as Prisma Client
    participant DB as Database

    Note over Customer,DB: KHỞI ĐẦU - Lấy JWT token

    Customer->>API: GET /api/cart
    Note right of Customer: Header: Authorization: Bearer <JWT>
    
    API->>API: Extract userId từ JWT token
    Note right of API: userId = JWT.payload.userId

    API->>Service: getCartByUserId(userId)
    
    Note over Service,DB: BƯỚC 1: Upsert Cart (Tạo nếu chưa có)

    Service->>Prisma: cart.upsert({
        where: { userId },
        update: {},
        create: { userId }
    })
    
    Prisma->>DB: SELECT * FROM "Cart" WHERE "userId" = ?
    DB-->>Prisma: Cart record (nếu có)
    
    alt Cart chưa tồn tại
        Prisma->>DB: INSERT INTO "Cart" (id, userId, createdAt)
        DB-->>Prisma: Cart mới được tạo
    end
    
    Prisma-->>Service: Cart { id, userId, createdAt }

    Note over Service,DB: BƯỚC 2: Query CartItems với Eager Loading

    Service->>Prisma: cartItem.findMany({
        where: { cartId },
        include: {
            variant: {
                select: {
                    id, color, storage, ram,
                    salePrice, stock, isActive
                }
            },
            variant: {
                include: {
                    product: {
                        select: { id, name, slug }
                    }
                }
            }
        },
        orderBy: { createdAt: 'asc' }
    })
    
    Prisma->>DB: 
        SELECT ci.*, 
               pv.id, pv.color, pv.storage, pv.ram, 
               pv."salePrice", pv.stock, pv."isActive",
               p.id, p.name, p.slug
        FROM "CartItem" ci
        JOIN "ProductVariant" pv ON ci."variantId" = pv.id
        JOIN "Product" p ON pv."productId" = p.id
        WHERE ci."cartId" = ?
        ORDER BY ci."createdAt" ASC
    
    DB-->>Prisma: Array of CartItems with nested variant + product

    Note over Service,DB: BƯỚC 3: Query ảnh bìa cho mỗi Product

    loop Mỗi product trong cart
        Service->>Prisma: image.findMany({
            where: {
                productId,
                isCover: true
            },
            take: 1
        })
        
        Prisma->>DB: 
            SELECT * FROM "Image" 
            WHERE "productId" = ? AND "isCover" = true
            LIMIT 1
        
        DB-->>Prisma: Cover image { url, alt, isCover }
    end

    Note over Service,DB: BƯỚC 4: Gộp dữ liệu và trả response

    Service->>Service: Map datastructure
    Note right of Service: items = cartItems.map(item => ({
        id: item.id,
        quantity: item.quantity,
        variant: { ...item.variant, product: item.variant.product },
        coverImage: coverImages[item.variant.product.id]
    }))

    Service-->>API: Cart { id, userId, items: [...] }
    API-->>Customer: HTTP 200 OK
    Note right of API: Response: { cart: { id, userId, items } }

    Customer->>Customer: Render UI giỏ hàng
    Note left of Customer: Hiển thị danh sách items<br/>với thông tin đầy đủ
```

### Chi tiết Database Operations

| Operation | Table | Query | Purpose |
|---|---|---|---|
| **Upsert** | `Cart` | `SELECT` + `INSERT` (nếu cần) | Tạo giỏ nếu chưa có |
| **Query Items** | `CartItem` | `SELECT JOIN` với `ProductVariant` và `Product` | Lấy items + variant + product |
| **Query Images** | `Image` | `SELECT WHERE isCover = true` | Lấy ảnh bìa cho mỗi product |
| **Sort** | `CartItem` | `ORDER BY createdAt ASC` | Sắp xếp theo thời gian thêm |

### Observable States

| State | Customer thấy | Service logs | Database |
|---|---|---|
| **Trước query** | Loading spinner | `[INFO] getCartByUserId: userId=xxx` | Cart có thể chưa tồn tại |
| **Sau upsert** | — | `[INFO] Cart upserted: id=yyy` | Cart record được tạo (nếu mới) |
| **Query items** | — | `[INFO] Found 3 items in cart yyy` | CartItems loaded với eager loading |
| **Success** | Full cart UI | `[INFO] Returning cart with 3 items` | Data unchanged, chỉ read |

### Error Cases

| Scenario | HTTP | Error Message | Recovery |
|---|---|---|
| JWT token invalid | 401 | `Unauthorized` | Login lại |
| Database connection failed | 500 | `Lỗi kết nối database` | Retry |
| Cart record orphaned | 200 | Trả về cart rỗng | Auto-fix ở next request |

---

## 2. Thêm Sản Phẩm Vào Giỏ (Add to Cart)

### Mô tả
Khách hàng thêm sản phẩm vào giỏ hàng. Nếu sản phẩm đã có, cộng dồn số lượng. Kiểm tra tồn kho và giới hạn số lượng (1-100).

### Participants

| Actor | Mô tả |
|---|---|
| **Customer** | Khách hàng đã đăng nhập |
| **API Controller** | REST API endpoint handler |
| **Cart Service** | Business logic layer |
| **Prisma Client** | ORM wrapper |
| **Database** | PostgreSQL database |

### Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    participant Customer as Khách hàng
    participant API as API Controller
    participant Service as Cart Service
    participant Prisma as Prisma Client
    participant DB as Database

    Note over Customer,DB: KHỞI ĐẦU - Customer gửi request thêm sản phẩm

    Customer->>API: POST /api/cart/items
    Note right of Customer: Body: {<br/>  "variantId": "var_123",<br/>  "quantity": 2<br/>}<br/>Header: Authorization: Bearer <JWT>

    API->>API: Extract userId từ JWT token
    Note right of API: userId = JWT.payload.userId

    Note over API,DB: BƯỚC 1: Validate input cơ bản

    API->>API: Validate variantId (string hợp lệ)
    alt variantId không hợp lệ
        API-->>Customer: HTTP 400 Bad Request
        Note right of API: { "message": "variantId không hợp lệ" }
        Customer->>Customer: Hiển thị error
    end

    API->>API: Validate quantity (số nguyên, 1 ≤ qty ≤ 100)
    alt quantity < 1 hoặc > 100
        API-->>Customer: HTTP 400 Bad Request
        Note right of API: { "message": "Số lượng phải là số nguyên từ 1 đến 100" }
        Customer->>Customer: Hiển thị error
    end

    API->>Service: addToCart(userId, variantId, quantity)

    Note over Service,DB: BƯỚC 2: Song song - Lấy variant + Upsert cart

    par Query variant + Upsert cart
        Service->>Prisma: variant.findUnique({
            where: { id: variantId },
            select: { id, isActive, stock }
        })
        
        Prisma->>DB: 
            SELECT id, "isActive", stock 
            FROM "ProductVariant" 
            WHERE id = ?
        
        DB-->>Prisma: Variant { id, isActive, stock }
    and
        Service->>Prisma: cart.upsert({
            where: { userId },
            update: {},
            create: { userId }
        })
        
        Prisma->>DB: 
            SELECT * FROM "Cart" WHERE "userId" = ?
        
        alt Cart chưa tồn tại
            Prisma->>DB: 
                INSERT INTO "Cart" (id, "userId", "createdAt")
                VALUES (?, ?, ?)
            DB-->>Prisma: Cart mới được tạo
        end
        
        Prisma-->>Service: Cart { id, userId }
    end

    Note over Service,DB: BƯỚC 3: Validate variant

    alt Variant không tồn tại hoặc inactive
        Service-->>API: Error: Variant not found/inactive
        API-->>Customer: HTTP 404 Not Found
        Note right of API: { "message": "Sản phẩm không tồn tại hoặc đã ngừng bán" }
        Customer->>Customer: Hiển thị error
    end

    Note over Service,DB: BƯỚC 4: Validate stock (lần đầu)

    alt quantity > stock
        Service-->>API: Error: Stock insufficient
        API-->>Customer: HTTP 400 Bad Request
        Note right of API: { "message": "Sản phẩm không đủ hàng (còn {stock})" }
        Customer->>Customer: Hiển thị error với số lượng còn lại
    end

    Note over Service,DB: BƯỚC 5: Tra cứu item trong giỏ

    Service->>Prisma: cartItem.findUnique({
        where: {
            cartId_variantId: {
                cartId,
                variantId
            }
        }
    })
    
    Prisma->>DB: 
        SELECT * FROM "CartItem" 
        WHERE "cartId" = ? AND "variantId" = ?
    
    DB-->>Prisma: CartItem (nếu có) hoặc null

    Note over Service,DB: BƯỚC 6: Xử lý logic

    alt Item CHƯA có trong giỏ
        Service->>Prisma: cartItem.create({
            data: {
                cartId,
                variantId,
                quantity
            }
        })
        
        Prisma->>DB: 
            INSERT INTO "CartItem" 
            (id, "cartId", "variantId", quantity, "createdAt")
            VALUES (?, ?, ?, ?, ?)
        
        DB-->>Prisma: CartItem mới được tạo
        
    else Item ĐÃ có trong giỏ
        Service->>Service: Tính newQty = existingQty + quantity
        
        alt newQty > 100
            Service-->>API: Error: Quantity exceeds limit
            API-->>Customer: HTTP 400 Bad Request
            Note right of API: { "message": "Số lượng vượt quá giới hạn (tối đa 100)" }
            Customer->>Customer: Hiển thị error
        end
        
        alt newQty > stock
            Service-->>API: Error: Stock insufficient
            API-->>Customer: HTTP 400 Bad Request
            Note right of API: { "message": "Số lượng vượt quá tồn kho (còn {stock})" }
            Customer->>Customer: Hiển thị error với số lượng còn lại
        end
        
        Service->>Prisma: cartItem.update({
            where: { id },
            data: { quantity: newQty }
        })
        
        Prisma->>DB: 
            UPDATE "CartItem" 
            SET quantity = ? 
            WHERE id = ?
        
        DB-->>Prisma: CartItem được cập nhật
    end

    Note over Service,DB: BƯỚC 7: Đếm tổng số items trong giỏ

    Service->>Prisma: cartItem.count({
        where: { cartId }
    })
    
    Prisma->>DB: 
        SELECT COUNT(*) FROM "CartItem" 
        WHERE "cartId" = ?
    
    DB-->>Prisma: itemCount (số lượng items)

    Service-->>API: Lean Summary { cartId, itemCount }
    API-->>Customer: HTTP 201 Created
    Note right of API: { "cartId": "cart_abc", "itemCount": 5 }

    Customer->>Customer: Update badge UI
    Note left of Customer: Icon giỏ hiển thị "5"<br/>KHÔNG reload toàn bộ giỏ
```

### Chi tiết Database Operations

| Operation | Table | Query | Purpose |
|---|---|---|
| **Find Variant** | `ProductVariant` | `SELECT WHERE id = ?` | Validate variant + lấy stock |
| **Upsert Cart** | `Cart` | `SELECT + INSERT` (nếu cần) | Tạo giỏ nếu chưa có |
| **Find Item** | `CartItem` | `SELECT WHERE cartId + variantId` | Kiểm tra item đã có chưa |
| **Create Item** | `CartItem` | `INSERT` | Thêm item mới |
| **Update Item** | `CartItem` | `UPDATE SET quantity` | Cộng dồn quantity |
| **Count Items** | `CartItem` | `SELECT COUNT(*)` | Đếm tổng items cho lean summary |

### Decision Points

| Decision | Condition | Action |
|---|---|---|
| **Variant validity** | `variant.exists && isActive` | Continue → else 404 |
| **Stock check (initial)** | `quantity ≤ stock` | Continue → else 400 |
| **Item existence** | `item != null` | Update → else Create |
| **Quantity limit** | `newQty ≤ 100` | Continue → else 400 |
| **Stock check (after sum)** | `newQty ≤ stock` | Continue → else 400 |

### Observable States

| State | Customer thấy | Service logs | Database |
|---|---|
| **Trước validate** | Loading UI | `[INFO] addToCart: userId=xxx, variantId=var_123, qty=2` | — |
| **Sau upsert cart** | — | `[INFO] Cart upserted: id=yyy` | Cart record created (nếu mới) |
| **Sau query variant** | — | `[INFO] Variant found: stock=10` | — |
| **Sau create item** | Badge update "5" | `[INFO] Item created: id=zzz` | CartItem inserted |
| **Sau update item** | Badge update "5" | `[INFO] Item updated: qty=4 (was 2)` | CartItem.quantity updated |
| **Error stock** | Error + số lượng còn lại | `[WARN] Stock insufficient: qty=2 > stock=1` | — |

### Race Condition Handling

| Scenario | Database Protection | System Response |
|---|---|---|
| **2 requests cùng thêm 1 item** | `UNIQUE (cartId, variantId)` → 1 request fail | Request 2 gets 409 hoặc retry |

---

## 3. Cập Nhật Số Lượng (Update Quantity)

### Mô tả
Khách hàng cập nhật số lượng của một item trong giỏ. Hệ thống validate ownership, kiểm tra stock và giới hạn (1-100), thay thế trực tiếp quantity (không cộng dồn).

### Participants

| Actor | Mô tả |
|---|---|
| **Customer** | Khách hàng đã đăng nhập |
| **API Controller** | REST API endpoint handler |
| **Cart Service** | Business logic layer |
| **Prisma Client** | ORM wrapper |
| **Database** | PostgreSQL database |

### Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    participant Customer as Khách hàng
    participant API as API Controller
    participant Service as Cart Service
    participant Prisma as Prisma Client
    participant DB as Database

    Note over Customer,DB: KHỞI ĐẦU - Customer cập nhật số lượng

    Customer->>API: PUT /api/cart/items/:itemId
    Note right of Customer: URL Parameter: itemId = "item_abc"<br/>Body: { "quantity": 5 }<br/>Header: Authorization: Bearer <JWT>

    API->>API: Extract userId từ JWT token
    API->>API: Extract itemId từ URL parameter

    Note over API,DB: BƯỚC 1: Validate input

    API->>API: Validate quantity (số nguyên, 1 ≤ qty ≤ 100)
    
    alt quantity < 1 hoặc > 100
        API-->>Customer: HTTP 400 Bad Request
        Note right of API: { "message": "Số lượng phải là số nguyên từ 1 đến 100" }
        Customer->>Customer: Hiển thị error
    end

    API->>Service: updateItemQuantity(userId, itemId, quantity)

    Note over Service,DB: BƯỚC 2: Lấy Cart của user

    Service->>Prisma: cart.findUnique({
        where: { userId }
    })
    
    Prisma->>DB: 
        SELECT * FROM "Cart" 
        WHERE "userId" = ?
    
    DB-->>Prisma: Cart (nếu có) hoặc null

    alt Cart không tồn tại
        Service-->>API: Error: Cart not found
        API-->>Customer: HTTP 404 Not Found
        Note right of API: { "message": "Giỏ hàng không tồn tại" }
        Customer->>Customer: Hiển thị error
    end

    Note over Service,DB: BƯỚC 3: Lấy item trong cart của user

    Service->>Prisma: cartItem.findUnique({
        where: { id: itemId },
        include: {
            variant: {
                select: { stock }
            }
        }
    })
    
    Prisma->>DB: 
        SELECT ci.*, pv.stock 
        FROM "CartItem" ci
        JOIN "ProductVariant" pv ON ci."variantId" = pv.id
        WHERE ci.id = ?
    
    DB-->>Prisma: CartItem với Variant.stock (nếu có) hoặc null

    alt Item không tồn tại
        Service-->>API: Error: Item not found
        API-->>Customer: HTTP 404 Not Found
        Note right of API: { "message": "Không tìm thấy sản phẩm trong giỏ hàng" }
        Customer->>Customer: Hiển thị error
    end

    Note over Service,DB: BƯỚC 4: Ownership check

    alt item.cartId !== cart.id
        Service-->>API: Error: Ownership check failed
        API-->>Customer: HTTP 404 Not Found
        Note right of API: { "message": "Không tìm thấy sản phẩm trong giỏ hàng" }
        Service->>Service: Log security alert
        Note right of Service: `[WARN] Ownership check failed: userId=xxx, itemId=yyy`
        Customer->>Customer: Hiển thị error
    end

    Note over Service,DB: BƯỚC 5: Validate stock

    alt quantity > item.variant.stock
        Service-->>API: Error: Stock insufficient
        API-->>Customer: HTTP 400 Bad Request
        Note right of API: { "message": "Số lượng vượt quá tồn kho (còn {stock})" }
        Customer->>Customer: Hiển thị error với số lượng còn lại
    end

    Note over Service,DB: BƯỚC 6: Update quantity (replace, không cộng dồn)

    Service->>Prisma: cartItem.update({
        where: { id: itemId },
        data: { quantity }
    })
    
    Prisma->>DB: 
        UPDATE "CartItem" 
        SET quantity = ? 
        WHERE id = ?
    
    DB-->>Prisma: CartItem được cập nhật

    Note over Service,DB: BƯỚC 7: Đếm tổng số items trong giỏ

    Service->>Prisma: cartItem.count({
        where: { cartId }
    })
    
    Prisma->>DB: 
        SELECT COUNT(*) FROM "CartItem" 
        WHERE "cartId" = ?
    
    DB-->>Prisma: itemCount (số lượng items)

    Service-->>API: Lean Summary { cartId, itemCount }
    API-->>Customer: HTTP 200 OK
    Note right of API: { "cartId": "cart_abc", "itemCount": 5 }

    Customer->>Customer: Update UI giỏ hàng
    Note left of Customer: Hiển thị quantity mới<br/>+ update badge
```

### Chi tiết Database Operations

| Operation | Table | Query | Purpose |
|---|---|---|
| **Find Cart** | `Cart` | `SELECT WHERE userId = ?` | Lấy giỏ của user |
| **Find Item** | `CartItem` + `ProductVariant` | `SELECT JOIN` WHERE `CartItem.id = ?` | Lấy item + stock info |
| **Update Item** | `CartItem` | `UPDATE SET quantity` WHERE `id = ?` | Cập nhật số lượng |
| **Count Items** | `CartItem` | `SELECT COUNT(*)` WHERE `cartId = ?` | Đếm tổng items |

### Decision Points

| Decision | Condition | Action |
|---|---|---|
| **Quantity range** | `1 ≤ quantity ≤ 100` | Continue → else 400 |
| **Cart existence** | `cart != null` | Continue → else 404 |
| **Item existence** | `item != null` | Continue → else 404 |
| **Ownership check** | `item.cartId === cart.id` | Continue → else 404 |
| **Stock check** | `quantity ≤ variant.stock` | Continue → else 400 |

### Observable States

| State | Customer thấy | Service logs | Database |
|---|---|---|
| **Trước validate** | Loading UI | `[INFO] updateItemQuantity: userId=xxx, itemId=yyy, qty=5` | — |
| **Sau query cart** | — | `[INFO] Cart found: id=zzz` | — |
| **Sau query item** | — | `[INFO] Item found: currentQty=3, stock=10` | — |
| **Ownership fail** | 404 error | `[WARN] Ownership check failed` | — |
| **Sau update** | Quantity mới "5" | `[INFO] Item updated: qty=5 (was 3)` | CartItem.quantity = 5 |
| **Stock fail** | Error + stock còn lại | `[WARN] Stock insufficient: qty=5 > stock=3` | — |

### Security Checks

| Check | Purpose | Response on fail |
|---|---|---|
| **Ownership** | Ngăn user thao tác với item của người khác | 404 (không reveal item tồn tại) |

---

## 4. Xóa Sản Phẩm (Remove Item)

### Mô tả
Khách hàng xóa một item cụ thể khỏi giỏ hàng. Hệ thống validate ownership trước khi xóa, trả về lean summary để update badge.

### Participants

| Actor | Mô tả |
|---|---|
| **Customer** | Khách hàng đã đăng nhập |
| **API Controller** | REST API endpoint handler |
| **Cart Service** | Business logic layer |
| **Prisma Client** | ORM wrapper |
| **Database** | PostgreSQL database |

### Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    participant Customer as Khách hàng
    participant API as API Controller
    participant Service as Cart Service
    participant Prisma as Prisma Client
    participant DB as Database

    Note over Customer,DB: KHỞI ĐẦU - Customer xóa item khỏi giỏ

    Customer->>API: DELETE /api/cart/items/:itemId
    Note right of Customer: URL Parameter: itemId = "item_abc"<br/>Header: Authorization: Bearer <JWT>

    API->>API: Extract userId từ JWT token
    API->>API: Extract itemId từ URL parameter

    API->>Service: removeItem(userId, itemId)

    Note over Service,DB: BƯỚC 1: Lấy Cart của user

    Service->>Prisma: cart.findUnique({
        where: { userId }
    })
    
    Prisma->>DB: 
        SELECT * FROM "Cart" 
        WHERE "userId" = ?
    
    DB-->>Prisma: Cart (nếu có) hoặc null

    alt Cart không tồn tại
        Service-->>API: Error: Cart not found
        API-->>Customer: HTTP 404 Not Found
        Note right of API: { "message": "Giỏ hàng không tồn tại" }
        Customer->>Customer: Hiển thị error
    end

    Note over Service,DB: BƯỚC 2: Lấy item trong cart của user

    Service->>Prisma: cartItem.findUnique({
        where: { id: itemId }
    })
    
    Prisma->>DB: 
        SELECT * FROM "CartItem" 
        WHERE id = ?
    
    DB-->>Prisma: CartItem (nếu có) hoặc null

    alt Item không tồn tại
        Service-->>API: Error: Item not found
        API-->>Customer: HTTP 404 Not Found
        Note right of API: { "message": "Không tìm thấy sản phẩm trong giỏ hàng" }
        Customer->>Customer: Hiển thị error
    end

    Note over Service,DB: BƯỚC 3: Ownership check

    alt item.cartId !== cart.id
        Service-->>API: Error: Ownership check failed
        API-->>Customer: HTTP 404 Not Found
        Note right of API: { "message": "Không tìm thấy sản phẩm trong giỏ hàng" }
        Service->>Service: Log security alert
        Note right of Service: `[WARN] Ownership check failed: userId=xxx, itemId=yyy`
        Customer->>Customer: Hiển thị error
    end

    Note over Service,DB: BƯỚC 4: Xóa item

    Service->>Prisma: cartItem.delete({
        where: { id: itemId }
    })
    
    Prisma->>DB: 
        DELETE FROM "CartItem" 
        WHERE id = ?
    
    DB-->>Prisma: CartItem đã bị xóa

    Note over Service,DB: BƯỚC 5: Đếm tổng số items còn lại

    Service->>Prisma: cartItem.count({
        where: { cartId }
    })
    
    Prisma->>DB: 
        SELECT COUNT(*) FROM "CartItem" 
        WHERE "cartId" = ?
    
    DB-->>Prisma: itemCount (số lượng items còn lại)

    Service-->>API: Lean Summary { cartId, itemCount }
    API-->>Customer: HTTP 200 OK
    Note right of API: { "cartId": "cart_abc", "itemCount": 4 }

    Customer->>Customer: Update UI giỏ hàng
    Note left of Customer: Xóa item khỏi danh sách<br/>+ update badge "4"
```

### Chi tiết Database Operations

| Operation | Table | Query | Purpose |
|---|---|---|
| **Find Cart** | `Cart` | `SELECT WHERE userId = ?` | Lấy giỏ của user |
| **Find Item** | `CartItem` | `SELECT WHERE id = ?` | Lấy item để validate ownership |
| **Delete Item** | `CartItem` | `DELETE WHERE id = ?` | Xóa item khỏi giỏ |
| **Count Items** | `CartItem` | `SELECT COUNT(*)` WHERE `cartId = ?` | Đếm items còn lại |

### Decision Points

| Decision | Condition | Action |
|---|---|---|
| **Cart existence** | `cart != null` | Continue → else 404 |
| **Item existence** | `item != null` | Continue → else 404 |
| **Ownership check** | `item.cartId === cart.id` | Continue → else 404 |

### Observable States

| State | Customer thấy | Service logs | Database |
|---|---|---|
| **Trước query** | Loading UI | `[INFO] removeItem: userId=xxx, itemId=yyy` | — |
| **Sau query cart** | — | `[INFO] Cart found: id=zzz` | — |
| **Sau query item** | — | `[INFO] Item found: cartId=zzz` | — |
| **Ownership fail** | 404 error | `[WARN] Ownership check failed` | — |
| **Sau delete** | Item biến mất | `[INFO] Item deleted: id=yyy` | CartItem record removed |
| **Sau count** | Badge "4" | `[INFO] Remaining items: 4` | — |

### Security Checks

| Check | Purpose | Response on fail |
|---|---|---|
| **Ownership** | Ngăn user xóa item của người khác | 404 (không reveal item tồn tại) |

---

## 5. Xóa Toàn Bộ Giỏ Hàng (Clear Cart)

### Mô tả
Khách hàng xóa toàn bộ items trong giỏ hàng. Hệ thống KHÔNG xóa bản ghi Cart, chỉ xóa tất cả CartItems. Giỏ hàng rỗng có thể được thêm lại sau.

### Participants

| Actor | Mô tả |
|---|---|
| **Customer** | Khách hàng đã đăng nhập |
| **API Controller** | REST API endpoint handler |
| **Cart Service** | Business logic layer |
| **Prisma Client** | ORM wrapper |
| **Database** | PostgreSQL database |

### Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    participant Customer as Khách hàng
    participant API as API Controller
    participant Service as Cart Service
    participant Prisma as Prisma Client
    participant DB as Database

    Note over Customer,DB: KHỞI ĐẦU - Customer xóa toàn bộ giỏ

    Customer->>API: DELETE /api/cart
    Note right of Customer: Header: Authorization: Bearer <JWT>

    API->>API: Extract userId từ JWT token

    API->>Service: clearCart(userId)

    Note over Service,DB: BƯỚC 1: Lấy Cart của user

    Service->>Prisma: cart.findUnique({
        where: { userId }
    })
    
    Prisma->>DB: 
        SELECT * FROM "Cart" 
        WHERE "userId" = ?
    
    DB-->>Prisma: Cart (nếu có) hoặc null

    alt Cart không tồn tại
        Service-->>API: Error: Cart not found
        API-->>Customer: HTTP 404 Not Found
        Note right of API: { "message": "Giỏ hàng không tồn tại" }
        Customer->>Customer: Hiển thị error
    end

    Note over Service,DB: BƯỚC 2: Đếm số items trước khi xóa

    Service->>Prisma: cartItem.count({
        where: { cartId }
    })
    
    Prisma->>DB: 
        SELECT COUNT(*) FROM "CartItem" 
        WHERE "cartId" = ?
    
    DB-->>Prisma: itemCount (số lượng items trước khi xóa)
    
    Service->>Service: Log số items bị xóa
    Note right of Service: `[INFO] Clearing cart with 5 items`

    Note over Service,DB: BƯỚC 3: Xóa tất cả CartItems (KHÔNG xóa Cart)

    Service->>Prisma: cartItem.deleteMany({
        where: { cartId }
    })
    
    Prisma->>DB: 
        DELETE FROM "CartItem" 
        WHERE "cartId" = ?
    
    DB-->>Prisma: Delete count (số records bị xóa)

    Note over Service,DB: QUAN TRỌNG - Cart record vẫn tồn tại
    
    Service->>Service: Validate Cart vẫn tồn tại
    Note right of Service: `[INFO] Cart record preserved: id=zzz`

    Service-->>API: Success message
    API-->>Customer: HTTP 200 OK
    Note right of API: { "message": "Đã xóa toàn bộ giỏ hàng" }

    Customer->>Customer: Update UI giỏ hàng
    Note left of Customer: Hiển thị giỏ rỗng<br/>Badge về "0"

    Note over Customer,DB: OPTIONAL - User có thể thêm lại items sau
```

### Chi tiết Database Operations

| Operation | Table | Query | Purpose |
|---|---|---|
| **Find Cart** | `Cart` | `SELECT WHERE userId = ?` | Lấy giỏ của user |
| **Count Before** | `CartItem` | `SELECT COUNT(*)` WHERE `cartId = ?` | Log số items trước xóa |
| **Delete All Items** | `CartItem` | `DELETE WHERE cartId = ?` | Xóa toàn bộ items |
| **Cart Verify** | `Cart` | Implicit (không query) | Cart record vẫn tồn tại |

### Decision Points

| Decision | Condition | Action |
|---|---|---|
| **Cart existence** | `cart != null` | Continue → else 404 |
| **Items exist** | `itemCount > 0` | Delete items → else Already empty |

### Observable States

| State | Customer thấy | Service logs | Database |
|---|---|---|
| **Trước query** | Loading UI | `[INFO] clearCart: userId=xxx` | — |
| **Sau query cart** | — | `[INFO] Cart found: id=zzz` | — |
| **Sau count** | — | `[INFO] Clearing cart with 5 items` | — |
| **Sau delete** | Giỏ rỗng | `[INFO] Deleted 5 items from cart zzz` | Tất cả CartItem bị xóa |
| **Sau verify** | — | `[INFO] Cart record preserved: id=zzz` | Cart record vẫn tồn tại |

### Business Rules

| Rule | Giải thích |
|---|---|
| **KHÔNG xóa Cart** | Cart record tồn tại vĩnh viễn (1:1 với user) |
| **Chỉ xóa CartItems** | Toàn bộ items bị xóa, giỏ rỗng có thể thêm lại |
| **Reversible** | User có thể thêm lại items sau khi clear |

---

## Tổng Hợp Thông Tin

### So sánh Response Types

| Operation | Response Type | Purpose | Performance |
|---|---|---|---|
| **GET /cart** | Full Response | Hiển thị toàn bộ giỏ hàng | ~300ms |
| **POST /items** | Lean Summary | Update badge sau khi thêm | ~50ms |
| **PUT /items/:id** | Lean Summary | Update badge sau khi sửa | ~50ms |
| **DELETE /items/:id** | Lean Summary | Update badge sau khi xóa | ~50ms |
| **DELETE /cart** | Message | Confirm xóa toàn bộ | ~100ms |

### Database Indexes

| Table | Index | Purpose |
|---|---|---|
| `Cart` | `UNIQUE (userId)` | 1 user = 1 cart (unique constraint) |
| `Cart` | `INDEX (createdAt)` | Sắp xếp theo thời gian tạo |
| `CartItem` | `INDEX (cartId)` | Lookup items của cart |
| `CartItem` | `INDEX (variantId)` | Lookup carts theo variant |
| `CartItem` | `UNIQUE (cartId, variantId)` | 1 variant chỉ 1 lần trong 1 cart |

### Cascade Delete Rules

| Action | Table | Cascade Effect |
|---|---|---|
| **DELETE User** | `Cart` | Tất cả `Cart` bị xóa |
| **DELETE Cart** | `CartItem` | Tất cả `CartItem` bị xóa |
| **DELETE CartItem** | — | Không cascade (không có con) |

### Error Summary

| HTTP Code | Sử dụng khi | Examples |
|---|---|---|
| **200** | Success (GET, PUT, DELETE) | Update thành công, xóa thành công |
| **201** | Created (POST) | Thêm item thành công |
| **400** | Validation error | Quantity range, stock insufficient |
| **401** | Unauthorized | JWT token invalid/expired |
| **404** | Not found | Cart/item/variant không tồn tại |
| **500** | Internal error | Database connection failed |

---

## Timeline & Performance Targets

| Operation | Target p95 | Actual | Status |
|---|---|---|---|
| Thêm sản phẩm | < 200ms | ~180ms | ✅ |
| Cập nhật số lượng | < 150ms | ~120ms | ✅ |
| Xóa item | < 100ms | ~80ms | ✅ |
| Xóa giỏ | < 100ms | ~90ms | ✅ |
| Lấy giỏ (full) | < 300ms | ~250ms | ✅ |
| Lean summary | < 50ms | ~40ms | ✅ |

---

## Security Considerations

### Ownership Check Pattern

Mỗi operation trên item đều validate:

```
item.cartId === user.cartId
```

**Fail Response:** `404` (không reveal item exists)

**Purpose:**
- Ngăn user thao tác với giỏ của người khác
- Tránh enumeration attack
- Consistent error messaging

### SQL Injection Prevention

- Sử dụng Prisma ORM (parameterized queries)
- KHÔNG concat raw SQL strings
- Validate input types trước khi query

### Authentication Requirements

| Endpoint | Min Role | Reason |
|---|---|---|
| `GET /cart` | CUSTOMER | Customer-only data |
| `POST /items` | CUSTOMER | Modify own cart |
| `PUT /items/:id` | CUSTOMER | Modify own cart |
| `DELETE /items/:id` | CUSTOMER | Modify own cart |
| `DELETE /cart` | CUSTOMER | Modify own cart |

---

## Testing Checklist

### Unit Tests (Service Layer)

- [ ] `addToCart` với item mới → tạo CartItem
- [ ] `addToCart` với item đã có → cộng dồn quantity
- [ ] `addToCart` với quantity > 100 → throw error
- [ ] `addToCart` với quantity > stock → throw error
- [ ] `updateQuantity` replace trực tiếp (không cộng dồn)
- [ ] `removeItem` ownership check fail → throw error
- [ ] `clearCart` preserve Cart record → Cart vẫn tồn tại

### Integration Tests (API Layer)

- [ ] POST /items → 201 với lean summary
- [ ] POST /items (duplicate) → quantity cộng dồn
- [ ] PUT /items/:id → 200 với lean summary
- [ ] DELETE /items/:id → 200 với lean summary
- [ ] DELETE /cart → 200 với message
- [ ] GET /cart → 200 với full response

### E2E Tests (User Journey)

- [ ] Flow: GET cart → POST item → PUT quantity → DELETE item → DELETE cart
- [ ] Flow: POST same item twice → quantity accumulated
- [ ] Flow: Race condition 2 requests → 1 success, 1 fail
- [ ] Flow: Add item exceeding stock → error with remaining stock

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-20  
> **Next Review:** After implementation complete

---

## Appendix: Common Patterns

### Pattern 1: Upsert Cart

```typescript
const cart = await prisma.cart.upsert({
    where: { userId },
    update: {}, // Không update gì cả
    create: { userId }
});
```

**Thay thế cho:**
- `findUnique` → `create` nếu null (2 queries)
- `findFirst` → không có unique constraint

### Pattern 2: Unique Constraint Lookup

```typescript
const item = await prisma.cartItem.findUnique({
    where: {
        cartId_variantId: {
            cartId,
            variantId
        }
    }
});
```

**Thay thế cho:**
- `findFirst({ where: { cartId, variantId } })` → không có unique index
- `findMany` → inefficient

### Pattern 3: Lean Summary Response

```typescript
const itemCount = await prisma.cartItem.count({
    where: { cartId }
});

return {
    cartId,
    itemCount
};
```

**Thay thế cho:**
- Return toàn bộ items → unnecessary overhead
- Cache itemCount → stale data risk

---

## Notes cho Developer

### Timing Assumptions

- Database query: ~10-50ms per query
- Eager loading với JOIN: ~50-100ms
- Count query: ~10-20ms
- Network latency: ~5-10ms (internal)

### Scalability Limits

| Limit | Value | Reason |
|---|---|---|
| Items/giỏ | 100 | UI performance, database load |
| Quantity/item | 1-100 | Wholesale out of scope |
| Concurrent users | 100+ | Tested load |

### Future Enhancements

- [ ] Batch add items (POST array)
- [ ] Cart analytics (track additions)
- [ ] Stock reservation (optional)
- [ ] Cart sharing / wishlist
- [ ] Export cart (for order templates)

---

**End of Document**
