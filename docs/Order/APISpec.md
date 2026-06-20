# API Specification — Request / Response
## Module: Order (Đơn hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Base URL:** `http://localhost:3000/api` (development)  
> **Content-Type:** `application/json`  
> **Rate Limit:** Không áp dụng cho public endpoints

---

## Tổng quan Endpoints

### Customer Endpoints (CUSTOMER+)

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/orders` | Đặt hàng | ✅ |
| `GET` | `/orders` | Danh sách đơn của tôi | ✅ |
| `GET` | `/orders/:id` | Chi tiết đơn hàng của tôi | ✅ |
| `PATCH` | `/orders/:id/cancel` | Hủy đơn hàng | ✅ |

### Admin Endpoints (STAFF+)

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/admin/orders` | Danh sách tất cả đơn hàng | ✅ |
| `GET` | `/admin/orders/:id` | Chi tiết đơn hàng bất kỳ | ✅ |
| `PATCH` | `/admin/orders/:id/status` | Cập nhật trạng thái đơn | ✅ |
| `PATCH` | `/admin/orders/:id/payment` | Cập nhật trạng thái thanh toán | ✅ |

---

## Customer Endpoints

### POST `/orders`

Tạo đơn hàng mới từ giỏ hàng hoặc mua ngay.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**

```json
{
  "addressId": "addr_123",
  "paymentMethod": "COD",
  "note": "Gọi trước khi giao",
  "items": [
    {
      "variantId": "var_123",
      "quantity": 2
    }
  ]
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `addressId` | string | ✅ | Phải tồn tại và thuộc về user |
| `paymentMethod` | string | ❌ | `COD` (default) hoặc `BANK_TRANSFER` |
| `note` | string | ❌ | Ghi chú tùy chọn |
| `items` | array | ❌ | Nếu không gửi → lấy từ Cart |

**Mỗi item trong `items`:**

| Field | Type | Required | Validation |
|---|---|---|---|
| `variantId` | string | ✅ | Variant phải tồn tại và active |
| `quantity` | number | ✅ | ≥ 1 |

**Response `201`:**

```json
{
  "id": "ord_123",
  "orderCode": "ORD-20240619-A3F9C2",
  "userId": "user_123",
  "status": "PENDING",
  "paymentMethod": "COD",
  "paymentStatus": "UNPAID",
  "subtotal": 36000000,
  "shippingFee": 0,
  "discount": 0,
  "total": 36000000,
  "shippingName": "Nguyễn Văn A",
  "shippingPhone": "0901234567",
  "shippingProvince": "Hà Nội",
  "shippingDistrict": "Quận Hoàn Kiếm",
  "shippingWard": "Phường Chương Dương",
  "shippingDetail": "123 Đường ABC, Phường XYZ",
  "note": "Gọi trước khi giao",
  "cancelReason": null,
  "paidAt": null,
  "createdAt": "2026-06-19T10:00:00Z",
  "updatedAt": "2026-06-19T10:00:00Z",
  "items": [
    {
      "id": "item_123",
      "variantId": "var_123",
      "productName": "iPhone 15 Pro Max",
      "sku": "IP15PM-256-TITAN",
      "color": "Titan Natural",
      "storage": "256GB",
      "ram": null,
      "unitPrice": 18000000,
      "quantity": 2,
      "subtotal": 36000000
    }
  ],
  "user": {
    "id": "user_123",
    "fullName": "Nguyễn Văn A",
    "email": "nguyenvana@example.com"
  }
}
```

**Error Responses:**

| HTTP | Message |
|---|---|
| `400` | `Vui lòng chọn địa chỉ giao hàng` |
| `400` | `Phương thức thanh toán không hợp lệ` |
| `400` | `Danh sách sản phẩm không hợp lệ` |
| `400` | `Giỏ hàng trống, không thể đặt hàng` |
| `400` | `Địa chỉ không tồn tại` |
| `400` | `Sản phẩm không tồn tại: var_456` |
| `400` | `Sản phẩm đã ngừng bán: IP15-001` |
| `400` | `Sản phẩm "IP15-001" không đủ hàng` |

---

### GET `/orders`

Danh sách đơn hàng của chính tôi.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | number | ❌ | 1 | Trang hiện tại |
| `limit` | number | ❌ | 10 | Số đơn/trang (max: 50) |
| `status` | string | ❌ | — | `OrderStatus` filter |

**Response `200`:**

```json
{
  "orders": [
    {
      "id": "ord_123",
      "orderCode": "ORD-20240619-A3F9C2",
      "status": "CONFIRMED",
      "paymentStatus": "UNPAID",
      "total": 36000000,
      "createdAt": "2026-06-19T10:00:00Z",
      "_count": {
        "items": 2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

---

### GET `/orders/:id`

Chi tiết đơn hàng của tôi.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Order ID |

**Response `200`:** Giống `POST /orders` response (full detail).

**Response `404`:**

```json
{
  "message": "Đơn hàng không tồn tại"
}
```

---

### PATCH `/orders/:id/cancel`

Hủy đơn hàng.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**

```json
{
  "cancelReason": "Tôi muốn thay đổi địa chỉ"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `cancelReason` | string | ❌ | Lý do hủy (default: "Khách hàng hủy đơn") |

**Response `200`:** Giống `GET /orders/:id` response với `status = CANCELLED`.

**Error Responses:**

| HTTP | Message |
|---|---|
| `404` | `Đơn hàng không tồn tại` |
| `400` | `Không thể hủy đơn hàng ở trạng thái hiện tại` |

---

## Admin Endpoints

### GET `/admin/orders`

Danh sách tất cả đơn hàng (cho admin).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | number | ❌ | 1 | Trang hiện tại |
| `limit` | number | ❌ | 20 | Số đơn/trang (max: 100) |
| `status` | string | ❌ | — | `OrderStatus` filter |
| `userId` | string | ❌ | — | Filter theo user |
| `paymentMethod` | string | ❌ | — | `COD` / `BANK_TRANSFER` |
| `paymentStatus` | string | ❌ | — | `UNPAID` / `PAID` / `REFUNDED` |
| `from` | string (ISO date) | ❌ | — | Từ ngày |
| `to` | string (ISO date) | ❌ | — | Đến ngày |

**Response `200`:**

```json
{
  "orders": [
    {
      "id": "ord_123",
      "orderCode": "ORD-20240619-A3F9C2",
      "status": "PENDING",
      "paymentStatus": "UNPAID",
      "total": 36000000,
      "createdAt": "2026-06-19T10:00:00Z",
      "_count": {
        "items": 2
      },
      "user": {
        "id": "user_123",
        "fullName": "Nguyễn Văn A",
        "email": "nguyenvana@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

### GET `/admin/orders/:id`

Chi tiết đơn hàng bất kỳ.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response `200`:** Giống `POST /orders` response (full detail).

**Response `404`:**

```json
{
  "message": "Đơn hàng không tồn tại"
}
```

---

### PATCH `/admin/orders/:id/status`

Cập nhật trạng thái đơn hàng.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**

```json
{
  "status": "CONFIRMED",
  "cancelReason": "Sản phẩm hết hàng"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | `OrderStatus` | ✅ | `PENDING` / `CONFIRMED` / `SHIPPING` / `DELIVERED` / `CANCELLED` |
| `cancelReason` | string | Condition | Bắt buộc nếu `status = CANCELLED` |

**Response `200`:** Giống `GET /orders/:id` response với updated status.

**Error Responses:**

| HTTP | Message |
|---|---|
| `400` | `Trạng thái đơn hàng không hợp lệ` |
| `400` | `Vui lòng nhập lý do hủy đơn` (khi hủy mà thiếu reason) |
| `400` | `Không thể chuyển từ "PENDING" sang "DELIVERED"` |
| `404` | `Đơn hàng không tồn tại` |

---

### PATCH `/admin/orders/:id/payment`

Cập nhật trạng thái thanh toán.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**

```json
{
  "paymentStatus": "PAID"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `paymentStatus` | `PaymentStatus` | ✅ | `UNPAID` / `PAID` / `REFUNDED` |

**Response `200`:** Giống `GET /orders/:id` response với updated paymentStatus + paidAt (if PAID).

**Error Responses:**

| HTTP | Message |
|---|---|
| `400` | `Trạng thái thanh toán không hợp lệ` |
| `404` | `Đơn hàng không tồn tại` |

---

## Authentication & Authorization

### JWT Token Format

**Access Token Header:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Payload:**
```json
{
  "userId": "user_123",
  "email": "customer@mobivexa.com",
  "role": "CUSTOMER",
  "iat": 1234567890,
  "exp": 1234568790
}
```

### Role-based Access Control

| Role | Access |
|---|---|
| `CUSTOMER` | Customer endpoints only |
| `STAFF` | Customer + Admin endpoints |
| `ADMIN` | Customer + Admin endpoints |

---

## Error Response Format

Tất cả error responses tuân theo format:

```json
{
  "message": "Mô tả lỗi",
  "errors": [
    { "field": "addressId", "message": "Vui lòng chọn địa chỉ giao hàng" }
  ]
}
```

---

## Data Types & Enums

### OrderStatus

```typescript
enum OrderStatus {
  PENDING     = "PENDING"
  CONFIRMED   = "CONFIRMED"
  SHIPPING    = "SHIPPING"
  DELIVERED   = "DELIVERED"
  CANCELLED   = "CANCELLED"
}
```

### PaymentStatus

```typescript
enum PaymentStatus {
  UNPAID   = "UNPAID"
  PAID     = "PAID"
  REFUNDED = "REFUNDED"
}
```

### PaymentMethod

```typescript
enum PaymentMethod {
  COD           = "COD"
  BANK_TRANSFER = "BANK_TRANSFER"
}
```

---

## VALID_TRANSITIONS (State Machine)

```typescript
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: []
};
```

**Quy tắc:**
- Chuyển trạng thái phải tuân theo `VALID_TRANSITIONS`
- Không được nhảy trạng thái (ví dụ: `PENDING → DELIVERED` bị từ chối)
- `DELIVERED` và `CANCELLED` là trạng thái cuối — không thể chuyển tiếp

---

## Order Code Format

**Pattern:** `ORD-{YYYYMMDD}-{6 HEX chars}`

**Examples:**
- `ORD-20240619-A3F9C2`
- `ORD-20240620-B7E8D1`

**Dùng cho:** Nội dung chuyển khoản khi thanh toán `BANK_TRANSFER`.

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Next Review:** After API implementation
