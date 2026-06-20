# Entity Relationship Diagram - Payment Module

## 1. Mermaid ERD Diagram

```mermaid
erDiagram
    USERS ||--o{ ORDERS : "đặt"
    ORDERS ||--o{ ORDER_ITEMS : "chứa"
    PRODUCTS ||--o{ PRODUCT_VARIANTS : "có"
    PRODUCT_VARIANTS ||--o{ ORDER_ITEMS : "được đặt"
    PRODUCT_VARIANTS ||--o{ CART_ITEMS : "trong giỏ"
    CART ||--o{ CART_ITEMS : "chứa"
    USERS ||--|| CART : "sở hữu"
    CATEGORIES ||--o{ PRODUCTS : "thuộc"
    BRANDS ||--o{ PRODUCTS : "thuộc"

    USERS {
        uuid id PK
        string email UK
        string phone UK
        string password_hash
        string full_name
        string avatar_url
        string avatar_public_id
        user_role role
        boolean is_active
        boolean email_verified
        timestamp created_at
        timestamp updated_at
    }

    ORDERS {
        uuid id PK
        string order_code UK
        uuid userId FK
        string shipping_name
        string shipping_phone
        string shipping_province
        string shipping_district
        string shipping_ward
        string shipping_detail
        decimal subtotal
        decimal shipping_fee
        decimal discount
        decimal total
        order_status status
        payment_method payment_method
        payment_status payment_status
        string note
        string cancel_reason
        timestamp paid_at
        timestamp created_at
        timestamp updated_at
    }

    ORDER_ITEMS {
        uuid id PK
        uuid orderId FK
        uuid variantId FK
        string product_name
        string sku
        string color
        string storage
        string ram
        decimal unit_price
        integer quantity
        decimal subtotal
    }

    PRODUCTS {
        uuid id PK
        string name
        string slug UK
        string description
        uuid categoryId FK
        uuid brandId FK
        boolean is_active
        boolean is_featured
        timestamp created_at
        timestamp updated_at
    }

    PRODUCT_VARIANTS {
        uuid id PK
        uuid productId FK
        string sku UK
        string color
        string storage
        string ram
        string image_url
        decimal original_price
        decimal sale_price
        integer stock
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    CATEGORIES {
        uuid id PK
        string name
        string slug UK
        string description
        string image_url
        uuid parentId FK
        integer sort_order
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    BRANDS {
        uuid id PK
        string name UK
        string slug UK
        string logo_url
        string description
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    CART {
        uuid id PK
        uuid userId FK UK
        timestamp created_at
        timestamp updated_at
    }

    CART_ITEMS {
        uuid id PK
        uuid cartId FK
        uuid variantId FK
        integer quantity
        timestamp created_at
        timestamp updated_at
    }
```

## 2. Detailed Table Schema

### 2.1 Orders Table (Bảng Đơn Hàng)

Bảng chính chứa thông tin thanh toán của đơn hàng.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | uuid_generate() | Primary Key |
| `order_code` | VARCHAR(255) | NO | - | Mã đơn hàng unique (format: ORD-YYYYMMDD-XXXXXX) |
| `userId` | UUID | NO | FK | Foreign Key đến USERS.id |
| `shipping_name` | VARCHAR(255) | NO | - | Tên người nhận (snapshot) |
| `shipping_phone` | VARCHAR(20) | NO | - | SĐT người nhận (snapshot) |
| `shipping_province` | VARCHAR(100) | NO | - | Tỉnh/Thành phố (snapshot) |
| `shipping_district` | VARCHAR(100) | NO | - | Quận/Huyện (snapshot) |
| `shipping_ward` | VARCHAR(100) | NO | - | Phường/Xã (snapshot) |
| `shipping_detail` | TEXT | NO | - | Địa chỉ chi tiết (snapshot) |
| `subtotal` | DECIMAL(12,2) | NO | - | Tổng tiền hàng |
| `shipping_fee` | DECIMAL(12,2) | NO | 0 | Phí vận chuyển |
| `discount` | DECIMAL(12,2) | NO | 0 | Giảm giá |
| `total` | DECIMAL(12,2) | NO | - | **Tổng thanh toán** (subtotal + shipping_fee - discount) |
| `status` | OrderStatus | NO | PENDING | Trạng thái đơn hàng (PENDING, CONFIRMED, SHIPPING, DELIVERED, CANCELLED) |
| `paymentMethod` | PaymentMethod | NO | COD | **Phương thức thanh toán** (COD, BANK_TRANSFER) |
| `paymentStatus` | PaymentStatus | NO | UNPAID | **Trạng thái thanh toán** (UNPAID, PAID, REFUNDED) |
| `note` | TEXT | YES | NULL | Ghi chú khách hàng |
| `cancelReason` | TEXT | YES | NULL | Lý do hủy đơn |
| `paidAt` | TIMESTAMPTZ | YES | NULL | **Thời gian thanh toán thành công** |
| `createdAt` | TIMESTAMPTZ | NO | NOW() | Thời gian tạo đơn |
| `updatedAt` | TIMESTAMPTZ | NO | NOW() | Thời gian cập nhật |

**Indexes:**
- `idx_orders_userId` - Index cho userId (tìm đơn theo user)
- `idx_orders_status` - Index cho status (lọc theo trạng thái đơn hàng)
- `idx_orders_paymentStatus` - Index cho paymentStatus (**quan trọng cho thống kê**)
- `idx_orders_paymentMethod` - Index cho paymentMethod (lọc theo phương thức thanh toán)
- `idx_orders_createdAt` - Index cho createdAt (sắp xếp theo thời gian)
- `idx_orders_orderCode` - Unique index cho orderCode (webhook processing)

**Constraints:**
- `order_code` UNIQUE - Không trùng mã đơn hàng
- `userId` FK → USERS(id) ON DELETE CASCADE
- `paymentMethod` ∈ {COD, BANK_TRANSFER}
- `paymentStatus` ∈ {UNPAID, PAID, REFUNDED}

### 2.2 Users Table (Bảng Người Dùng)

Bảng chứa thông tin khách hàng để validate ownership.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | uuid_generate() | Primary Key |
| `email` | VARCHAR(255) | NO | - | Email đăng ký (unique) |
| `phone` | VARCHAR(20) | YES | NULL | SĐT (unique) |
| `passwordHash` | VARCHAR(255) | YES | NULL | Hash mật khẩu |
| `fullName` | VARCHAR(255) | NO | - | Họ tên |
| `avatarUrl` | VARCHAR(500) | YES | NULL | URL ảnh avatar |
| `avatarPublicId` | VARCHAR(255) | YES | NULL | Public ID Cloudinary |
| `role` | UserRole | NO | CUSTOMER | Vai trò (CUSTOMER, ADMIN, STAFF) |
| `isActive` | BOOLEAN | NO | true | Trạng thái hoạt động |
| `emailVerified` | BOOLEAN | NO | false | Email đã xác thực |
| `createdAt` | TIMESTAMPTZ | NO | NOW() | Thời gian tạo |
| `updatedAt` | TIMESTAMPTZ | NO | NOW() | Thời gian cập nhật |

