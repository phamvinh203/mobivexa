# Use Case Document
## Module: Favorite
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## 1. Actors

| Actor | Mô tả |
|---|---|
| **Customer** | Khách đã đăng nhập — toàn bộ thao tác yêu thích |
| **PostgreSQL** | Cascade xóa Favorite khi User hoặc Product bị xóa |

---

## 2. Danh sách Use Case

| ID | Tên | Actor | Ưu tiên |
|---|---|---|---|
| UC-01 | Xem danh sách yêu thích | Customer | Cao |
| UC-02 | Lấy danh sách ID yêu thích | Customer | Cao |
| UC-03 | Thêm yêu thích | Customer | Cao |
| UC-04 | Bỏ yêu thích | Customer | Cao |

> **Không có:** quản lý admin, chia sẻ wishlist, thích theo variant.

---

## 3. Chi tiết Use Case

---

### UC-01: Xem danh sách yêu thích

| | |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Xem và mua lại sản phẩm đã đánh dấu |
| **Tiền điều kiện** | Đã đăng nhập |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/favorites?page=1&limit=20`
2. Query `Favorite` của userId, lọc `product.isActive=true`
3. Sắp theo `createdAt DESC`
4. Trả danh sách product với brand, variants (active), ảnh bìa

**Đặc điểm:**
- Sản phẩm admin ẩn không xuất hiện nhưng bản ghi giữ
- Payload card khớp với trang listing (cùng component)

---

### UC-02: Lấy danh sách ID yêu thích

| | |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Tô tim đúng trên mọi card sản phẩm |
| **Tiền điều kiện** | Đã đăng nhập |
| **Hậu điều kiện** | Không thay đổi dữ liệu |

**Luồng chính:**
1. `GET /api/favorites/ids`
2. Query toàn bộ `productId` của userId (chỉ cột này)
3. Trả `{ ids: [...] }`

**Không phân trang** — FE cần toàn bộ mảng để đối chiếu.

---

### UC-03: Thêm yêu thích

| | |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Đánh dấu sản phẩm để xem lại sau |
| **Tiền điều kiện** | Đã đăng nhập; sản phẩm đang bán |
| **Hậu điều kiện** | Bản ghi Favorite tạo mới trong DB |

**Luồng chính:**
1. `POST /api/favorites { productId }`
2. Validate `productId`
3. Kiểm tra product tồn tại và `isActive=true`
4. `favorite.create({ userId, productId })`
5. Trả `{ created: true }`

**Luồng thay thế:**

| Bước | Điều kiện | Xử lý |
|---|---|---|
| 2 | `productId` rỗng/thiếu | `400` |
| 3 | Product không tồn tại hoặc isActive=false | `404` `Sản phẩm không tồn tại hoặc đã ngừng bán` |
| 4 | Đã thích rồi (P2002) | `{ created: false }` — **không 409** |

> **Idempotent:** double-tap trả `{created: false}`, FE xử lý bình thường.

---

### UC-04: Bỏ yêu thích

| | |
|---|---|
| **Actor** | Customer |
| **Mục tiêu** | Xóa sản phẩm khỏi danh sách yêu thích |
| **Tiền điều kiện** | Đã đăng nhập |
| **Hậu điều kiện** | Bản ghi Favorite bị xóa (nếu tồn tại) |

**Luồng chính:**
1. `DELETE /api/favorites/:productId`
2. `favorite.deleteMany({ where: { userId, productId } })`
3. Trả `200`

**Đặc điểm:**
- **Idempotent:** productId chưa từng thích → `count=0`, không ném lỗi
- Không cần validate product tồn tại

---

## 4. Quan hệ Use Cases

```
UC-03 Thêm ──► Favorite record trong DB
                     │
              UC-01 Danh sách (có phân trang)
              UC-02 IDs (không phân trang, tô tim)
                     │
              UC-04 Bỏ ──► Xóa bản ghi
                     │
              Admin ẩn product:
                Favorite record GIỮ NGUYÊN
                UC-01 tự lọc product.isActive=false
                Admin bật lại → UC-01 hiển thị lại tự động
```

---

## 5. So sánh với module khác

| Tiêu chí | Favorite | Cart | Order |
|---|---|---|---|
| Gắn theo | Product | ProductVariant | ProductVariant |
| Idempotent add | ✅ (P2002 = OK) | Tăng quantity | ❌ (tạo đơn mới) |
| Idempotent remove | ✅ (deleteMany) | Giảm/xóa item | Chỉ hủy đơn |
| Admin quản lý | ❌ | ❌ | ✅ |
| Pagination | ✅ (list) + ❌ (/ids) | ❌ (toàn bộ) | ✅ |
