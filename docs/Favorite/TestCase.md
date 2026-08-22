# Test Case Document
## Module: Favorite
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| GET /favorites (list) | 5 |
| GET /favorites/ids | 3 |
| POST /favorites (add) | 6 |
| DELETE /favorites/:productId (remove) | 4 |
| **Tổng** | **18** |

---

## TC-LIST: Xem danh sách yêu thích

### TC-LIST-01: Trả sản phẩm đã thích

**Precondition:** Customer đã thích sản phẩm `iPhone 15 Pro`  
**Input:** `GET /api/favorites`  
**Expected:**
- HTTP: `200`
- `data.favorites[0].product.name === "iPhone 15 Pro"`
- Có `brand`, `variants`, `images[0].isCover === true`

---

### TC-LIST-02: Sắp theo createdAt mới nhất trước

**Precondition:** Thích A lúc 10:00, thích B lúc 11:00  
**Expected:** B xuất hiện trước A

---

### TC-LIST-03: Sản phẩm admin ẩn không hiển thị

**Precondition:** Customer đã thích `prod-A` (isActive=true) và `prod-B` (isActive=false)  
**Expected:**
- `prod-A` có trong danh sách
- `prod-B` không có trong danh sách

---

### TC-LIST-04: Khi admin bật lại sản phẩm → xuất hiện ngay

**Precondition:** `prod-B` đang isActive=false, customer đã thích  
**Action:** Admin set `isActive=true`  
**Expected:** `GET /favorites` trả về `prod-B` (không cần thích lại)

---

### TC-LIST-05: Không có token → 401

**Input:** `GET /api/favorites` không có Authorization  
**Expected:** `401`

---

## TC-IDS: Lấy danh sách ID

### TC-IDS-01: Trả mảng productId đầy đủ

**Precondition:** Customer đã thích 3 sản phẩm  
**Input:** `GET /api/favorites/ids`  
**Expected:**
- HTTP: `200`
- `data.ids` là mảng 3 UUID
- Không có pagination

---

### TC-IDS-02: Không phân trang — trả tất cả dù nhiều

**Precondition:** Customer đã thích 200 sản phẩm  
**Expected:** `data.ids.length === 200` (không bị cắt)

---

### TC-IDS-03: Không có token → 401

**Expected:** `401`

---

## TC-ADD: Thêm yêu thích

### TC-ADD-01: Thích thành công

**Precondition:** `prod-A` isActive=true, chưa thích  
**Input:** `POST /api/favorites { "productId": "prod-A" }`  
**Expected:**
- HTTP: `200`
- `data.created === true`

---

### TC-ADD-02: Thích lần 2 (idempotent)

**Precondition:** `prod-A` đã thích  
**Input:** `POST /api/favorites { "productId": "prod-A" }`  
**Expected:**
- HTTP: `200` (không phải 409)
- `data.created === false`

---

### TC-ADD-03: Sản phẩm không tồn tại → 404

**Input:** `{ "productId": "non-exist-uuid" }`  
**Expected:** `404` `Sản phẩm không tồn tại hoặc đã ngừng bán`

---

### TC-ADD-04: Sản phẩm isActive=false → 404

**Precondition:** `prod-B` isActive=false  
**Input:** `{ "productId": "prod-B" }`  
**Expected:** `404` `Sản phẩm không tồn tại hoặc đã ngừng bán`

---

### TC-ADD-05: productId rỗng → 400

**Input:** `{ "productId": "" }`  
**Expected:** `400`

---

### TC-ADD-06: Thiếu productId → 400

**Input:** `{}`  
**Expected:** `400`

---

## TC-REMOVE: Bỏ yêu thích

### TC-REMOVE-01: Bỏ thành công

**Precondition:** Customer đã thích `prod-A`  
**Input:** `DELETE /api/favorites/prod-A`  
**Expected:**
- HTTP: `200`
- `GET /favorites` không còn `prod-A`

---

### TC-REMOVE-02: Bỏ món chưa thích (idempotent)

**Precondition:** Customer chưa từng thích `prod-X`  
**Input:** `DELETE /api/favorites/prod-X`  
**Expected:**
- HTTP: `200` (không phải 404)

---

### TC-REMOVE-03: Bỏ 2 lần liên tiếp (double-tap)

**Precondition:** Customer đã thích `prod-A`  
**Action:** Gọi DELETE 2 lần liên tiếp  
**Expected:** Cả 2 lần đều `200`

---

### TC-REMOVE-04: Không có token → 401

**Expected:** `401`

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Payload card khớp listing (brand, variants, images) | TC-LIST-01 |
| Sort mới nhất trước | TC-LIST-02 |
| Product ẩn lọc ra khỏi list | TC-LIST-03 |
| Bản ghi giữ khi ẩn → hiện lại khi bật | TC-LIST-04 |
| /ids không phân trang | TC-IDS-01, TC-IDS-02 |
| Add idempotent (P2002 → created=false, không 409) | TC-ADD-02 |
| Chặn sản phẩm ngừng bán | TC-ADD-04 |
| Remove idempotent (deleteMany, không 404) | TC-REMOVE-02, TC-REMOVE-03 |
