# Test Case Document
## Module: Category
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| GET /categories | 3 |
| GET /categories/:slug | 4 |
| GET /admin/categories | 2 |
| POST /admin/categories | 9 |
| PUT /admin/categories/:id | 8 |
| DELETE /admin/categories/:id | 5 |
| PATCH /admin/categories/:id/status | 3 |
| sortOrder logic | 3 |
| **Tổng** | **37** |

---

## TC-LIST: Danh sách danh mục (Public)

### TC-LIST-01: Lấy danh sách category active

**Precondition:** DB có "Điện thoại" (active, sortOrder=1), "Phụ kiện" (active, sortOrder=2), "Tablet" (inactive)  
**Input:** `GET /api/categories`  
**Expected:**
- HTTP: `200`
- Danh sách có 2 phần tử (Điện thoại, Phụ kiện)
- "Tablet" không có
- Thứ tự: Điện thoại trước Phụ kiện (sortOrder 1 < 2)

---

### TC-LIST-02: Không có category nào active

**Expected:** `200` — `data.categories = []`

---

### TC-LIST-03: Không cần token

**Input:** Không có Authorization header  
**Expected:** `200` (không phải `401`)

---

## TC-SLUG: Chi tiết danh mục (Public)

### TC-SLUG-01: Lấy category theo slug — trả cả children active

**Precondition:**
- "Điện thoại" (active) có 2 con: "iPhone" (active), "Oppo" (inactive)

**Input:** `GET /api/categories/dien-thoai`  
**Expected:**
- `200`
- `data.category.children` có 1 phần tử (iPhone)
- "Oppo" không có trong `children` (inactive)

---

### TC-SLUG-02: Category không có children

**Precondition:** "iPhone" không có danh mục con  
**Expected:** `200` — `data.category.children = []`

---

### TC-SLUG-03: Slug không tồn tại

**Input:** `GET /api/categories/notexist`  
**Expected:** `404` — `Danh mục không tồn tại`

---

### TC-SLUG-04: Children sắp xếp theo sortOrder

**Precondition:** "Điện thoại" có con: "Samsung" (sortOrder=2), "iPhone" (sortOrder=1)  
**Expected:** `children[0].name === "iPhone"` (sortOrder 1 < 2)

---

## TC-ADMIN-LIST: Danh sách admin

### TC-ALIST-01: Admin thấy cả category inactive

**Precondition:** "Điện thoại" (active), "Tablet" (inactive)  
**Input:** `GET /api/admin/categories` với STAFF token  
**Expected:** `200` — có cả 2

---

### TC-ALIST-02: Không có token

**Expected:** `401`

---

## TC-CREATE: Tạo danh mục

### TC-CREATE-01: Tạo root category thành công (không ảnh)

**Input:**
```
POST /admin/categories
name=Điện thoại
sortOrder=1
```
**Expected:**
- HTTP: `201`
- `data.category.parentId === null`
- `data.category.slug === "dien-thoai"`
- `data.category.sortOrder === 1`
- `data.category.imageUrl === null`

---

### TC-CREATE-02: Tạo category con (có parentId hợp lệ)

**Precondition:** Category "Điện thoại" tồn tại với id = `cat-dt`  
**Input:**
```
name=iPhone
parentId=cat-dt
sortOrder=1
```
**Expected:**
- `201`
- `data.category.parentId === "cat-dt"`

---

### TC-CREATE-03: Tạo category với ảnh

**Input:** `name=Phụ kiện` + file image JPG hợp lệ  
**Expected:**
- `201`
- `data.category.imageUrl` bắt đầu `https://res.cloudinary.com/`

---

### TC-CREATE-04: `name` < 2 ký tự

**Input:** `name=A`  
**Expected:** `400`

---

### TC-CREATE-05: Thiếu name

**Expected:** `400`

---

### TC-CREATE-06: `parentId` không tồn tại

**Input:** `name=iPhone`, `parentId=non-exist`  
**Expected:** `400` — `Danh mục cha không tồn tại`

---

### TC-CREATE-07: Slug sinh từ tên tiếng Việt

**Input:** `name=Phụ kiện`  
**Expected:** `data.category.slug === "phu-kien"`

---

### TC-CREATE-08: `isActive` mặc định `true`

**Input:** `name=TestCat` (không gửi `isActive`)  
**Expected:** `data.category.isActive === true`

---

### TC-CREATE-09: `sortOrder` mặc định `0`

**Input:** `name=TestCat` (không gửi `sortOrder`)  
**Expected:** `data.category.sortOrder === 0`

---

## TC-UPDATE: Cập nhật danh mục

### TC-UPDATE-01: Cập nhật name thành công

**Input:** `PUT /admin/categories/:id { name: "Điện tử" }`  
**Expected:** `200` — `data.category.name === "Điện tử"`

---

### TC-UPDATE-02: Cập nhật sortOrder

**Input:** `{ sortOrder: 5 }`  
**Expected:** `data.category.sortOrder === 5`

---