**Indexes:**
- `idx_users_role` - Index cho role (tìm user theo vai trò)
- `idx_users_isActive` - Index cho isActive (lọc user active)
- `idx_users_createdAt` - Index cho createdAt (sắp xếp theo thời gian)

### 2.3 Order_Items Table (Bảng Chi Tiết Đơn Hàng)

Bảng chứa thông tin sản phẩm trong đơn hàng (snapshot data).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | uuid_generate() | Primary Key |
| `orderId` | UUID | NO | FK | Foreign Key đến ORDERS.id |
| `variantId` | UUID | YES | FK | Foreign Key đến PRODUCT_VARIANTS.id (nullable vì variant có thể bị xóa) |
| `product_name` | VARCHAR(255) | NO | - | Tên sản phẩm (snapshot) |
| `sku` | VARCHAR(100) | NO | - | SKU của variant (snapshot) |
| `color` | VARCHAR(50) | YES | NULL | Màu sắc (snapshot) |
| `storage` | VARCHAR(50) | YES | NULL | Bộ nhớ (snapshot) |
| `ram` | VARCHAR(50) | YES | NULL | RAM (snapshot) |
| `unit_price` | DECIMAL(12,2) | NO | - | Đơn giá tại thời điểm đặt (snapshot) |
| `quantity` | INTEGER | NO | - | Số lượng |
| `subtotal` | DECIMAL(12,2) | NO | - | Thành tiền (unit_price × quantity) |

**Indexes:**
- `idx_orderItems_orderId` - Index cho orderId (tìm items theo đơn hàng)

**Constraints:**
- `orderId` FK → ORDERS(id) ON DELETE CASCADE
- `variantId` FK → PRODUCT_VARIANTS(id) ON DELETE SET NULL

### 2.4 Product_Variants Table (Bảng Biến Thể Sản Phẩm)

Bảng chứa thông tin biến thể sản phẩm (được tham chiếu từ Order_Item).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | uuid_generate() | Primary Key |
| `productId` | UUID | NO | FK | Foreign Key đến PRODUCTS.id |
| `sku` | VARCHAR(100) | NO | - | Mã SKU (unique) |
| `color` | VARCHAR(50) | YES | NULL | Màu sắc |
| `storage` | VARCHAR(50) | YES | NULL | Bộ nhớ |
| `ram` | VARCHAR(50) | YES | NULL | RAM |
| `imageUrl` | VARCHAR(500) | YES | NULL | URL ảnh variant |
| `originalPrice` | DECIMAL(12,2) | NO | - | Giá gốc |
| `salePrice` | DECIMAL(12,2) | NO | - | Giá bán |
| `stock` | INTEGER | NO | 0 | Số lượng tồn kho |
| `isActive` | BOOLEAN | NO | true | Trạng thái hoạt động |
| `createdAt` | TIMESTAMPTZ | NO | NOW() | Thời gian tạo |
| `updatedAt` | TIMESTAMPTZ | NO | NOW() | Thời gian cập nhật |

**Indexes:**
- `idx_variants_productId` - Index cho productId (tìm variants theo sản phẩm)
- `idx_variants_stock` - Index cho stock (lọc hàng còn tồn kho)
- `idx_variants_isActive` - Index cho isActive (lọc variant active)
- `idx_variants_isActive_salePrice` - Composite index (active + price cho sắp xếp giá)

### 2.5 Cart & Cart_Items Tables

**Cart Table:**
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | uuid_generate() | Primary Key |
| `userId` | UUID | NO | FK UK | Foreign Key đến USERS.id (unique) |
| `createdAt` | TIMESTAMPTZ | NO | NOW() | Thời gian tạo |
| `updatedAt` | TIMESTAMPTZ | NO | NOW() | Thời gian cập nhật |

**Cart_Items Table:**
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | uuid_generate() | Primary Key |
| `cartId` | UUID | NO | FK | Foreign Key đến CART.id |
| `variantId` | UUID | NO | FK | Foreign Key đến PRODUCT_VARIANTS.id |
| `quantity` | INTEGER | NO | 1 | Số lượng |
| `createdAt` | TIMESTAMPTZ | NO | NOW() | Thời gian tạo |
| `updatedAt` | TIMESTAMPTZ | NO | NOW() | Thời gian cập nhật |

**Constraints:**
- UNIQUE (cartId, variantId) - Mỗi variant chỉ xuất hiện 1 lần trong giỏ
- `cartId` FK → CART(id) ON DELETE CASCADE
- `variantId` FK → PRODUCT_VARIANTS(id) ON DELETE CASCADE

## 3. Relationship Explanations

### 3.1 User ↔ Order Relationship (1:N)

**Mô tả:** Một user có thể có nhiều đơn hàng, mỗi đơn hàng thuộc về một user.

**Quy tắc:**
- 1 User → N Orders (Một người dùng có thể đặt nhiều đơn hàng)
- 1 Order → 1 User (Mỗi đơn hàng chỉ thuộc về một người dùng)

**Foreign Key:**
```sql
ALTER TABLE orders
ADD CONSTRAINT fk_orders_user
FOREIGN KEY (userId)
REFERENCES users(id)
ON DELETE CASCADE;
```

**Behavior:**
- `ON DELETE CASCADE`: Khi user bị xóa, tất cả orders của user đó cũng bị xóa
- **Use case:** Xóa tài khoản khách hàng → xóa toàn bộ lịch sử đơn hàng

### 3.2 Order ↔ OrderItem Relationship (1:N)

**Mô tả:** Một đơn hàng có nhiều items, mỗi item thuộc về một đơn hàng.

**Quy tắc:**
- 1 Order → N OrderItems (Một đơn hàng có nhiều sản phẩm)
- 1 OrderItem → 1 Order (Mỗi item chỉ thuộc về một đơn hàng)

**Foreign Key:**
```sql
ALTER TABLE order_items
ADD CONSTRAINT fk_orderItems_order
FOREIGN KEY (orderId)
REFERENCES orders(id)
ON DELETE CASCADE;
```

**Behavior:**
- `ON DELETE CASCADE`: Khi đơn hàng bị xóa, tất cả items cũng bị xóa
- **Use case:** Hủy đơn hàng → xóa toàn bộ chi tiết đơn hàng

