# Test Case Document
## Module: Banner
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| GET /banners (public) | 4 |
| GET /banners/positions | 2 |
| GET /admin/banners | 2 |
| POST /admin/banners | 10 |
| PUT /admin/banners/:id | 6 |
| DELETE /admin/banners/:id | 3 |
| PATCH /admin/banners/:id/status | 3 |
| Rollback Cloudinary | 2 |
| **Tổng** | **32** |

---

## TC-LIST: Danh sách banner (Public)

### TC-LIST-01: Lấy tất cả banner active (không filter)

**Precondition:** DB có HERO (active), LEFT (active), HORIZONTAL (inactive)  
**Input:** `GET /api/banners`  
**Expected:**
- HTTP: `200`
- 2 banner (HERO + LEFT)
- HORIZONTAL không có (inactive)

---

### TC-LIST-02: Lọc theo position=HERO

**Precondition:** 2 banner HERO active, 1 banner LEFT active  
**Input:** `GET /api/banners?position=HERO`  
**Expected:** Chỉ trả 2 banner HERO

---

### TC-LIST-03: Thứ tự sắp xếp — sortOrder ASC

**Precondition:** 2 banner HERO: sortOrder=2, sortOrder=0  
**Expected:** Banner sortOrder=0 đứng trước

---

### TC-LIST-04: Không cần token

**Input:** Không có Authorization header  
**Expected:** `200` (không phải `401`)

---

## TC-POSITIONS: Danh sách vị trí

### TC-POS-01: Trả đủ 4 vị trí kèm nhãn tiếng Việt

**Input:** `GET /api/banners/positions`  
**Expected:**
- `200`
- `data.positions` có đúng 4 phần tử
- Mỗi có `value` và `label` tiếng Việt
- `HERO` → `"Banner chính (full-width đầu trang)"`

---

### TC-POS-02: Response tĩnh — không phụ thuộc DB

**Expected:** Response giống nhau ở mọi lần gọi, kể cả DB rỗng

---

## TC-ADMIN-LIST: Danh sách admin

### TC-ALIST-01: Admin thấy cả banner inactive

**Precondition:** HERO (active), HORIZONTAL (inactive)  
**Input:** `GET /api/admin/banners` với STAFF token  
**Expected:** Cả 2 banner

---

### TC-ALIST-02: Admin filter theo position

**Input:** `GET /api/admin/banners?position=LEFT`  
**Expected:** Chỉ banner `position = LEFT` (kể cả inactive)

---

## TC-CREATE: Tạo banner

### TC-CREATE-01: Tạo banner HERO thành công

**Input:**
```
image=[file JPG hợp lệ]
alt=Sale tháng 6
position=HERO
href=/products?sale=true
sortOrder=0
```
**Expected:**
- HTTP: `201`
- `data.banner.position === "HERO"`
- `data.banner.imageUrl` bắt đầu `https://res.cloudinary.com/`
- `data.banner.href === "/products?sale=true"`

---

### TC-CREATE-02: `href` mặc định `/products`

**Input:** `alt=Test`, `position=LEFT`, `image=[file]` — không gửi `href`  
**Expected:** `data.banner.href === "/products"`

---

### TC-CREATE-03: `isActive` mặc định `true`

**Input:** Không gửi `isActive`  
**Expected:** `data.banner.isActive === true`

---

### TC-CREATE-04: `sortOrder` mặc định `0`

**Input:** Không gửi `sortOrder`  
**Expected:** `data.banner.sortOrder === 0`

---

### TC-CREATE-05: Thiếu file ảnh → 400

**Input:** `alt=Test`, `position=HERO` — không có file  
**Expected:** `400` — `Ảnh banner là bắt buộc`

---

### TC-CREATE-06: Thiếu `alt` → 400

**Input:** `position=HERO`, `image=[file]` — không có `alt`  
**Expected:** `400`

---

### TC-CREATE-07: `alt` < 2 ký tự → 400

**Input:** `alt=A`, `position=HERO`, `image=[file]`  
**Expected:** `400`

---

### TC-CREATE-08: Thiếu `position` → 400

**Input:** `alt=Test`, `image=[file]` — không có `position`  
**Expected:** `400` — `Vị trí banner là bắt buộc...`