### TC-UPDATE-03: Cập nhật ảnh — ghi đè ảnh cũ

**Precondition:** Category có `imagePublicId = "old_pid"`  
**Input:** `PUT` + file ảnh mới  
**Expected:**
- `200` — `data.category.imageUrl` là URL mới
- `destroyImage("old_pid")` được gọi nền

---

### TC-UPDATE-04: Di chuyển sang parentId khác

**Precondition:** "iPhone" có `parentId = "cat-dt"`, có category "Phụ kiện" với id `cat-pk`  
**Input:** `{ parentId: "cat-pk" }`  
**Expected:** `data.category.parentId === "cat-pk"`

---

### TC-UPDATE-05: Self-parent bị từ chối

**Input:** `PUT /admin/categories/cat-dt { parentId: "cat-dt" }`  
**Expected:** `400` — `Danh mục không thể là cha của chính nó`

---

### TC-UPDATE-06: parentId không tồn tại

**Input:** `{ parentId: "non-exist" }`  
**Expected:** `400` — `Danh mục cha không tồn tại`

---

### TC-UPDATE-07: ID không tồn tại

**Input:** `PUT /admin/categories/non-exist-id ...`  
**Expected:** `404`

---

### TC-UPDATE-08: Slug update không tự trùng chính mình

**Precondition:** Category "iPhone" có `slug = "iphone"`  
**Input:** `PUT` với `slug = "iphone"` (giữ nguyên)  
**Expected:** `200` — vẫn giữ `slug = "iphone"` (không thành `iphone-1`)

---

## TC-DELETE: Xóa danh mục

### TC-DELETE-01: Xóa thành công (leaf category)

**Precondition:** Category không có con, không có sản phẩm  
**Expected:** `200` — `Xóa danh mục thành công`

---

### TC-DELETE-02: Bị chặn — còn danh mục con

**Precondition:** Category có ít nhất 1 category con  
**Expected:** `409` — `Không thể xóa: danh mục còn chứa danh mục con`

---

### TC-DELETE-03: Bị chặn — còn sản phẩm

**Precondition:** Category có ít nhất 1 sản phẩm, không có con  
**Expected:** `409` — `Không thể xóa: danh mục còn chứa sản phẩm`

---

### TC-DELETE-04: ID không tồn tại

**Expected:** `404`

---

### TC-DELETE-05: Ảnh bị xóa sau khi xóa category

**Precondition:** Category có `imagePublicId = "categories/test_img"`  
**Action:** Xóa thành công  
**Verify (mock):** `destroyImage("categories/test_img")` được gọi

---

## TC-STATUS: Toggle trạng thái

### TC-STATUS-01: Active → Inactive

**Precondition:** Category `isActive = true`  
**Action:** `PATCH /admin/categories/:id/status`  
**Expected:** `data.category.isActive === false`

---

### TC-STATUS-02: Inactive → Active

**Precondition:** Category `isActive = false`  
**Expected:** `data.category.isActive === true`

---

### TC-STATUS-03: ID không tồn tại

**Expected:** `404`

---

## TC-SORT: sortOrder Logic

### TC-SORT-01: Danh sách sắp đúng sortOrder

**Precondition:**
- "Phụ kiện" sortOrder=2
- "Điện thoại" sortOrder=1
- "Tablet" sortOrder=3

**Expected:** Thứ tự: Điện thoại (1) → Phụ kiện (2) → Tablet (3)

---

### TC-SORT-02: Cùng sortOrder thì sắp theo name A→Z

**Precondition:**
- "Sạc" sortOrder=0
- "Ốp lưng" sortOrder=0
- "Tai nghe" sortOrder=0

**Expected:** Thứ tự: Ốp lưng → Sạc → Tai nghe (A→Z)

---

### TC-SORT-03: Children trong chi tiết cũng sắp theo sortOrder

**Precondition:** Children: "Samsung" (sortOrder=2), "iPhone" (sortOrder=1)  
**Expected:** `children[0].name === "iPhone"`

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Public chỉ thấy active | TC-LIST-01 |
| Admin thấy tất cả | TC-ALIST-01 |
| Chi tiết bao gồm children active | TC-SLUG-01 |
| Children inactive bị lọc | TC-SLUG-01 |
| parentId không tồn tại → 400 | TC-CREATE-06 |
| Self-parent → 400 | TC-UPDATE-05 |
| Xóa bị chặn — còn con | TC-DELETE-02 |
| Xóa bị chặn — còn sản phẩm | TC-DELETE-03 |
| Ảnh cleanup khi xóa | TC-DELETE-05 |
| Ảnh ghi đè khi update | TC-UPDATE-03 |
| sortOrder sort đúng | TC-SORT-01 |
| Cùng sortOrder → sort name A→Z | TC-SORT-02 |
| Slug sinh từ tên VN | TC-CREATE-07 |
| Slug update không tự trùng | TC-UPDATE-08 |
| isActive default true | TC-CREATE-08 |
| sortOrder default 0 | TC-CREATE-09 |