### 3.3 OrderItem ↔ ProductVariant Relationship (N:1)

**Mô tả:** Nhiều order items có thể tham chiếu đến cùng một product variant.

**Quy tắc:**
- N OrderItems → 1 ProductVariant (Nhiều đơn hàng có thể mua cùng một variant)
- 1 ProductVariant → N OrderItems (Một variant được mua trong nhiều đơn hàng)

**Foreign Key:**
```sql
ALTER TABLE order_items
ADD CONSTRAINT fk_orderItems_variant
FOREIGN KEY (variantId)
REFERENCES product_variants(id)
ON DELETE SET NULL;
```

**Behavior:**
- `ON DELETE SET NULL`: Khi variant bị xóa, variantId trong order_items được set thành NULL
- **Use case:** Xóa variant không làm mất dữ liệu lịch sử đơn hàng (snapshot data vẫn còn)
- **Snapshot Data:** Các trường product_name, sku, color, storage, ram, unit_price được lưu vào order_items để bảo toàn thông tin ngay cả khi variant bị xóa hoặc thay đổi

### 3.4 Payment Field Transitions

**Payment Status Lifecycle:**

```
UNPAID ──[Webhook/Admin]──> PAID ──[Admin/Refund]──> REFUNDED
   │                                                │
   └────────────────[Admin Cancel]─────────────────┘
```

**Payment Methods:**
- `COD`: Thanh toán khi nhận hàng (mặc định)
- `BANK_TRANSFER`: Chuyển khoản qua ngân hàng (QR code, SePay webhook)

**Transition Rules:**
1. **UNPAID → PAID**:
   - COD: Admin xác nhận đã nhận tiền
   - BANK_TRANSFER: Webhook từ SePay tự động xác nhận
   - Điều kiện: `transferAmount === order.total` và `orderCode === content`

2. **PAID → REFUNDED**:
   - Admin thực hiện hoàn tiền
   - Cập nhật `paymentStatus = REFUNDED`
   - Có thể lưu `refundReason`, `refundedAt` (nếu có mở rộng)

3. **UNPAID → CANCELLED**:
   - Admin hủy đơn hàng chưa thanh toán
   - Cập nhật `status = CANCELLED` và `cancelReason`

**paidAt Field:**
- Chỉ được set khi `paymentStatus = PAID`
- Giá trị là timestamp từ webhook SePay (`transactionDate`)
- Dùng để tính thời gian thanh toán thực tế

## 4. Query Patterns

### 4.1 Find Order for Payment Info (Truy vấn thông tin thanh toán)

**Use case:** Lấy thông tin thanh toán để hiển thị QR code và thông tin chuyển khoản.

**Query:**
```sql
SELECT 
    id,
    order_code,
    total,
    payment_method,
    payment_status
FROM orders
WHERE id = $1 AND userId = $2;
```

**Prisma Query:**
```typescript
const order = await prisma.order.findFirst({
  where: { 
    id: orderId, 
    userId 
  },
  select: { 
    id: true, 
    orderCode: true, 
    total: true, 
    paymentMethod: true, 
    paymentStatus: true 
  },
})
```

**Index sử dụng:** `idx_orders_userId`

**Validation:**
- Order phải tồn tại
- `paymentMethod === BANK_TRANSFER`
- `paymentStatus !== PAID`

### 4.2 Find Order by OrderCode (Webhook Processing)

**Use case:** Webhook SePay tìm đơn hàng dựa trên mã đơn hàng trong nội dung chuyển khoản.

**Query:**
```sql
SELECT 
    id,
    total,
    payment_status,
    status
FROM orders
WHERE order_code = $1;
```

**Prisma Query:**
```typescript
const order = await prisma.order.findUnique({
  where: { orderCode },
  select: { 
    id: true, 
    total: true, 
    paymentStatus: true, 
    status: true 
  },
})
```

**Index sử dụng:** `idx_orders_orderCode` (unique index)

**Logic:**
1. Extract `orderCode` từ `payload.content` bằng regex: `/ORD-\d{8}-[0-9A-F]{6}/i`
2. Convert to uppercase: `orderCode = match[0].toUpperCase()`
3. Validate: `transferAmount === order.total` và `paymentStatus !== PAID`
4. Update: `paymentStatus = PAID`, `paidAt = transactionDate`

### 4.3 Aggregation Queries for Statistics (Truy vấn thống kê)

**Use case:** Dashboard admin hiển thị tổng quan thanh toán.

**Query 1: Revenue (Tổng doanh thu đã thu)**
```sql
SELECT 
    COALESCE(SUM(total), 0) as revenue
FROM orders
WHERE payment_status = 'PAID';
```

**Prisma Query:**
```typescript
const paidAgg = await prisma.order.aggregate({
  where: { paymentStatus: PaymentStatus.PAID },
  _sum: { total: true },
  _count: true,
})
```

**Index sử dụng:** `idx_orders_paymentStatus`

---

**Query 2: Pending Orders (Đơn hàng chưa thanh toán)**
```sql
SELECT 
    COUNT(*) as count,
    COALESCE(SUM(total), 0) as amount
FROM orders
WHERE payment_status = 'UNPAID';
```

**Prisma Query:**
```typescript
const unpaidAgg = await prisma.order.aggregate({
  where: { paymentStatus: PaymentStatus.UNPAID },
  _sum: { total: true },
  _count: true,
})
```

---

**Query 3: Refunded Orders (Đơn hàng đã hoàn tiền)**
```sql
SELECT 
    COUNT(*) as count,
    COALESCE(SUM(total), 0) as amount
FROM orders
WHERE payment_status = 'REFUNDED';
```

**Prisma Query:**
```typescript
const refundedAgg = await prisma.order.aggregate({
  where: { paymentStatus: PaymentStatus.REFUNDED },
  _sum: { total: true },
  _count: true,
})
```

---

**Query 4: Awaiting Bank Transfer (Chờ đối soát chuyển khoản)**
```sql
SELECT 
    COUNT(*) as count,
    COALESCE(SUM(total), 0) as amount
FROM orders
WHERE payment_status = 'UNPAID' 
  AND payment_method = 'BANK_TRANSFER';
```

**Prisma Query:**
```typescript
const awaitingAgg = await prisma.order.aggregate({
  where: {
    paymentStatus: PaymentStatus.UNPAID,
    paymentMethod: PaymentMethod.BANK_TRANSFER
  },
  _sum: { total: true },
  _count: true,
})
```

**Index sử dụng:** Composite index on `paymentStatus + paymentMethod` (nếu có thêm)

---