---

### TC-CREATE-09: `position` sai enum → 400

**Input:** `position=INVALID`  
**Expected:** `400` — `Vị trí banner không hợp lệ. Các giá trị hợp lệ: HERO, LEFT, RIGHT, HORIZONTAL`

---

### TC-CREATE-10: Tất cả 4 position hợp lệ

**Input:** Tạo 4 banner với `position`: `HERO`, `LEFT`, `RIGHT`, `HORIZONTAL`  
**Expected:** Tất cả `201`

---

## TC-UPDATE: Cập nhật banner

### TC-UPDATE-01: Cập nhật alt và href

**Input:** `PUT /admin/banners/:id { alt: "New Alt", href: "/sale" }`  
**Expected:** `200` — `data.banner.alt === "New Alt"`, `data.banner.href === "/sale"`

---

### TC-UPDATE-02: Đổi ảnh — ghi đè ảnh cũ

**Precondition:** Banner có `imagePublicId = "old_pid"`  
**Input:** `PUT` + file ảnh mới  
**Expected:**
- `200` — `data.banner.imageUrl` thay đổi
- `destroyImage("old_pid")` được gọi nền

---

### TC-UPDATE-03: `href` gửi rỗng → set `/products`

**Input:** `{ href: "" }`  
**Expected:** `data.banner.href === "/products"`

---

### TC-UPDATE-04: `position` update hợp lệ

**Input:** `{ position: "LEFT" }`  
**Expected:** `data.banner.position === "LEFT"`

---

### TC-UPDATE-05: `position` sai enum → 400

**Input:** `{ position: "BOTTOM" }`  
**Expected:** `400`

---

### TC-UPDATE-06: Banner không tồn tại → 404

**Expected:** `404`

---

## TC-DELETE: Xóa banner

### TC-DELETE-01: Xóa thành công

**Expected:** `200` — `Xóa banner thành công`

---

### TC-DELETE-02: Banner không tồn tại → 404

**Expected:** `404`

---

### TC-DELETE-03: Ảnh bị xóa Cloudinary sau khi xóa

**Precondition:** Banner có `imagePublicId = "banners/test_img"`  
**Verify (mock):** `destroyImage("banners/test_img")` được gọi

---

## TC-STATUS: Toggle trạng thái

### TC-STATUS-01: Active → Inactive

**Expected:** `200` — `data.banner.isActive === false`

---

### TC-STATUS-02: Inactive → Active

**Expected:** `200` — `data.banner.isActive === true`

---

### TC-STATUS-03: Banner không tồn tại → 404

**Expected:** `404`

---

## TC-ROLLBACK: Cloudinary Rollback

### TC-ROLLBACK-01: Upload OK nhưng DB fail → ảnh bị xóa

**Setup:** Mock `prisma.banner.create` ném lỗi  
**Action:** `POST /admin/banners` với file hợp lệ  
**Expected:**
- Response: `500`
- `destroyImage(image.publicId)` được gọi với publicId vừa upload

---

### TC-ROLLBACK-02: Flow thành công → KHÔNG gọi rollback

**Expected:**
- `201`
- `destroyImage` KHÔNG được gọi trong `catch`

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Public chỉ thấy active | TC-LIST-01 |
| Filter theo position | TC-LIST-02 |
| sortOrder sort đúng | TC-LIST-03 |
| Không cần token (public) | TC-LIST-04 |
| 4 position đủ và đúng label | TC-POS-01 |
| Admin thấy tất cả | TC-ALIST-01 |
| Ảnh bắt buộc | TC-CREATE-05 |
| alt bắt buộc | TC-CREATE-06, TC-CREATE-07 |
| position bắt buộc | TC-CREATE-08 |
| position enum validation | TC-CREATE-09 |
| href default /products | TC-CREATE-02, TC-UPDATE-03 |
| Rollback khi DB fail | TC-ROLLBACK-01 |
| Không rollback khi thành công | TC-ROLLBACK-02 |
| Ảnh ghi đè khi update | TC-UPDATE-02 |
| Ảnh xóa khi delete | TC-DELETE-03 |
| Toggle 2 chiều | TC-STATUS-01, TC-STATUS-02 |
