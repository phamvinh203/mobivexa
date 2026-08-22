# SRS — Software Requirement Specification
## Module: Favorite
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22 | **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Endpoints tổng quan

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/favorites` | Customer | Danh sách sản phẩm yêu thích (paginated) |
| GET | `/api/favorites/ids` | Customer | Mảng productId[] (không phân trang) |
| POST | `/api/favorites` | Customer | Thêm yêu thích |
| DELETE | `/api/favorites/:productId` | Customer | Bỏ yêu thích |

**Không có endpoint Admin.** Tất cả route đều yêu cầu `authenticate`.

---

## 2. Schema dữ liệu

### Bảng `Favorite`

| Trường | Kiểu | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| `userId` | string | No | — | FK → User; onDelete: Cascade |
| `productId` | string | No | — | FK → Product; onDelete: Cascade |
| `createdAt` | DateTime | No | now() | |

- **Composite PK: `(userId, productId)`** — DB chặn thêm trùng (P2002)
- **Index: `(userId, createdAt)`** — tối ưu query "danh sách của user, sắp mới nhất"

---

## 3. Yêu cầu chức năng

### FR-01: Danh sách yêu thích (paginated)

| | |
|---|---|
| **Endpoint** | `GET /api/favorites` |
| **Auth** | ✅ Customer |

**Điều kiện lọc:** `userId = req.user.id AND product.isActive = true`  
**Sắp xếp:** `createdAt DESC` (thích gần đây nhất trước)  
**Phân trang:** `page`, `limit` — dùng `LIMITS.PRODUCT`

**Payload mỗi sản phẩm (FAVORITE_PRODUCT_SELECT):**
```
product.id, name, slug
product.brand: { id, name, slug }
product.variants: WHERE isActive=true ORDER BY salePrice ASC
product.images: WHERE isCover=true TAKE 1
```

> Payload khớp với `listProducts` — FE dùng lại component card.

**Sản phẩm admin ẩn:** bản ghi `Favorite` giữ nguyên trong DB, product bị lọc ra khỏi response. Khi admin bật lại → tự động hiện.

---

### FR-02: Danh sách productId (không phân trang)

| | |
|---|---|
| **Endpoint** | `GET /api/favorites/ids` |
| **Auth** | ✅ Customer |

**Xử lý:**
```
prisma.favorite.findMany({ where: { userId }, select: { productId: true } })
→ rows.map(r => r.productId)
```

**Response:** `{ ids: ["uuid1", "uuid2", ...] }`

**Lý do không phân trang:** FE cần TOÀN BỘ danh sách để tô tim đúng trên mọi card trên trang listing. Trả một trang là tô thiếu. Payload chỉ vài KB dù khách thích vài trăm sản phẩm.

---

### FR-03: Thêm yêu thích

| | |
|---|---|
| **Endpoint** | `POST /api/favorites` |
| **Auth** | ✅ Customer |

**Body:**
| Field | Type | Required | Validation |
|---|---|---|---|
| `productId` | string | ✅ | `checkId` (non-empty string) |

**Xử lý:**
1. Validate `productId`
2. `product.findUnique(productId)` — kiểm tra `isActive`
3. Nếu product không tồn tại hoặc `isActive=false` → **404** `Sản phẩm không tồn tại hoặc đã ngừng bán`
4. `favorite.create({ userId, productId })`
5. Nếu P2002 (đã thích rồi) → trả `{ created: false }` — **không 409**

**Response:**
- Thích mới: `{ created: true }`
- Đã thích rồi: `{ created: false }`

> **Idempotent:** double-tap bình thường, FE không phải xử lý lỗi.

---

### FR-04: Bỏ yêu thích

| | |
|---|---|
| **Endpoint** | `DELETE /api/favorites/:productId` |
| **Auth** | ✅ Customer |

**Xử lý:**
```
prisma.favorite.deleteMany({ where: { userId, productId } })
```

**Idempotent:** Bỏ món chưa từng thích → `count=0`, không ném lỗi.  
**Response:** `200` (không có body cụ thể)

---

## 4. Yêu cầu phi chức năng

| | |
|---|---|
| **Idempotency** | add: P2002 → `{created:false}`; remove: deleteMany |
| **Consistency** | Product ẩn tự lọc khỏi list, bản ghi giữ nguyên |
| **Performance** | `/ids` không phân trang — payload nhỏ, FE cần toàn bộ |
| **Shape nhất quán** | FAVORITE_PRODUCT_SELECT khớp listProducts để FE dùng lại card |
| **Index** | `(userId, createdAt)` phục vụ trọn query sort |