**Query 5: Group by PaymentMethod (Thống kê theo phương thức thanh toán)**
```sql
SELECT 
    payment_method,
    payment_status,
    COUNT(*) as count,
    COALESCE(SUM(total), 0) as total_amount
FROM orders
GROUP BY payment_method, payment_status
ORDER BY payment_method, payment_status;
```

**Prisma Query:**
```typescript
const statsByMethod = await prisma.order.groupBy({
  by: ['paymentMethod', 'paymentStatus'],
  _count: true,
  _sum: { total: true },
})
```

---

**Query 6: Daily Revenue Trend (Xu hướng doanh thu theo ngày)**
```sql
SELECT 
    DATE(paid_at) as date,
    COUNT(*) as orders_count,
    COALESCE(SUM(total), 0) as revenue
FROM orders
WHERE payment_status = 'PAID'
  AND paid_at IS NOT NULL
  AND paid_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(paid_at)
ORDER BY date DESC;
```

**Prisma Query:**
```typescript
const dailyRevenue = await prisma.$queryRaw`
  SELECT 
    DATE(paid_at) as date,
    COUNT(*) as orders_count,
    COALESCE(SUM(total), 0) as revenue
  FROM orders
  WHERE payment_status = 'PAID'
    AND paid_at IS NOT NULL
    AND paid_at >= NOW() - INTERVAL '30 days'
  GROUP BY DATE(paid_at)
  ORDER BY date DESC
`
```

**Index sử dụng:** `idx_orders_paymentStatus`, `idx_orders_createdAt` (hoặc index riêng cho `paidAt`)

### 4.4 Ownership Validation Queries (Truy vấn xác thực quyền sở hữu)

**Use case:** Kiểm tra xem user có quyền xem đơn hàng không trước khi hiển thị thông tin thanh toán.

**Query 1: Validate Order Ownership**
```sql
SELECT 
    userId,
    payment_status,
    payment_method
FROM orders
WHERE id = $1;
```

**Validation Logic:**
```typescript
const order = await prisma.order.findUnique({
  where: { id: orderId },
  select: { userId: true, paymentStatus: true, paymentMethod: true }
})

if (!order) throw new Error('Order not found')
if (order.userId !== currentUserId) throw new Error('Access denied')
```

**Query 2: Check if User Can View Payment Info**
```typescript
// User chỉ được xem payment info nếu:
// - Order thuộc về user HOẶC user là admin
const canView = order.userId === userId || userRole === 'ADMIN'
```

## 5. Optimization Notes

### 5.1 Index Strategy (Chiến lược Index)

**Indexes hiện có trong schema:**
```prisma
model Order {
  @@index([userId])              // idx_orders_userId
  @@index([status])              // idx_orders_status
  @@index([paymentStatus])       // idx_orders_paymentStatus
  @@index([paymentMethod])       // idx_orders_paymentMethod
  @@index([createdAt])           // idx_orders_createdAt
  @@unique([orderCode])          // idx_orders_orderCode (unique)
}
```

**Các indexes cần thêm để tối ưu:**

1. **Composite Index cho Webhook Processing:**
```sql
CREATE INDEX idx_orders_paymentStatus_method 
ON orders(payment_status, payment_method);
```
**Use case:** Tìm các đơn UNPAID + BANK_TRANSFER để đối soát webhook

2. **Composite Index cho Admin Dashboard:**
```sql
CREATE INDEX idx_orders_paymentStatus_created 
ON orders(payment_status, created_at DESC);
```
**Use case:** Lấy danh sách đơn hàng mới theo trạng thái thanh toán

3. **Index cho paidAt (nếu có query filter theo ngày thanh toán):**
```sql
CREATE INDEX idx_orders_paidAt 
ON orders(paid_at DESC) 
WHERE payment_status = 'PAID';
```
**Use case:** Thống kê doanh thu theo thời gian thanh toán thực tế

4. **Composite Index cho User Orders:**
```sql
CREATE INDEX idx_orders_user_created 
ON orders(userId, created_at DESC);
```
**Use case:** Lấy lịch sử đơn hàng của user theo thời gian

### 5.2 Query Optimization (Tối ưu hóa Query)

**Bad Query (N+1 Problem):**
```typescript
// ❌ BAD: N+1 query - lấy orders rồi query payment info từng đơn
const orders = await prisma.order.findMany({ where: { userId } })
for (const order of orders) {
  const paymentInfo = await prisma.order.findUnique({
    where: { id: order.id },
    select: { paymentStatus: true, paymentMethod: true, paidAt: true }
  })
  // Do something with paymentInfo
}
```

**Good Query (Single Query with Select):**
```typescript
// ✅ GOOD: Single query - lấy tất cả data cần thiết
const orders = await prisma.order.findMany({
  where: { userId },
  select: {
    id: true,
    orderCode: true,
    total: true,
    status: true,
    paymentStatus: true,
    paymentMethod: true,
    paidAt: true,
    createdAt: true,
    items: {
      select: {
        productName: true,
        quantity: true,
        unitPrice: true,
      }
    }
  },
  orderBy: { createdAt: 'desc' }
})
```

**Good Query (Aggregation for Stats):**
```typescript
// ✅ GOOD: Single query lấy tất cả thống kê
const [paidAgg, unpaidAgg, refundedAgg, awaitingAgg] = await Promise.all([
  prisma.order.aggregate({ 
    where: { paymentStatus: PaymentStatus.PAID }, 
    _sum: { total: true }, 
    _count: true 
  }),
  prisma.order.aggregate({ 
    where: { paymentStatus: PaymentStatus.UNPAID }, 
    _sum: { total: true }, 
    _count: true 
  }),
  prisma.order.aggregate({ 
    where: { paymentStatus: PaymentStatus.REFUNDED }, 
    _sum: { total: true }, 
    _count: true 
  }),
  prisma.order.aggregate({
    where: { 
      paymentStatus: PaymentStatus.UNPAID, 
      paymentMethod: PaymentMethod.BANK_TRANSFER 
    },
    _sum: { total: true }, 
    _count: true 
  }),
])
```

**Giải thích:**
- Dùng `Promise.all` để chạy 4 queries song song thay vì tuần tự
- Mỗi query đã được tối ưu với index `paymentStatus`
- Tránh N+1 problem

### 5.3 N+1 Prevention (Ngăn chặn N+1 Query)

**Scenario:** Lấy danh sách orders cùng với items và payment info.

**❌ BAD: N+1 Query Pattern**
```typescript
// Query 1: Lấy orders
const orders = await prisma.order.findMany({ where: { userId } })

// Query 2+N: Lấy items cho từng order
for (const order of orders) {
  const items = await prisma.orderItem.findMany({ 
    where: { orderId: order.id } 
  })
  order.items = items
}

// Query 3+N: Lấy payment info cho từng order
for (const order of orders) {
  const payment = await prisma.order.findUnique({
    where: { id: order.id },
    select: { paymentStatus: true, paidAt: true }
  })
  order.payment = payment
}
```

