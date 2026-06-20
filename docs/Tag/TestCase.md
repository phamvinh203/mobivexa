# Test Case Document
## Module: Tag
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| GET /tags (public) | 3 |
| GET /admin/tags | 2 |
| POST /admin/tags | 7 |
| DELETE /admin/tags/:id | 4 |
| Slug generation | 3 |
| **Tổng** | **19** |

---

## TC-LIST: Danh sách tag (Public)

### TC-LIST-01: Lấy danh sách tag — sắp A→Z

**Precondition:** DB có "Hot", "5G", "Gaming"  
**Input:** `GET /api/tags`  
**Expected:**
- HTTP: `200`
- Thứ tự: `5G → Gaming → Hot` (A→Z)
- Mỗi tag có `_count.productTags`

---

### TC-LIST-02: Tag có `_count` đúng số sản phẩm

**Precondition:** Tag "5G" đang gắn vào 3 sản phẩm  
**Expected:** Response có tag với `_count.productTags === 3`

---

### TC-LIST-03: Không cần token

**Input:** `GET /api/tags` — không có Authorization header  
**Expected:** `200` (không phải 401)

---

## TC-ADMIN-LIST: Danh sách tag (Admin)

### TC-ALIST-01: Response giống public

**Precondition:** Cùng DB state  
**Input:** `GET /api/admin/tags` với STAFF token  
**Expected:** Response giống hệt `GET /api/tags` (cùng tags, cùng thứ tự)

---

### TC-ALIST-02: Không có token

**Expected:** `401`

---

## TC-CREATE: Tạo tag

### TC-CREATE-01: Tạo tag thành công

**Input:**
```json
{ "name": "Pin khủng" }
```
**Expected:**
- HTTP: `201`
- `data.tag.name === "Pin khủng"`
- `data.tag.slug === "pin-khung"`

---

### TC-CREATE-02: Tên 1 ký tự được chấp nhận (min=1)

**Input:** `{ "name": "X" }`  
**Expected:** `201` — tag tạo thành công

---

### TC-CREATE-03: Tên rỗng bị từ chối

**Input:** `{ "name": "" }`  
**Expected:** `400` — `Tên tag phải có ít nhất 1 ký tự`

---

### TC-CREATE-04: Thiếu field name

**Input:** `{}`  
**Expected:** `400`

---

### TC-CREATE-05: Tên đã tồn tại → 409

**Precondition:** Tag "Hot" đã có  
**Input:** `{ "name": "Hot" }`  
**Expected:** `409` — `Tag đã tồn tại`

---

### TC-CREATE-06: Tên sau trim trùng

**Precondition:** Tag "Hot" đã có  
**Input:** `{ "name": "  Hot  " }` (có khoảng trắng)  
**Expected:** `409` — trim → "Hot" → trùng

---

### TC-CREATE-07: Slug tùy chỉnh được gửi lên

**Input:** `{ "name": "5G", "slug": "5g-network" }`  
**Expected:** `data.tag.slug === "5g-network"`

---

## TC-DELETE: Xóa tag

### TC-DELETE-01: Xóa tag thành công

**Precondition:** Tag "Hot" tồn tại, không gắn sản phẩm nào  
**Expected:** `200` — `Xóa tag thành công`

---

### TC-DELETE-02: Xóa tag đang dùng (không bị chặn — cascade)

**Precondition:** Tag "5G" gắn vào 5 sản phẩm  
**Action:** `DELETE /api/admin/tags/tag-5g`  
**Expected:**
- `200` — xóa thành công (không bị 409 như Brand/Category)
- `ProductTag` records có `tagId="tag-5g"` bị xóa tự động
- Các sản phẩm vẫn tồn tại, chỉ không còn tag "5G"

---

### TC-DELETE-03: ID không tồn tại

**Input:** `DELETE /api/admin/tags/non-exist-id`  
**Expected:** `404` — `Tag không tồn tại`

---

### TC-DELETE-04: Cascade được kiểm chứng

**Precondition:** Tag "Hot" gắn vào sản phẩm `prod-1`  
**Action:** Xóa tag "Hot"  
**Verify:** `ProductTag.count({ where: { tagId: "tag-hot" } }) === 0`

---

## TC-SLUG-GEN: Slug Generation

### TC-SLUG-GEN-01: Tên tiếng Việt

| Input `name` | Expected `slug` |
|---|---|
| `"Pin khủng"` | `pin-khung` |
| `"Mới nhất"` | `moi-nhat` |
| `"Đặc biệt"` | `dac-biet` |

---

### TC-SLUG-GEN-02: Slug thêm hậu tố khi trùng

**Precondition:** `hot` đã có trong DB  
**Input:** Tạo tag `name=Hot` (không gửi slug)  
**Expected:** `data.tag.slug === "hot-1"`

---

### TC-SLUG-GEN-03: Slug tùy chỉnh khi bị trùng cũng thêm hậu tố

**Precondition:** `5g-network` đã có  
**Input:** `{ "name": "5G Pro", "slug": "5g-network" }`  
**Expected:** `data.tag.slug === "5g-network-1"`

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| List trả tất cả (không filter active) | TC-LIST-01 |
| `_count.productTags` đúng | TC-LIST-02 |
| Không cần token (public) | TC-LIST-03 |
| Public = Admin response | TC-ALIST-01 |
| Tên min 1 ký tự | TC-CREATE-02 |
| Tên unique (create) | TC-CREATE-05 |
| Trim trước khi check unique | TC-CREATE-06 |
| Xóa không bị guard bởi sản phẩm | TC-DELETE-02 |
| Cascade xóa ProductTag | TC-DELETE-04 |
| Slug sinh từ tên VN | TC-SLUG-GEN-01 |
| Slug thêm hậu tố khi trùng | TC-SLUG-GEN-02 |
