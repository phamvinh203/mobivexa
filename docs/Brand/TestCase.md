# Test Case Document
## Module: Brand
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| GET /brands | 3 |
| GET /brands/:slug | 3 |
| GET /admin/brands | 2 |
| POST /admin/brands | 8 |
| PUT /admin/brands/:id | 6 |
| DELETE /admin/brands/:id | 4 |
| PATCH /admin/brands/:id/status | 3 |
| Slug generation | 4 |
| **Tổng** | **33** |

---

## TC-LIST: Danh sách thương hiệu (Public)

### TC-LIST-01: Lấy danh sách brand active

**Precondition:** DB có Apple (active), Samsung (active), Xiaomi (inactive)  
**Input:** `GET /api/brands`  
**Expected:**
- HTTP: `200`
- `data.brands` có 2 phần tử (Apple, Samsung)
- Xiaomi **không** có trong danh sách
- Sắp xếp A→Z: Apple trước Samsung

---

### TC-LIST-02: Không có brand nào active

**Precondition:** Tất cả brand đều inactive  
**Expected:** `200` — `data.brands = []`

---

### TC-LIST-03: Không cần token

**Input:** `GET /api/brands` — không có Authorization header  
**Expected:** `200` (không phải 401)

---

## TC-SLUG: Chi tiết thương hiệu (Public)

### TC-SLUG-01: Lấy brand theo slug hợp lệ

**Input:** `GET /api/brands/apple`  
**Expected:** `200` — `data.brand.slug === "apple"`, `data.brand.name === "Apple"`

---

### TC-SLUG-02: Slug không tồn tại

**Input:** `GET /api/brands/notexist`  
**Expected:** `404` — `Thương hiệu không tồn tại`

---

### TC-SLUG-03: Brand inactive vẫn trả về theo slug (public endpoint dùng findUnique không lọc isActive)

**Precondition:** Brand "Xiaomi" với `isActive = false`  
**Input:** `GET /api/brands/xiaomi`  
**Expected:** `200` — brand được trả về dù inactive  
> *(Hành vi này cần xác nhận lại với business — hiện tại code `getBrandBySlug` không filter `isActive`)*

---

## TC-ADMIN-LIST: Danh sách admin

### TC-ALIST-01: Admin thấy cả brand inactive

**Precondition:** DB có Apple (active), Xiaomi (inactive)  
**Input:** `GET /api/admin/brands` với STAFF token  
**Expected:** `200` — danh sách chứa cả 2 brand

---

### TC-ALIST-02: Không có token

**Expected:** `401`

---

## TC-CREATE: Tạo thương hiệu

### TC-CREATE-01: Tạo brand thành công không có logo

**Input:**
```
POST /api/admin/brands
name=TestBrand
description=Mô tả
isActive=true
```
**Expected:**
- HTTP: `201`
- `data.brand.name === "TestBrand"`
- `data.brand.slug === "testbrand"`
- `data.brand.logoUrl === null`

---

### TC-CREATE-02: Tạo brand có logo

**Input:** Form có `name=LogoBrand` + file JPEG hợp lệ field `logo`  
**Expected:**
- HTTP: `201`
- `data.brand.logoUrl` bắt đầu bằng `https://res.cloudinary.com/`
- `data.brand.logoPublicId` không null

---

### TC-CREATE-03: Tên đã tồn tại

**Precondition:** Brand "Apple" đã có  
**Input:** `name=Apple`  
**Expected:** `409` — `Tên thương hiệu đã tồn tại`

---

### TC-CREATE-04: Tên < 2 ký tự

**Input:** `name=A`  
**Expected:** `400` — `Tên thương hiệu phải có ít nhất 2 ký tự`

---

### TC-CREATE-05: Thiếu name

**Input:** (không gửi name)  
**Expected:** `400`

---

### TC-CREATE-06: isActive mặc định true

**Input:** `name=NewBrand` (không gửi `isActive`)  
**Expected:** `data.brand.isActive === true`

---

### TC-CREATE-07: Slug tự sinh từ tên tiếng Việt

**Input:** `name=Thương hiệu Việt`  
**Expected:** `data.brand.slug === "thuong-hieu-viet"`

---

### TC-CREATE-08: Slug tùy chỉnh được gửi lên

**Input:** `name=Brand A`, `slug=custom-slug`  
**Expected:** `data.brand.slug === "custom-slug"`

---

## TC-UPDATE: Cập nhật thương hiệu

### TC-UPDATE-01: Cập nhật name thành công

**Input:** `PUT /api/admin/brands/:id { name: "New Name" }`  
**Expected:** `200` — `data.brand.name === "New Name"`

---

### TC-UPDATE-02: Cập nhật logo — ghi đè logo cũ