**✅ GOOD: Single Query with Include**
```typescript
// Single query lấy tất cả data
const orders = await prisma.order.findMany({
  where: { userId },
  include: {
    items: {
      select: {
        productName: true,
        sku: true,
        quantity: true,
        unitPrice: true,
        subtotal: true,
      }
    }
  },
  orderBy: { createdAt: 'desc' }
})

// Payment info đã có trong order object
const withPayment = orders.map(order => ({
  ...order,
  payment: {
    status: order.paymentStatus,
    method: order.paymentMethod,
    paidAt: order.paidAt
  }
}))
```

**✅ GOOD: Select Only Required Fields**
```typescript
// Chỉ select fields cần thiết để giảm bandwidth
const orders = await prisma.order.findMany({
  where: { userId },
  select: {
    id: true,
    orderCode: true,
    total: true,
    paymentStatus: true,
    paymentMethod: true,
    paidAt: true,
    items: {
      select: {
        productName: true,
        quantity: true,
        unitPrice: true,
      }
    }
  },
  orderBy: { createdAt: 'desc' }
})
```

### 5.4 Performance Considerations (Hiệu suất)

**Database Connection Pooling:**
```typescript
// Prisma Client với connection pooling
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Trong production, dùng connection pooler (Supabase: mode transaction)
// DATABASE_URL thay port 5432 → 6543 cho transaction pooling
```

**Query Timeout:**
```typescript
// Set timeout cho long-running queries
const orders = await prisma.order.findMany({
  where: { userId },
  // Prisma tự động timeout sau 60s (default)
  // Có thể giảm xuống để tránh blocking
})
```

**Pagination cho danh sách lớn:**
```typescript
// ❌ BAD: Lấy tất cả orders (có thể hàng nghìn records)
const allOrders = await prisma.order.findMany({ 
  where: { userId } 
})

// ✅ GOOD: Pagination
const pageSize = 20
const page = 1
const orders = await prisma.order.findMany({
  where: { userId },
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { createdAt: 'desc' }
})
```

**Cursor-based Pagination (cho infinite scroll):**
```typescript
// Efficient hơn offset-based cho dataset lớn
const orders = await prisma.order.findMany({
  where: { userId },
  take: pageSize,
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: 'desc' }
})
```

## 6. Data Integrity Rules

### 6.1 Payment Method Validation (Validate phương thức thanh toán)

**Enum Definition:**
```prisma
enum PaymentMethod {
  COD            // Thanh toán khi nhận hàng
  BANK_TRANSFER  // Chuyển khoản ngân hàng
}
```

**Validation Rules:**
1. `paymentMethod` phải thuộc enum {COD, BANK_TRANSFER}
2. Mặc định: `COD`
3. Không thể null

**Application Validation:**
```typescript
// Khi tạo đơn hàng
const order = await prisma.order.create({
  data: {
    paymentMethod: PaymentMethod.BANK_TRANSFER, // Validate enum
    // ...
  }
})
```

### 6.2 Payment Status Transitions (Chuyển trạng thái thanh toán)

**Enum Definition:**
```prisma
enum PaymentStatus {
  UNPAID    // Chưa thanh toán
  PAID      // Đã thanh toán
  REFUNDED  // Đã hoàn tiền
}
```

**Valid Transitions:**

```
┌─────────────────────────────────────────────────────────────┐
│                    PAYMENT STATUS LIFECYCLE                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  UNPAID ──────────────> PAID ──────────────> REFUNDED        │
│    │                       │                       │           │
│    │                       │                       │           │
│    └────────[CANCEL]───────┴───────────────────────┘           │
│                                                               │
│  UNPAID ──[Webhook SePay]──> PAID                            │
│  UNPAID ──[Admin Confirm]──> PAID                            │
│  PAID ───[Admin Refund]────> REFUNDED                         │
│  UNPAID ──[Admin Cancel]──> CANCELLED (order status)         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Transition Rules:**

1. **UNPAID → PAID:**
   - **COD:** Admin xác nhận đã nhận tiền mặt
   - **BANK_TRANSFER:** Webhook từ SePay tự động xác nhận
   - Điều kiện:
     - `transferAmount === order.total` (khớp số tiền)
     - `orderCode === payload.content` (khớp mã đơn)
     - `paymentStatus !== PAID` (chưa thanh toán)

2. **PAID → REFUNDED:**
   - Admin thực hiện hoàn tiền
   - Cập nhật `paymentStatus = REFUNDED`
   - Lưu `refundReason`, `refundedAt` (nếu có mở rộng schema)

3. **UNPAID → CANCELLED:**
   - Admin hủy đơn hàng chưa thanh toán
   - Cập nhật `status = CANCELLED` (order status, không phải payment status)
   - Lưu `cancelReason`

4. **Không cho phép:**
   - PAID → UNPAID (Không thể revert trạng thái đã thanh toán)
   - REFUNDED → PAID (Không thể thanh toán lại sau khi hoàn tiền)
   - UNPAID → REFUNDED (Không thể hoàn tiền đơn chưa thanh toán)

**Validation Logic:**
```typescript
// Validate payment status transition
function validatePaymentTransition(
  currentStatus: PaymentStatus,
  newStatus: PaymentStatus
): boolean {
  const validTransitions = {
    [PaymentStatus.UNPAID]: [PaymentStatus.PAID],
    [PaymentStatus.PAID]: [PaymentStatus.REFUNDED],
    [PaymentStatus.REFUNDED]: [], // No transitions allowed
  }

  return validTransitions[currentStatus]?.includes(newStatus) ?? false
}

// Usage
if (!validatePaymentTransition(order.paymentStatus, PaymentStatus.PAID)) {
  throw new Error('Invalid payment status transition')
}
```

### 6.3 paidAt Field Constraint (Ràng buộc trường paidAt)

**Rules:**
1. `paidAt` chỉ được set khi `paymentStatus = PAID`
2. `paidAt` phải là timestamp hợp lệ (được validate từ webhook)
3. Khi `paymentStatus` chuyển từ PAID → REFUNDED, `paidAt` vẫn giữ nguyên (lịch sử)
4. `paidAt` được set từ `payload.transactionDate` của webhook SePay

**Validation:**
```typescript
// Webhook processing
const paidAt = new Date(payload.transactionDate)
if (isNaN(paidAt.getTime())) {
  return { handled: false } // Invalid date
}

