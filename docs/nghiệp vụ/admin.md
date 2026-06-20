# Nghiệp vụ Admin (Quản trị hệ thống) — Mobivexa

> **Phạm vi:** `src/services/admin.service.ts`, `src/controllers/admin.controller.ts`, `src/routes/admin.route.ts`, `src/middlewares/auth.middleware.ts`, `src/middlewares/authorize.middleware.ts`, `src/routes/index.route.ts`
>
> **Cập nhật:** 2026-06-19

---

## 1. Tổng quan

Tài liệu này mô tả toàn bộ hệ thống quyền truy cập (Authorization) và tổng hợp tất cả endpoint dành cho quản trị viên, bao gồm cả module **User Management** (nghiệp vụ riêng trong `admin.service.ts`) lẫn các endpoint admin được định nghĩa rải rác trong từng module khác.

---

## 2. Hệ thống phân quyền

### 2.1 Các role

| Role | Mô tả |
|---|---|
| `CUSTOMER` | Người dùng thông thường — mặc định khi đăng ký |
| `STAFF` | Nhân viên — quản trị nội dung, đơn hàng, banner... |
| `ADMIN` | Quản trị viên tối cao — toàn quyền, bao gồm quản lý user |

### 2.2 Luồng xác thực & phân quyền

```
Request
    │
    ▼
[authenticate]  ──────────────────────────────────────────────────────
  Kiểm tra header Authorization: Bearer <access_token>
  Thiếu header      → 401 "Không có token xác thực"
  Token sai/hết hạn → 401 "Token không hợp lệ hoặc đã hết hạn"
  Hợp lệ            → gán req.user = { userId, email, role }
    │
    ▼
[authorize(...roles)]  ────────────────────────────────────────────────
  req.user.role có trong danh sách roles cho phép?
  Không → 403 "Bạn không có quyền thực hiện thao tác này"
  Có    → next()
    │
    ▼
Controller / Service
```

### 2.3 Nhóm quyền theo module

| Module | Quyền yêu cầu |
|---|---|
| **User Management** (`/api/admin/users`) | `ADMIN` only |
| Category, Brand, Tag | `ADMIN` + `STAFF` |
| Product, Inventory | `ADMIN` + `STAFF` |
| Order | `ADMIN` + `STAFF` |
| Payment Stats | `ADMIN` + `STAFF` |
| Review (admin) | `ADMIN` + `STAFF` |
| Banner | `ADMIN` + `STAFF` |

> `STAFF_ROLES = [ADMIN, STAFF]` — được định nghĩa trong `authorize.middleware.ts` và dùng chung ở tất cả module trừ User Management.

### 2.4 JWT Payload

Access Token decode thành:

```typescript
interface JwtPayload {
  userId: string
  email:  string
  role:   string  // 'CUSTOMER' | 'STAFF' | 'ADMIN'
}
```

Token này được gán vào `req.user` sau middleware `authenticate`. Các middleware `authorize` và service đều dùng `req.user.userId` + `req.user.role` để kiểm tra quyền.

---

## 3. Module User Management (ADMIN only)

Các endpoint quản lý người dùng **chỉ dành cho `ADMIN`**, STAFF không có quyền truy cập.

### 3.1 Danh sách endpoint

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/admin/users` | Danh sách người dùng (search, filter) |
| `GET` | `/api/admin/users/:id` | Chi tiết người dùng |
| `PATCH` | `/api/admin/users/:id/role` | Đổi role người dùng |
| `PATCH` | `/api/admin/users/:id/status` | Bật / Tắt tài khoản |
| `DELETE` | `/api/admin/users/:id` | Xóa người dùng |

### 3.2 Lấy danh sách người dùng

```
GET /api/admin/users?search=&role=&isActive=&page=&limit=
```

| Query param | Mô tả |
|---|---|
| `search` | Tìm theo `email` hoặc `fullName` (case-insensitive, contains) |
| `role` | `CUSTOMER` / `STAFF` / `ADMIN` |
| `isActive` | `'true'` / `'false'` |
| `page` | Số trang (default: 1) |
| `limit` | Số bản ghi/trang (default: `LIMITS.INVENTORY` = 20, max: 100) |

Sắp theo `createdAt DESC` (người dùng mới nhất trước).

> Pagination dùng limit mặc định `LIMITS.INVENTORY` (20) thay vì `LIMITS.PRODUCT` (12) vì danh sách admin cần nhiều hơn.

### 3.3 Chi tiết người dùng

```
GET /api/admin/users/:id → findUserOrThrow(id)
```

Trả đầy đủ thông tin public user + `_count`:
- `_count.addresses` — số địa chỉ
- `_count.refreshTokens` — số session đang active

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `id` không tồn tại | 404 | `Người dùng không tồn tại` |

### 3.4 Đổi role người dùng

```
PATCH /api/admin/users/:id/role
  Body: { role: 'CUSTOMER' | 'STAFF' | 'ADMIN' }