**Precondition:** Brand đã có logo (logoPublicId = "old_pid")  
**Input:** `PUT /api/admin/brands/:id` + file logo mới  
**Expected:**
- `200`
- `data.brand.logoUrl` là URL mới (khác cũ)
- Logo cũ (`old_pid`) được gọi `destroyImage` ở nền

---

### TC-UPDATE-03: Không gửi gì — chỉ update `updatedAt`

**Input:** `PUT /api/admin/brands/:id` với body rỗng  
**Expected:** `200` — brand trả về, không có lỗi

---

### TC-UPDATE-04: Tên mới trùng brand khác

**Precondition:** "Samsung" đã tồn tại  
**Input:** `PUT /api/admin/brands/apple_id { name: "Samsung" }`  
**Expected:** `409`

---

### TC-UPDATE-05: Tên mới giống tên hiện tại (update chính mình)

**Precondition:** Brand "Apple" đang có id = `apple_id`  
**Input:** `PUT /api/admin/brands/apple_id { name: "Apple" }`  
**Expected:** `200` — không bị `409` (exclude chính mình khi check)

---

### TC-UPDATE-06: Brand không tồn tại

**Input:** `PUT /api/admin/brands/non_exist_id ...`  
**Expected:** `404`

---

## TC-DELETE: Xóa thương hiệu

### TC-DELETE-01: Xóa thành công (không có sản phẩm)

**Precondition:** Brand tồn tại, không có Product nào  
**Expected:** `200` — `Xóa thương hiệu thành công`

---

### TC-DELETE-02: Xóa bị chặn — còn sản phẩm

**Precondition:** Brand có ít nhất 1 Product  
**Expected:** `409` — `Không thể xóa: thương hiệu còn chứa sản phẩm`

---

### TC-DELETE-03: Brand không tồn tại

**Expected:** `404`

---

### TC-DELETE-04: Logo bị xóa sau khi xóa brand

**Precondition:** Brand có `logoPublicId = "brands/test_logo"`  
**Action:** Xóa brand thành công  
**Verify (mock):** `destroyImage("brands/test_logo")` được gọi

---

## TC-STATUS: Toggle trạng thái

### TC-STATUS-01: Active → Inactive

**Precondition:** Brand `isActive = true`  
**Action:** `PATCH /api/admin/brands/:id/status`  
**Expected:** `200` — `data.brand.isActive === false`

---

### TC-STATUS-02: Inactive → Active

**Precondition:** Brand `isActive = false`  
**Action:** `PATCH /api/admin/brands/:id/status`  
**Expected:** `200` — `data.brand.isActive === true`

---

### TC-STATUS-03: Brand không tồn tại

**Expected:** `404`

---

## TC-SLUG-GEN: Slug Generation

### TC-SLUG-GEN-01: Slug từ tên thuần ASCII

| Input `name` | Expected `slug` |
|---|---|
| `"Apple"` | `apple` |
| `"Apple Inc."` | `apple-inc` |
| `"  Samsung  "` | `samsung` (trim) |

---

### TC-SLUG-GEN-02: Slug từ tên có dấu tiếng Việt

| Input `name` | Expected `slug` |
|---|---|
| `"Thương hiệu Việt"` | `thuong-hieu-viet` |
| `"Điện thoại xịn"` | `dien-thoai-xin` |

---

### TC-SLUG-GEN-03: Slug tự thêm hậu tố khi trùng

**Precondition:** `apple` đã có trong DB  
**Input:** Tạo brand mới với `name=Apple` (không gửi slug)  
**Expected:** `data.brand.slug === "apple-1"`

**Precondition:** `apple` và `apple-1` đều có  
**Expected:** `data.brand.slug === "apple-2"`

---

### TC-SLUG-GEN-04: Update slug — không tự trùng chính mình

**Precondition:** Brand "Apple" đang có `slug = "apple"`  
**Input:** `PUT` với `slug = "apple"` (giữ nguyên)  
**Expected:** `200` — không tạo `apple-1` mà giữ `apple`

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Public chỉ thấy active | TC-LIST-01 |
| Admin thấy tất cả | TC-ALIST-01 |
| Name unique (tạo) | TC-CREATE-03 |
| Name unique (sửa, loại trừ chính mình) | TC-UPDATE-05 |
| Slug sinh từ tên VN | TC-CREATE-07, TC-SLUG-GEN-02 |
| Slug thêm hậu tố khi trùng | TC-SLUG-GEN-03 |
| Slug update không tự trùng | TC-SLUG-GEN-04 |
| Xóa bị chặn khi còn product | TC-DELETE-02 |
| Logo cleanup khi xóa | TC-DELETE-04 |
| Logo ghi đè khi update | TC-UPDATE-02 |
| Toggle 2 chiều | TC-STATUS-01, TC-STATUS-02 |