await prisma.order.update({
  where: { id: order.id },
  data: {
    paymentStatus: PaymentStatus.PAID,
    paidAt, // Chỉ set khi status = PAID
  },
})
```

**Database Level Validation (nếu dùng PostgreSQL CHECK constraint):**
```sql
ALTER TABLE orders
ADD CONSTRAINT check_paid_at_consistency
CHECK (
  (payment_status = 'PAID' AND paid_at IS NOT NULL) OR
  (payment_status != 'PAID' AND paid_at IS NULL)
);
```

**Note:** Prisma không hỗ trợ CHECK constraint, cần dùng raw SQL trong migration.

### 6.4 Total Amount Validation (Validate tổng tiền)

**Rules:**
1. `total` phải khớp với `transferAmount` trong webhook
2. `total` phải = `subtotal + shippingFee - discount`
3. `total` phải > 0 (không cho phép đơn hàng $0)

**Validation Logic:**
```typescript
// Webhook processing
const expectedAmount = Number(order.total)
if (payload.transferAmount !== expectedAmount) {
  return { handled: false } // Amount mismatch
}

// Order creation
const total = subtotal + shippingFee - discount
if (total <= 0) {
  throw new Error('Total amount must be greater than 0')
}
```

**Application Validation:**
```typescript
// Tạo đơn hàng
const order = await prisma.order.create({
  data: {
    subtotal: 1000000,
    shippingFee: 50000,
    discount: 0,
    total: 1050000, // Must equal 1000000 + 50000 - 0
    // ...
  }
})
```

## 7. Migration Strategy

### 7.1 Initial Schema Creation (Khởi tạo schema)

**Migration File: `001_create_orders_table.sql`**
```sql
-- Tạo bảng orders
CREATE TABLE orders (
    id VARCHAR(36) PRIMARY KEY,
    order_code VARCHAR(255) UNIQUE NOT NULL,
    userId VARCHAR(36) NOT NULL,
    
    -- Shipping address snapshot
    shipping_name VARCHAR(255) NOT NULL,
    shipping_phone VARCHAR(20) NOT NULL,
    shipping_province VARCHAR(100) NOT NULL,
    shipping_district VARCHAR(100) NOT NULL,
    shipping_ward VARCHAR(100) NOT NULL,
    shipping_detail TEXT NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(12,2) NOT NULL,
    shipping_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    
    -- Status enums
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payment_method VARCHAR(20) NOT NULL DEFAULT 'COD',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    
    -- Optional fields
    note TEXT,
    cancel_reason TEXT,
    paid_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key
    CONSTRAINT fk_orders_user
    FOREIGN KEY (userId)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_orders_userId ON orders(userId);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_paymentStatus ON orders(payment_status);
CREATE INDEX idx_orders_paymentMethod ON orders(payment_method);
CREATE INDEX idx_orders_createdAt ON orders(created_at);
CREATE UNIQUE INDEX idx_orders_orderCode ON orders(order_code);
```

### 7.2 Add Payment Fields (Thêm trường payment)

**Migration File: `002_add_payment_fields.sql`**
```sql
-- Thêm trường paidAt (nếu chưa có)
ALTER TABLE orders
ADD COLUMN paid_at TIMESTAMPTZ;

-- Thêm CHECK constraint cho paidAt
ALTER TABLE orders
ADD CONSTRAINT check_paid_at_consistency
CHECK (
  (payment_status = 'PAID' AND paid_at IS NOT NULL) OR
  (payment_status != 'PAID' AND paid_at IS NULL)
);
```

### 7.3 Add Composite Indexes (Thêm composite indexes)

**Migration File: `003_add_composite_indexes.sql`**
```sql
-- Composite index cho webhook processing
CREATE INDEX idx_orders_paymentStatus_method 
ON orders(payment_status, payment_method);

-- Composite index cho admin dashboard
CREATE INDEX idx_orders_paymentStatus_created 
ON orders(payment_status, created_at DESC);

-- Composite index cho user orders
CREATE INDEX idx_orders_user_created 
ON orders(userId, created_at DESC);

-- Partial index cho paid orders
CREATE INDEX idx_orders_paidAt 
ON orders(paid_at DESC) 
WHERE payment_status = 'PAID';
```

### 7.4 Rollback Strategy (Rollback migrations)

**Rollback Migration:**
```sql
-- Drop indexes
DROP INDEX IF EXISTS idx_orders_paidAt;
DROP INDEX IF EXISTS idx_orders_user_created;
DROP INDEX IF EXISTS idx_orders_paymentStatus_created;
DROP INDEX IF EXISTS idx_orders_paymentStatus_method;

-- Drop constraint
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS check_paid_at_consistency;

-- Drop column (cẩn thận: có thể mất data)
ALTER TABLE orders
DROP COLUMN IF EXISTS paid_at;
```

### 7.5 Zero-Downtime Migration (Migration không downtime)

**Strategy:**
1. **Add Column (Non-Blocking):**
```sql
-- Thêm column nullable (không lock table)
ALTER TABLE orders
ADD COLUMN paid_at TIMESTAMPTZ;
```

2. **Backfill Data (Background Job):**
```typescript
// Backfill paid_at cho orders đã PAID
await prisma.$executeRaw`
  UPDATE orders
  SET paid_at = created_at
  WHERE payment_status = 'PAID' AND paid_at IS NULL
`;
```

3. **Add Constraint (Non-Blocking):**
```sql
-- Validate constraint trước khi apply
ALTER TABLE orders
ADD CONSTRAINT check_paid_at_consistency
CHECK (
  (payment_status = 'PAID' AND paid_at IS NOT NULL) OR
  (payment_status != 'PAID' AND paid_at IS NULL)
) NOT VALID;
```

4. **Validate Constraint (Non-Blocking):**
```sql
-- Validate trong background
ALTER TABLE orders
VALIDATE CONSTRAINT check_paid_at_consistency;
```

5. **Create Index CONCURRENTLY (Non-Blocking):**
```sql
-- Tạo index mà không lock table
CREATE INDEX CONCURRENTLY idx_orders_paymentStatus_method 
ON orders(payment_status, payment_method);
```

## 8. Performance Considerations

### 8.1 Query Performance (Hiệu suất query)

**EXPLAIN ANALYZE cho các query quan trọng:**

**Query 1: Find Order by OrderCode**
```sql
EXPLAIN ANALYZE
SELECT id, total, payment_status, status
FROM orders
WHERE order_code = 'ORD-20250120-ABC123';
```

**Expected Output:**
```
Index Scan using orders_order_code_key on orders 
  (cost=0.29..8.31 rows=1 width=XX) 
  (actual time=0.015..0.016 rows=1 loops=1)
  Index Cond: (order_code = 'ORD-20250120-ABC123')
Planning Time: 0.123 ms
Execution Time: 0.058 ms
```

**Good Signs:**
- `Index Scan` (not Seq Scan)
- `actual time < 1ms`

**Bad Signs:**
- `Seq Scan` (sequential scan - chậm)
- `actual time > 100ms`

---

**Query 2: Payment Statistics Aggregation**
```sql
EXPLAIN ANALYZE
SELECT 
    COUNT(*) as count,
    COALESCE(SUM(total), 0) as amount
FROM orders
WHERE payment_status = 'PAID';
```

**Expected Output:**
```
Aggregate  (cost=XX..XX rows=1 width=XX)
  ->  Index Scan using idx_orders_paymentStatus on orders  
        (cost=0.42..XX rows=XX width=XX)
        Index Cond: (payment_status = 'PAID')
Planning Time: 0.456 ms
Execution Time: 2.345 ms
```

**Good Signs:**
- `Index Scan using idx_orders_paymentStatus`
- `Execution Time < 10ms`

---

**Query 3: Complex Aggregation with GROUP BY**
```sql
EXPLAIN ANALYZE
SELECT 
    payment_method,
    payment_status,
    COUNT(*) as count,
    COALESCE(SUM(total), 0) as total_amount
FROM orders
GROUP BY payment_method, payment_status;
```

**Expected Output:**
```
HashAggregate  (cost=XX..XX rows=XX width=XX)
  Group Key: payment_method, payment_status
  ->  Seq Scan on orders  (cost=0.00..XX rows=XX width=XX)
Planning Time: 0.789 ms
Execution Time: 15.678 ms
```

**Optimization:**
- Nếu `Seq Scan` là do query lấy toàn bộ bảng, thì acceptable
- Nếu có filter, cần thêm composite index

### 8.2 Index Optimization (Tối ưu hóa index)

**Unused Index Detection:**
```sql
-- Tìm indexes không được sử dụng
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname LIKE 'idx_orders%';
```

**Remove Unused Indexes:**
```sql
-- Drop indexes không dùng (để save disk space và write performance)
DROP INDEX IF EXISTS idx_orders_unused;
```

**Index Size Monitoring:**
```sql
-- Kiểm tra kích thước indexes
SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
WHERE tablename = 'orders';
```

### 8.3 Table Partitioning (Phân chia bảng)

**Use case:** Khi orders table quá lớn (> 10M rows)

**Partition by Date (created_at):**
```sql
-- Tạo partitioned table
CREATE TABLE orders_partitioned (
    id VARCHAR(36),
    order_code VARCHAR(255) NOT NULL,
    -- ... (các fields khác)
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Tạo partitions theo tháng
CREATE TABLE orders_2025_01 PARTITION OF orders_partitioned
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE orders_2025_02 PARTITION OF orders_partitioned
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- ... tiếp tục cho các tháng tiếp theo
```

**Benefits:**
- Query faster khi filter theo date range
- Delete/Archive old data dễ dàng hơn
- Maintenance operations chạy nhanh hơn

### 8.4 Materialized Views (View được materialize)

**Use case:** Dashboard queries phức tạp

**Create Materialized View cho Daily Revenue:**
```sql
CREATE MATERIALIZED VIEW mv_daily_revenue AS
SELECT 
    DATE(paid_at) as date,
    COUNT(*) as orders_count,
    COALESCE(SUM(total), 0) as revenue
FROM orders
WHERE payment_status = 'PAID'
  AND paid_at IS NOT NULL
GROUP BY DATE(paid_at)
ORDER BY date DESC;

-- Indexes cho materialized view
CREATE INDEX idx_mv_daily_revenue_date ON mv_daily_revenue(date DESC);
```

**Refresh Materialized View:**
```sql
-- Refresh manually
REFRESH MATERIALIZED VIEW mv_daily_revenue;

-- Refresh concurrently (không lock view - PostgreSQL 9.4+)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_revenue;
```

**Query từ Materialized View:**
```typescript
// Fast query from pre-computed data
const dailyRevenue = await prisma.$queryRaw`
  SELECT * FROM mv_daily_revenue
  WHERE date >= NOW() - INTERVAL '30 days'
  ORDER BY date DESC
`
```

**Benefits:**
- Query cực nhanh vì data đã được pre-compute
- Giảm load trên orders table
- Tốt cho dashboard queries

### 8.5 Connection Pooling (Pooling kết nối)

**Supabase Connection Pooler:**
```typescript
// Sử dụng transaction mode cho serverless functions
const connectionString = process.env.DATABASE_URL

// Thay port 5432 → 6543 cho transaction pooling
const pooledUrl = connectionString.replace(':5432', ':6543')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: pooledUrl,
    },
  },
})
```

**PgBouncer Configuration:**
```ini
# pgbouncer.ini
[databases]
yourdb = host=db.example.com port=5432 dbname=yourdb