```

**Ràng buộc:**
- Không thể đổi role của chính mình → `400` `Không thể đổi role của chính mình`
- `role` phải là giá trị hợp lệ → `400` `Role không hợp lệ. Hợp lệ: CUSTOMER, STAFF, ADMIN`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Đổi role của chính mình | 400 | `Không thể đổi role của chính mình` |
| `role` không hợp lệ | 400 | `Role không hợp lệ. Hợp lệ: CUSTOMER, STAFF, ADMIN` |
| `id` không tồn tại | 404 | `Người dùng không tồn tại` |

### 3.5 Bật / Tắt tài khoản

```
PATCH /api/admin/users/:id/status → toggleUserStatus(actorId, targetId)
```

- Đảo ngược `isActive` (`true ↔ false`)
- Không thể tự tắt tài khoản mình → `400` `Không thể khóa tài khoản của chính mình`
- Khi `isActive = false`: user vẫn tồn tại trong DB nhưng không đăng nhập được (Access Token cũ vẫn còn hiệu lực cho đến khi hết hạn 15 phút — không có blacklist token)

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Tự khóa mình | 400 | `Không thể khóa tài khoản của chính mình` |
| `id` không tồn tại | 404 | `Người dùng không tồn tại` |

### 3.6 Xóa người dùng

```
DELETE /api/admin/users/:id → deleteUser(actorId, targetId)
```

- Không thể tự xóa mình → `400` `Không thể xóa tài khoản của chính mình`
- Xóa cascade theo Prisma schema (địa chỉ, refresh token, cart, đơn hàng liên quan...)
- Trả `200` + `{ message: 'Xóa người dùng thành công' }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Tự xóa mình | 400 | `Không thể xóa tài khoản của chính mình` |
| `id` không tồn tại | 404 | `Người dùng không tồn tại` |

---

## 4. Tổng hợp tất cả endpoint Admin

### 4.1 User Management — `ADMIN` only

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/admin/users` | Danh sách users |
| `GET` | `/api/admin/users/:id` | Chi tiết user |
| `PATCH` | `/api/admin/users/:id/role` | Đổi role |
| `PATCH` | `/api/admin/users/:id/status` | Bật/tắt tài khoản |
| `DELETE` | `/api/admin/users/:id` | Xóa user |

### 4.2 Category — `STAFF+`

| Method | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/admin/categories` | Tạo danh mục |
| `PUT` | `/api/admin/categories/:id` | Cập nhật danh mục |
| `DELETE` | `/api/admin/categories/:id` | Xóa danh mục (chặn nếu còn con / sản phẩm) |

> Xem chi tiết: [category.md](./category.md)

### 4.3 Brand — `STAFF+`

| Method | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/admin/brands` | Tạo thương hiệu |
| `PUT` | `/api/admin/brands/:id` | Cập nhật thương hiệu |
| `DELETE` | `/api/admin/brands/:id` | Xóa thương hiệu (chặn nếu còn sản phẩm) |

> Xem chi tiết: [brand.md](./brand.md)

### 4.4 Tag — `STAFF+`

| Method | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/admin/tags` | Tạo tag |
| `DELETE` | `/api/admin/tags/:id` | Xóa tag (cascade ProductTag) |

> Xem chi tiết: [tag.md](./tag.md)

### 4.5 Product — `STAFF+`

| Method | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/admin/products` | Tạo sản phẩm |
| `PUT` | `/api/admin/products/:id` | Cập nhật sản phẩm |
| `DELETE` | `/api/admin/products/:id` | Xóa sản phẩm |
| `POST` | `/api/admin/products/:id/variants` | Thêm variant |
| `PUT` | `/api/admin/products/:id/variants/:variantId` | Cập nhật variant |
| `DELETE` | `/api/admin/products/:id/variants/:variantId` | Xóa variant |
| `POST` | `/api/admin/products/:id/images` | Thêm ảnh sản phẩm |
| `PATCH` | `/api/admin/products/:id/images/:imageId/cover` | Đặt ảnh bìa |
| `DELETE` | `/api/admin/products/:id/images/:imageId` | Xóa ảnh |

> Xem chi tiết: [product.md](./product.md)

### 4.6 Inventory — `STAFF+`

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/admin/inventory` | Xem tồn kho toàn bộ variant |
| `PATCH` | `/api/admin/products/:id/variants/:variantId/stock` | Điều chỉnh stock thủ công |

