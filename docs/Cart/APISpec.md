# API Specification — Module Cart (Giỏ hàng)
## Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-20  
> **Tham chiếu:** [BRD.md](./BRD.md) | [SRS.md](./SRS.md)

---

## 1. Tổng quan API

### 1.1 Base URL

```
https://api.mobivexa.com/api/cart
```

### 1.2 Authentication

Tất cả endpoints yêu cầu **JWT Token** với role **CUSTOMER+**:

```
Authorization: Bearer <JWT_TOKEN>
```

### 1.3 Content Type

```
Content-Type: application/json
Accept: application/json
```

### 1.4 Response Format

Tất cả responses đều sử dụng định dạng JSON với cấu trúc:

```json
{
  "data": { ... },
  "message": "Thành công",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

## 2. API Endpoints

### 2.1 Lấy toàn bộ giỏ hàng (Full Response)

#### GET /api/cart

Lấy toàn bộ thông tin giỏ hàng của user đang đăng nhập, bao gồm items, variants, products và ảnh.

---

**Authentication:** `CUSTOMER+`

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Không có | - | - | Lấy từ JWT token |

---

**Example Request:**

```http
GET /api/cart HTTP/1.1
Host: api.mobivexa.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

---

**Success Response (200 OK):**

```json
{
  "data": {
    "cart": {
      "id": "cart_abc123xyz",
      "userId": "user_456def",
      "createdAt": "2026-06-20T10:15:30Z",
      "items": [
        {
          "id": "item_001",
          "cartId": "cart_abc123xyz",
          "variantId": "var_iphone15_128gb_black",
          "quantity": 2,
          "createdAt": "2026-06-20T10:15:30Z",
          "variant": {
            "id": "var_iphone15_128gb_black",
            "productId": "prod_iphone15",
            "color": "Đen",
            "storage": "128GB",
            "ram": null,
            "salePrice": 21990000,
            "stock": 15,
            "isActive": true
          },
          "product": {
            "id": "prod_iphone15",
            "name": "iPhone 15 128GB",
            "slug": "iphone-15-128gb",
            "coverImage": {
              "id": "img_cover_001",
              "url": "https://cdn.mobivexa.com/products/iphone-15-cover.jpg",
              "alt": "iPhone 15 - Đen",
              "isCover": true
            }
          }
        },
        {
          "id": "item_002",
          "cartId": "cart_abc123xyz",
          "variantId": "var_samsung_s256_silver",
          "quantity": 1,
          "createdAt": "2026-06-20T10:20:00Z",
          "variant": {
            "id": "var_samsung_s256_silver",
            "productId": "prod_galaxy_s24",
            "color": "Bạc",
            "storage": "256GB",
            "ram": "8GB",
            "salePrice": 18990000,
            "stock": 8,
            "isActive": true
          },
          "product": {
            "id": "prod_galaxy_s24",
            "name": "Samsung Galaxy S24",
            "slug": "samsung-galaxy-s24",
            "coverImage": {
              "id": "img_cover_002",
              "url": "https://cdn.mobivexa.com/products/galaxy-s24-cover.jpg",
              "alt": "Samsung Galaxy S24 - Bạc",
              "isCover": true
            }
          }
        }
      ]
    }
  },
  "message": "Lấy giỏ hàng thành công",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

**Error Responses:**

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Token không hợp lệ hoặc đã hết hạn",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**404 Not Found (Giỏ hàng không tồn tại - auto tạo):**
```json
{
  "data": {
    "cart": {
      "id": "cart_new123xyz",
      "userId": "user_456def",
      "createdAt": "2026-06-20T10:30:00Z",
      "items": []
    }
  },
  "message": "Giỏ hàng được tạo mới",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

**Business Logic:**
1. Lấy `userId` từ JWT token
2. **Auto-upsert Cart**: Tạo mới nếu chưa có, không làm gì nếu đã tồn tại
3. Query CartItems theo `cartId`, sắp xếp theo `createdAt ASC` (thêm trước hiển thị trước)
4. Include thông tin Variant (color, storage, ram, salePrice, stock)
5. Include thông tin Product (id, name, slug) + Cover Image (isCover = true)
6. Trả về response đầy đủ

**Performance Target:** < 300ms (p95)

**Rate Limiting:** 100 requests/15 minutes per user

---

**Use Cases:**
- User vào trang "Giỏ hàng" để xem tất cả sản phẩm đã lưu
- User cần xem đầy đủ thông tin (tên sản phẩm, giá, màu, bộ nhớ, ảnh)
- User muốn kiểm tra số lượng và tồn kho trước khi đặt hàng

---

### 2.2 Thêm sản phẩm vào giỏ hàng

#### POST /api/cart/items

Thêm một sản phẩm (variant) vào giỏ hàng. Nếu sản phẩm đã có trong giỏ, số lượng sẽ được **cộng dồn**.

---

**Authentication:** `CUSTOMER+`

**Request Parameters:**

| Parameter | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| `variantId` | string | ✅ Yes | Format: var_* | ID của variant sản phẩm |
| `quantity` | number | ✅ Yes | Min: 1, Max: 100, Integer | Số lượng muốn thêm |

---

**Example Request:**

```http
POST /api/cart/items HTTP/1.1
Host: api.mobivexa.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "variantId": "var_iphone15_256gb_white",
  "quantity": 3
}
```

---

**Success Response (201 Created):**

```json
{
  "data": {
    "cartId": "cart_abc123xyz",
    "itemCount": 5,
    "addedItem": {
      "id": "item_003",
      "variantId": "var_iphone15_256gb_white",
      "quantity": 3,
      "variant": {
        "color": "Trắng",
        "storage": "256GB",
        "salePrice": 24990000,
        "stock": 10
      }
    }
  },
  "message": "Đã thêm 3 sản phẩm vào giỏ hàng",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**Case Cộng Dồn (Variant đã có trong giỏ):**
```json
{
  "data": {
    "cartId": "cart_abc123xyz",
    "itemCount": 8,
    "addedItem": {
      "id": "item_001",
      "variantId": "var_iphone15_128gb_black",
      "oldQuantity": 2,
      "addedQuantity": 3,
      "newQuantity": 5,
      "variant": {
        "color": "Đen",
        "storage": "128GB",
        "salePrice": 21990000,
        "stock": 15
      }
    }
  },
  "message": "Đã cộng thêm 3 sản phẩm vào giỏ hàng (tổng: 5)",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

**Error Responses:**

**400 Bad Request - Invalid variantId:**
```json
{
  "error": "Validation Error",
  "message": "variantId không hợp lệ",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**400 Bad Request - Invalid quantity:**
```json
{
  "error": "Validation Error",
  "message": "Số lượng phải là số nguyên từ 1 đến 100",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**404 Not Found - Variant không tồn tại hoặc inactive:**
```json
{
  "error": "Not Found",
  "message": "Sản phẩm không tồn tại hoặc đã ngừng bán",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**400 Bad Request - Stock không đủ (thêm mới):**
```json
{
  "error": "Stock Unavailable",
  "message": "Sản phẩm không đủ hàng (còn 5)",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**400 Bad Request - Stock không đủ (cộng dồn):**
```json
{
  "error": "Stock Unavailable",
  "message": "Số lượng vượt quá tồn kho (còn 5, bạn đang có 3, muốn thêm thêm 4)",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

**Business Logic:**
1. **Validate input:**
   - `variantId` phải là string hợp lệ (format: var_*)
   - `quantity` phải là số nguyên từ 1–100
   
2. **Song song query:**
   - Lấy variant (check `isActive`, `stock`)
   - Upsert Cart (tạo mới nếu chưa có)
   
3. **Validate variant:**
   - Variant phải tồn tại và `isActive = true`
   
4. **Kiểm tra tồn kho:**
   - Nếu là thêm mới: `quantity ≤ stock`
   - Nếu đã có trong giỏ: `existingQuantity + quantity ≤ stock`
   
5. **Tính toán quantity:**
   - Tra cứu item theo `(cartId, variantId)`
   - **Chưa có** → tạo mới với quantity
   - **Đã có** → `newQuantity = existingQuantity + quantity`
   
6. **Cập nhật database:**
   - Insert hoặc Update CartItem
   - Return lean summary `{ cartId, itemCount }`

**Stock Validation:**
- Không lock stock tại thời điểm thêm
- Chỉ kiểm tra điều kiện `quantity ≤ stock`
- Nếu stock thay đổi sau khi đã thêm → item vẫn tồn tại, bị chặn khi đặt hàng

**Race Condition Handling:**
- Unique constraint `(cartId, variantId)` ở database level
- Nếu 2 requests thêm cùng 1 variant cùng lúc → DB reject 1 request

**Performance Target:** < 200ms (p95)

**Rate Limiting:** 100 requests/15 minutes per user

---

**Use Cases:**
- User click "Thêm vào giỏ" từ trang sản phẩm
- User click "Mua ngay" từ trang danh sách sản phẩm
- User thêm nhiều lần cùng 1 sản phẩm → tự động cộng dồn
- User thêm sản phẩm đã hết hàng → hiển thị thông báo còn lại

---

### 2.3 Cập nhật số lượng item

#### PUT /api/cart/items/:itemId

Cập nhật số lượng của một item cụ thể trong giỏ hàng. Số lượng mới sẽ **thay thế** trực tiếp (không cộng dồn).

---

**Authentication:** `CUSTOMER+`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `itemId` | string | ✅ Yes | ID của CartItem cần cập nhật |

**Request Body:**

| Parameter | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| `quantity` | number | ✅ Yes | Min: 1, Max: 100, Integer | Số lượng mới |

---

**Example Request:**

```http
PUT /api/cart/items/item_001 HTTP/1.1
Host: api.mobivexa.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "quantity": 5
}
```

---

**Success Response (200 OK):**

```json
{
  "data": {
    "cartId": "cart_abc123xyz",
    "itemCount": 7,
    "updatedItem": {
      "id": "item_001",
      "oldQuantity": 2,
      "newQuantity": 5,
      "variant": {
        "id": "var_iphone15_128gb_black",
        "color": "Đen",
        "storage": "128GB",
        "salePrice": 21990000,
        "stock": 15
      }
    }
  },
  "message": "Đã cập nhật số lượng sản phẩm",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

**Error Responses:**

**400 Bad Request - Invalid quantity:**
```json
{
  "error": "Validation Error",
  "message": "Số lượng phải là số nguyên từ 1 đến 100",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**404 Not Found - Giỏ hàng không tồn tại:**
```json
{
  "error": "Not Found",
  "message": "Giỏ hàng không tồn tại",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**404 Not Found - Item không tồn tại hoặc không thuộc giỏ:**
```json
{
  "error": "Not Found",
  "message": "Không tìm thấy sản phẩm trong giỏ hàng",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**400 Bad Request - Stock không đủ:**
```json
{
  "error": "Stock Unavailable",
  "message": "Số lượng vượt quá tồn kho (còn 3, bạn đang đặt 5)",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**403 Forbidden - Ownership check fail:**
```json
{
  "error": "Forbidden",
  "message": "Bạn không có quyền cập nhật sản phẩm này",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

**Business Logic:**
1. **Validate input:**
   - `quantity` phải là số nguyên từ 1–100
   
2. **Ownership check:**
   - Lấy Cart theo `userId` từ JWT
   - Lấy item theo `itemId`
   - Validate `item.cartId === cart.id` (item thuộc giỏ của user)
   
3. **Stock validation:**
   - Lấy `stock` hiện tại của variant
   - Check `quantity ≤ stock`
   
4. **Update quantity:**
   - Thay thế trực tiếp (không cộng dồn)
   - Update CartItem trong database
   
5. **Return lean summary:**
   - `{ cartId, itemCount, updatedItem }`

**Ownership Validation:**
- Mọi request phải check item thuộc giỏ của user đang request
- Ngăn chặn user A update/xóa item của user B

**Performance Target:** < 150ms (p95)

**Rate Limiting:** 100 requests/15 minutes per user

---

**Use Cases:**
- User thay đổi số lượng ở trang giỏ hàng (input + / -)
- User muốn tăng số lượng từ 2 lên 5
- User muốn giảm số lượng từ 10 xuống 1
- User đặt số lượng vượt quá tồn kho → hiển thị lỗi

---

### 2.4 Xóa một item khỏi giỏ

#### DELETE /api/cart/items/:itemId

Xóa một item cụ thể khỏi giỏ hàng.

---

**Authentication:** `CUSTOMER+`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `itemId` | string | ✅ Yes | ID của CartItem cần xóa |

---

**Example Request:**

```http
DELETE /api/cart/items/item_002 HTTP/1.1
Host: api.mobivexa.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

---

**Success Response (200 OK):**

```json
{
  "data": {
    "cartId": "cart_abc123xyz",
    "itemCount": 4,
    "deletedItem": {
      "id": "item_002",
      "variantId": "var_samsung_s256_silver",
      "quantity": 1
    }
  },
  "message": "Đã xóa sản phẩm khỏi giỏ hàng",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

**Error Responses:**

**404 Not Found - Giỏ hàng không tồn tại:**
```json
{
  "error": "Not Found",
  "message": "Giỏ hàng không tồn tại",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**404 Not Found - Item không tồn tại hoặc không thuộc giỏ:**
```json
{
  "error": "Not Found",
  "message": "Không tìm thấy sản phẩm trong giỏ hàng",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**403 Forbidden - Ownership check fail:**
```json
{
  "error": "Forbidden",
  "message": "Bạn không có quyền xóa sản phẩm này",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

**Business Logic:**
1. **Ownership check:**
   - Lấy Cart theo `userId` từ JWT
   - Lấy item theo `itemId`
   - Validate `item.cartId === cart.id`
   
2. **Delete item:**
   - Xóa CartItem khỏi database
   
3. **Return lean summary:**
   - `{ cartId, itemCount, deletedItem }`

**Cascade Behavior:**
- Chỉ xóa CartItem
- Không xóa Cart (giỏ hàng vẫn tồn tại)
- Variant và Product không bị ảnh hưởng

**Performance Target:** < 100ms (p95)

**Rate Limiting:** 100 requests/15 minutes per user

---

**Use Cases:**
- User click icon "X" để xóa 1 item ở trang giỏ hàng
- User không muốn mua sản phẩm đó nữa
- User xóa nhầm và muốn thêm lại sau

---

### 2.5 Xóa toàn bộ giỏ hàng

#### DELETE /api/cart

Xóa toàn bộ items khỏi giỏ hàng của user. **Lưu ý:** Chỉ xóa CartItems, bản ghi Cart vẫn tồn tại.

---

**Authentication:** `CUSTOMER+`

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Không có | - | - | Lấy từ JWT token |

---

**Example Request:**

```http
DELETE /api/cart HTTP/1.1
Host: api.mobivexa.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

---

**Success Response (200 OK):**

```json
{
  "data": {
    "cartId": "cart_abc123xyz",
    "itemCount": 0,
    "deletedCount": 5
  },
  "message": "Đã xóa toàn bộ giỏ hàng",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

**Error Responses:**

**404 Not Found - Giỏ hàng không tồn tại:**
```json
{
  "error": "Not Found",
  "message": "Giỏ hàng không tồn tại",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Token không hợp lệ hoặc đã hết hạn",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

**Business Logic:**
1. **Get cart:**
   - Lấy Cart theo `userId` từ JWT
   
2. **Delete all items:**
   - Thực hiện `deleteMany` cho tất cả CartItems thuộc cart
   - **Không xóa** bản ghi Cart
   
3. **Return summary:**
   - `{ cartId, itemCount: 0, deletedCount }`

**Why Not Delete Cart?**
- Giỏ hàng tồn tại vĩnh viễn theo vòng đời user
- Dễ dàng khôi phục bằng cách thêm lại items
- Tránh việc phải upsert Cart liên tục

**When to Use:**
- Sau khi đặt hàng thành công (Order module call này)
- User muốn xóa toàn bộ giỏ để mua lại từ đầu
- User muốn "làm mới" giỏ hàng

**Performance Target:** < 100ms (p95)

**Rate Limiting:** 50 requests/15 minutes per user (giới hạn để tránh abuse)

---

**Use Cases:**
- User click "Xóa tất cả" ở trang giỏ hàng
- Sau khi đặt hàng thành công → Order module call clear cart
- User muốn bắt đầu lại từ đầu

---

## 3. Common Error Responses

### 3.1 Authentication Errors

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Token không hợp lệ hoặc đã hết hạn",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "Bạn không có quyền thực hiện thao tác này",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

### 3.2 Validation Errors

**400 Bad Request - Generic:**
```json
{
  "error": "Validation Error",
  "message": "Dữ liệu đầu vào không hợp lệ",
  "errors": [
    {
      "field": "quantity",
      "message": "Số lượng phải là số nguyên từ 1 đến 100"
    }
  ],
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

### 3.3 Not Found Errors

**404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Không tìm thấy tài nguyên yêu cầu",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

### 3.4 Server Errors

**500 Internal Server Error:**
```json
{
  "error": "Internal Server Error",
  "message": "Đã có lỗi xảy ra, vui lòng thử lại sau",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**503 Service Unavailable:**
```json
{
  "error": "Service Unavailable",
  "message": "Dịch vụ tạm thời không khả dụng, vui lòng thử lại sau",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

## 4. Rate Limiting

### 4.1 Rate Limit Headers

Tất cả responses đều bao gồm headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1718863200
```

### 4.2 Rate Limit by Endpoint

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| `GET /api/cart` | 100 req | 15 min | Lấy giỏ hàng |
| `POST /api/cart/items` | 100 req | 15 min | Thêm sản phẩm |
| `PUT /api/cart/items/:itemId` | 100 req | 15 min | Cập nhật số lượng |
| `DELETE /api/cart/items/:itemId` | 100 req | 15 min | Xóa item |
| `DELETE /api/cart` | 50 req | 15 min | Xóa toàn bộ |

### 4.3 Rate Limit Exceeded

**429 Too Many Requests:**
```json
{
  "error": "Too Many Requests",
  "message": "Bạn đã vượt quá giới hạn request, vui lòng thử lại sau",
  "retryAfter": 60,
  "timestamp": "2026-06-20T10:30:00Z"
}
```

---

## 5. Data Models

### 5.1 Cart Model

```typescript
interface Cart {
  id: string;              // CUID
  userId: string;         // FK -> User.id (unique)
  createdAt: string;      // ISO 8601 timestamp
}

interface CartItem {
  id: string;              // CUID
  cartId: string;         // FK -> Cart.id
  variantId: string;       // FK -> ProductVariant.id
  quantity: number;        // 1-100
  createdAt: string;      // ISO 8601 timestamp
}
```

### 5.2 Full Response Models

```typescript
interface CartResponse {
  cart: {
    id: string;
    userId: string;
    createdAt: string;
    items: CartItemFull[];
  };
}

interface CartItemFull {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  createdAt: string;
  variant: {
    id: string;
    productId: string;
    color: string;
    storage: string;
    ram: string | null;
    salePrice: number;
    stock: number;
    isActive: boolean;
  };
  product: {
    id: string;
    name: string;
    slug: string;
    coverImage: {
      id: string;
      url: string;
      alt: string;
      isCover: boolean;
    };
  };
}
```

### 5.3 Lean Summary Models

```typescript
interface LeanSummary {
  cartId: string;
  itemCount: number;
  addedItem?: AddedItemInfo;
  updatedItem?: UpdatedItemInfo;
  deletedItem?: DeletedItemInfo;
  deletedCount?: number;
}
```

---

## 6. Validation Rules

### 6.1 Input Validation

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `variantId` | string | ✅ (POST) | Format: var_*, max length: 50 |
| `quantity` | number | ✅ (POST/PUT) | Integer, min: 1, max: 100 |
| `itemId` | string | ✅ (PUT/DELETE) | Format: item_*, max length: 50 |

### 6.2 Business Validation

| Rule | Description |
|------|-------------|
| **Variant Active** | Variant phải tồn tại và `isActive = true` |
| **Stock Check** | `quantity ≤ stock` tại thời điểm thêm/sửa |
| **Accumulation** | Thêm vào item đã có → `existingQty + newQty ≤ stock` |
| **Ownership** | Item phải thuộc giỏ của user đang request |
| **Unique Variant** | 1 variant chỉ xuất hiện 1 lần trong 1 giỏ |

---

## 7. Security Considerations

### 7.1 Authentication & Authorization

- **JWT Token validation** cho mọi request
- **Role-based access**: Chỉ `CUSTOMER+` mới được truy cập
- **Ownership check**: Mọi operation đều validate item thuộc giỏ của user
- **No admin override**: Admin không thể xem/sửa giỏ của customer

### 7.2 SQL Injection Prevention

- Sử dụng **Prisma ORM** với parameterized queries
- Không concat strings trực tiếp vào SQL
- Input validation ở cả client và server

### 7.3 Race Condition Prevention

- **Unique constraint** `(cartId, variantId)` ở database level
- DB sẽ tự reject 1 trong 2 requests cùng thêm 1 variant
- Không cần implement distributed lock

### 7.4 Data Privacy

- Cart data là dữ liệu cá nhân
- Không cache responses
- Không expose giỏ hàng của user này cho user khác

---

## 8. Performance Optimization

### 8.1 Database Indexes

```sql
-- Cart table
CREATE UNIQUE INDEX idx_cart_userId ON Cart(userId);
CREATE INDEX idx_cart_createdAt ON Cart(createdAt);

-- CartItem table
CREATE INDEX idx_cartitem_cartId ON CartItem(cartId);
CREATE INDEX idx_cartitem_variantId ON CartItem(variantId);
CREATE UNIQUE INDEX idx_cartitem_cart_variant ON CartItem(cartId, variantId);
CREATE INDEX idx_cartitem_createdAt ON CartItem(createdAt);
```

### 8.2 Query Optimization

- **Eager loading**: Include Variant + Product + Image trong 1 query
- **Select only needed fields**: Không select tất cả columns
- **Order by createdAt ASC**: Items được sắp xếp theo thời gian thêm

### 8.3 Response Optimization

- **Lean summary** cho mutations (POST/PUT/DELETE)
- **Full response** chỉ cho GET /api/cart
- Không over-fetching data

---

## 9. Testing Examples

### 9.1 cURL Examples

**Get Cart:**
```bash
curl -X GET https://api.mobivexa.com/api/cart \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Accept: application/json"
```

**Add Item:**
```bash
curl -X POST https://api.mobivexa.com/api/cart/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variantId": "var_iphone15_256gb_white",
    "quantity": 2
  }'
```

**Update Quantity:**
```bash
curl -X PUT https://api.mobivexa.com/api/cart/items/item_001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 5
  }'
```

**Delete Item:**
```bash
curl -X DELETE https://api.mobivexa.com/api/cart/items/item_002 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Accept: application/json"
```

**Clear Cart:**
```bash
curl -X DELETE https://api.mobivexa.com/api/cart \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Accept: application/json"
```

---

### 9.2 Postman Collection

Import collection JSON:

```json
{
  "info": {
    "name": "Mobivexa Cart API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Cart",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{jwt_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/cart",
          "host": ["{{base_url}}"],
          "path": ["api", "cart"]
        }
      }
    },
    {
      "name": "Add Item",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{jwt_token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"variantId\": \"var_iphone15_256gb_white\",\n  \"quantity\": 2\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/cart/items",
          "host": ["{{base_url}}"],
          "path": ["api", "cart", "items"]
        }
      }
    }
  ]
}
```

---

## 10. Changelog

### Version 1.0 (2026-06-20)
- Initial API specification
- Định nghĩa 5 endpoints cơ bản
- Full response với variant + product + images
- Lean summary cho mutations
- Stock validation logic
- Ownership check cho mọi operation

---

## 11. Related Documents

| Document | Link |
|----------|------|
| BRD - Business Requirements | [BRD.md](./BRD.md) |
| SRS - Software Requirements | [SRS.md](./SRS.md) |
| Use Case Document | [UseCase.md](./UseCase.md) |
| Activity Diagram | [ActivityDiagram.md](./ActivityDiagram.md) |
| Sequence Diagram | [SequenceDiagram.md](./SequenceDiagram.md) |
| ERD | [ERD.md](./ERD.md) |
| Test Cases | [TestCase.md](./TestCase.md) |

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-20  
> **Next Review:** After API implementation complete  
> **Authors:** Backend Architect Team  
> **Reviewers:** Frontend Team, QA Team