[pgbouncer]
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
```

**Benefits:**
- Giảm overhead của establishing connections
- Tối ưu cho serverless environments (Vercel, AWS Lambda)
- Giảm database load

## 9. Security Considerations

### 9.1 Ownership Validation (Validate quyền sở hữu)

**Critical Rule:** User chỉ được xem payment info của chính mình (trừ khi là admin).

**Implementation:**
```typescript
// Middleware/Service function
async function getOrderPaymentInfo(userId: string, orderId: string) {
  // Query với filter userId → đảm bảo ownership
  const order = await prisma.order.findFirst({
    where: { 
      id: orderId,
      userId  // ← CRITICAL: Validate ownership ở DB level
    },
    select: { 
      id: true,
      orderCode: true,
      total: true,
      paymentMethod: true,
      paymentStatus: true,
      paidAt: true
    },
  })

  if (!order) {
    throw new AppError(404, 'Đơn hàng không tồn tại')
  }

  // Additional business logic validations
  if (order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
    throw new AppError(400, 'Đơn hàng không dùng phương thức chuyển khoản')
  }

  if (order.paymentStatus === PaymentStatus.PAID) {
    throw new AppError(400, 'Đơn hàng đã được thanh toán')
  }

  return order
}
```

**Why This Matters:**
- **Prevent IDOR:** Không thể guess orderId để xem đơn hàng của người khác
- **Database-Level Security:** Filter ngay trong SQL query, không phải application layer
- **Zero Trust:** Không trust userId từ request, phải validate ở DB

---

**Admin Override:**
```typescript
// Admin có thể xem tất cả orders
async function getOrderPaymentInfoAdmin(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,  // Include userId để track ownership
      orderCode: true,
      total: true,
      paymentMethod: true,
      paymentStatus: true,
      paidAt: true
    },
  })

  if (!order) {
    throw new AppError(404, 'Đơn hàng không tồn tại')
  }

  return order
}
```

### 9.2 Webhook Security (Bảo mật webhook)

**Threat:** Attacker gửi fake webhook để mark order là PAID.

**Mitigation Strategies:**

**1. Validate Amount Strict:**
```typescript
// ❌ BAD: Chỉ check orderCode
if (orderCode === payload.content) {
  // Mark as paid - VULNERABLE!
}