> Xem chi tiết tồn kho: [product.md](./product.md) — phần Inventory

### 4.7 Order — `STAFF+`

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/admin/orders` | Danh sách đơn hàng (filter, search) |
| `PATCH` | `/api/admin/orders/:id/status` | Cập nhật trạng thái đơn |
| `PATCH` | `/api/admin/orders/:id/payment-status` | Cập nhật trạng thái thanh toán |

> Xem chi tiết: [order.md](./order.md)

### 4.8 Payment Stats — `STAFF+`

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/admin/payment/stats` | Thống kê doanh thu, chờ thanh toán, hoàn tiền |

> Xem chi tiết: [payment.md](./payment.md)

### 4.9 Review — `STAFF+`

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/admin/reviews` | Danh sách đánh giá (filter status/rating/product) |
| `POST` | `/api/admin/reviews/:id/reply` | Phản hồi đánh giá |
| `DELETE` | `/api/admin/reviews/:id` | Xóa đánh giá |

> Xem chi tiết: [review.md](./review.md)

### 4.10 Banner — `STAFF+`

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/admin/banners` | Danh sách banner (gồm inactive) |
| `GET` | `/api/admin/banners/positions` | Danh sách vị trí |
| `POST` | `/api/admin/banners` | Tạo banner |
| `PUT` | `/api/admin/banners/:id` | Cập nhật banner |
| `DELETE` | `/api/admin/banners/:id` | Xóa banner |
| `PATCH` | `/api/admin/banners/:id/status` | Bật/tắt banner |

> Xem chi tiết: [banner.md](./banner.md)

---

## 5. Ma trận quyền

| Chức năng | CUSTOMER | STAFF | ADMIN |
|---|---|---|---|
| Xem trang sản phẩm / đánh giá | ✅ | ✅ | ✅ |
| Giỏ hàng / Đặt hàng / Thanh toán | ✅ | ✅ | ✅ |
| Viết / sửa đánh giá cá nhân | ✅ | ✅ | ✅ |
| Quản lý Category / Brand / Tag | ❌ | ✅ | ✅ |
| Quản lý Product / Inventory | ❌ | ✅ | ✅ |
| Quản lý Order (xem + đổi trạng thái) | ❌ | ✅ | ✅ |
| Xem Payment Stats | ❌ | ✅ | ✅ |
| Quản lý Review (reply / xóa) | ❌ | ✅ | ✅ |
| Quản lý Banner | ❌ | ✅ | ✅ |
| Quản lý Users (xem / đổi role / khóa / xóa) | ❌ | ❌ | ✅ |

---

## 6. Ràng buộc "không thể tự tác động lên chính mình"

Tất cả thao tác nhạy cảm trên user đều so sánh `actorId === targetId`:

| Thao tác | Lỗi khi tự tác động |
|---|---|
| Đổi role | `400` `Không thể đổi role của chính mình` |
| Khóa tài khoản | `400` `Không thể khóa tài khoản của chính mình` |
| Xóa tài khoản | `400` `Không thể xóa tài khoản của chính mình` |

Mục đích: tránh ADMIN vô tình tự khóa hoặc hạ cấp mình, dẫn đến mất quyền kiểm soát hệ thống.

---

## 7. Hạn chế hiện tại của hệ thống phân quyền

| Hạn chế | Ghi chú |
|---|---|
| Không có blacklist token | Khi khóa `isActive = false`, Access Token cũ vẫn hợp lệ tới khi hết hạn (15 phút) |
| Không audit log | Không ghi lại ai đã đổi role / xóa user / sửa đơn hàng |
| `STAFF` không thể bị `STAFF` khác quản lý | Chỉ `ADMIN` mới vào được `/api/admin/users` |
| Không có 2FA / IP restriction | Tài khoản ADMIN bảo vệ bởi JWT thông thường |
| Không có phân quyền chi tiết (fine-grained) | STAFF được làm tất cả tương đương ADMIN ngoại trừ User Management |

---

## 8. Sơ đồ phân quyền

```
Request đến /api/admin/*
            │
    [authenticate]
    Bearer token valid?
       No → 401
       │
      Yes → req.user = { userId, email, role }
            │
    [authorize(roles)]
    req.user.role ∈ roles?
       No → 403
       │
      Yes → Controller
            │
     ┌──────┴───────────────┐
     │                      │
  ADMIN only            STAFF+
  /admin/users        Tất cả module còn lại
     │                      │
  Quản lý users        Category, Brand, Tag,
  (CRUD, role,         Product, Inventory,
   status)             Order, Payment, Review,
                       Banner
```