// ✅ GOOD: Validate cả amount và orderCode
const expectedAmount = Number(order.total)
if (payload.transferAmount !== expectedAmount) {
  return { handled: false } // Amount mismatch
}
```

**2. Validate Date:**
```typescript
// Validate transactionDate không phải in the future
const paidAt = new Date(payload.transactionDate)
const now = new Date()

if (paidAt > now) {
  return { handled: false } // Future date - invalid!
}

if (isNaN(paidAt.getTime())) {
  return { handled: false } // Invalid date
}
```

**3. Idempotency:**
```typescript
// Không process lại đơn đã PAID
if (order.paymentStatus === PaymentStatus.PAID) {
  return { handled: false } // Already paid - ignore
}
```

**4. Rate Limiting:**
```typescript
// Rate limit webhook endpoint để prevent abuse
import rateLimit from 'express-rate-limit'

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 webhooks per minute
  message: 'Too many webhook requests'
})

app.post('/api/payment/webhook/sepay', webhookLimiter, handleSePayWebhook)
```

**5. HMAC Verification (nếu SePay support):**
```typescript
// Verify webhook signature (if available)
import crypto from 'crypto'

function verifyWebhookSignature(
  payload: string, 
  signature: string, 
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const digest = hmac.digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  )
}
```

### 9.3 SQL Injection Prevention

**Use Parameterized Queries:**
```typescript
// ❌ BAD: Raw SQL interpolation - SQL Injection Risk!
const orderId = req.params.id
const sql = `SELECT * FROM orders WHERE id = '${orderId}'`
await prisma.$queryRaw(sql)

// ✅ GOOD: Parameterized query
const orderId = req.params.id
await prisma.$queryRaw`
  SELECT * FROM orders WHERE id = ${orderId}
`

// ✅ GOOD: Prisma query builder (auto-escaped)
await prisma.order.findUnique({
  where: { id: orderId }
})
```

**Prisma Auto-Escaping:**
- Prisma tự động escape parameters
- Không cần manually escape
- Safer than raw SQL

### 9.4 Data Exposure Prevention

**Don't Expose Sensitive Data:**
```typescript
// ❌ BAD: Return all fields including internal data
const order = await prisma.order.findUnique({
  where: { id: orderId }
})
res.json(order) // Exposes ALL fields!

// ✅ GOOD: Select only required fields
const order = await prisma.order.findUnique({
  where: { id: orderId },
  select: {
    id: true,
    orderCode: true,
    total: true,
    paymentStatus: true,
    paymentMethod: true,
    paidAt: true,
    // Don't expose: userId, internal fields, etc.
  }
})
res.json(order)
```

**Field-Level Access Control:**
```typescript
// Admin sees more fields than regular user
function getOrderForUser(orderId: string, userId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      orderCode: true,
      total: true,
      paymentStatus: true,
      // Limited fields
    }
  })
}

function getOrderForAdmin(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,  // Admin can see ownership
      orderCode: true,
      total: true,
      paymentStatus: true,
      paidAt: true,
      shippingName: true,
      shippingPhone: true,
      // More fields for admin
    }
  })
}
```

### 9.5 Audit Logging (Ghi log audit)

**Log Payment Status Changes:**
```typescript
// Tạo audit_log table
model AuditLog {
  id        BigInt   @id @default(autoincrement())
  userId    BigInt?
  action    String
  entity    String
  entityId  String
  oldValue  String?
  newValue  String?
  createdAt DateTime @default(now())
  
  @@index([entity, entityId])
  @@index([userId])
  @@map("audit_logs")
}

// Log payment status changes
async function logPaymentStatusChange(
  orderId: string,
  oldStatus: PaymentStatus,
  newStatus: PaymentStatus,
  userId?: string
) {
  await prisma.auditLog.create({
    data: {
      userId: userId ? BigInt(userId) : null,
      action: 'UPDATE',
      entity: 'Order',
      entityId: orderId,
      oldValue: oldStatus,
      newValue: newStatus
    }
  })
}

// Usage trong webhook processing
await prisma.order.update({
  where: { id: order.id },
  data: {
    paymentStatus: PaymentStatus.PAID,
    paidAt
  }
})

await logPaymentStatusChange(
  order.id,
  PaymentStatus.UNPAID,
  PaymentStatus.PAID,
  null // Webhook - no user
)
```

**Benefits:**
- Track ai đã thay đổi payment status
- Debug khi có vấn đề
- Compliance với audit requirements

---

## Tổng Kết

**ERD Diagram:** Hiển thị mối quan hệ giữa User ↔ Order ↔ OrderItems ↔ ProductVariants với các payment fields quan trọng.

**Key Entities:**
- **Orders:** Bảng chính với paymentMethod, paymentStatus, paidAt, total
- **Users:** Validate ownership
- **OrderItems:** Chi tiết đơn hàng (snapshot data)

**Optimization Strategies:**
- Indexes trên userId, orderCode, paymentStatus, paymentMethod
- Prevent N+1 queries với include/select
- Aggregation queries cho statistics
- Connection pooling cho production

**Data Integrity:**
- Validate paymentMethod enum
- Validate paymentStatus transitions
- Validate paidAt consistency
- Validate total amount

**Security:**
- Ownership validation (userId filter)
- Webhook security (amount validation, idempotency)
- SQL injection prevention (parameterized queries)
- Data exposure prevention (select only required fields)

**Migration:**
- Zero-downtime migrations
- Add indexes CONCURRENTLY
- Backfill data background jobs

**Performance:**
- EXPLAIN ANALYZE cho query tuning
- Materialized views cho dashboard
- Partitioning cho large tables
- Connection pooling (Supabase transaction mode)

---

**File Paths:**
- Prisma Schema: `C:\Users\Admin\Desktop\mobivexa_DATN\be_mobivexa\prisma\schema.prisma`
- Payment Service: `C:\Users\Admin\Desktop\mobivexa_DATN\be_mobivexa\src\services\payment.service.ts`
- Payment Types: `C:\Users\Admin\Desktop\mobivexa_DATN\be_mobivexa\src\types\payment.type.ts`
- Payment Controller: `C:\Users\Admin\Desktop\mobivexa_DATN\be_mobivexa\src\controllers\payment.controller.ts`

---

**Created:** 2025-01-20  
**Author:** Database Optimizer Agent  
**Version:** 1.0.0
