# SRS — Software Requirement Specification
## Module: Tag
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19 | **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Phạm vi

Module Tag cung cấp 3 operations:
- **Public** (`/api/tags`): `GET` list
- **Admin** (`/api/admin/tags`): `GET` list, `POST` create, `DELETE` by id

**Không có:** update, toggle status, upload ảnh, pagination.

---

## 2. Yêu cầu chức năng

### FR-01: Danh sách tag (Public & Admin)

| | |
|---|---|
| **Endpoint** | `GET /api/tags` _(public)_ và `GET /api/admin/tags` _(admin)_ |
| **Auth** | Public: ❌ &nbsp;&nbsp; Admin: ✅ STAFF+ |

> Cả hai endpoint dùng **cùng một controller** `listTags` — response giống hệt nhau.

**Xử lý:**
```
prisma.tag.findMany({
  orderBy: { name: 'asc' },
  include: { _count: { select: { productTags: true } } }
})
```

**Response:** `200` + `{ tags: Tag[] }` — mỗi tag có thêm `_count: { productTags: N }`

---

### FR-02: Tạo tag

| | |
|---|---|
| **Endpoint** | `POST /api/admin/tags` |
| **Auth** | ✅ STAFF+ |
| **Content-Type** | `application/json` |

**Body:**

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | ✅ | ≥ **1** ký tự sau trim |
| `slug` | string | ❌ | Tự sinh từ `name` nếu không gửi |

**Xử lý:**
1. Validate `name` ≥ 1 ký tự (`checkName(res, name, 'Tên tag', { min: 1 })`)
2. `name.trim()` → kiểm tra unique: `tag.findUnique({ where: { name: trimmed } })`
3. Nếu tồn tại → `409 'Tag đã tồn tại'`
4. `generateUniqueSlug(slug || trimmed, slugTaken(findBySlug))`
5. `prisma.tag.create({ data: { name: trimmed, slug: finalSlug } })`

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `name` rỗng / thiếu | 400 | `Tên tag phải có ít nhất 1 ký tự` |
| `name` đã tồn tại | 409 | `Tag đã tồn tại` |

---

### FR-03: Xóa tag

| | |
|---|---|
| **Endpoint** | `DELETE /api/admin/tags/:id` |
| **Auth** | ✅ STAFF+ |

**Xử lý:**
1. `tag.findUnique({ where: { id } })` — `404` nếu không tồn tại
2. `prisma.tag.delete({ where: { id } })`
3. DB cascade: `ProductTag` records có `tagId = id` bị xóa tự động (`onDelete: Cascade`)

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không tồn tại | 404 | `Tag không tồn tại` |

> **Không có guard sản phẩm:** Khác Category và Brand, xóa Tag KHÔNG bị chặn bởi việc tag đang được gắn vào sản phẩm. `ProductTag.onDelete: Cascade` đảm bảo tất cả liên kết bị xóa tự động.

---

## 3. Không có endpoint Update

Tag không có `PUT` hay `PATCH`. Lý do thiết kế:

- Tag đơn giản — nếu tên sai thì xóa rồi tạo lại
- Không có ảnh hay trường phức tạp cần sửa
- Việc đổi tên tag ảnh hưởng tất cả sản phẩm dùng tag đó — xóa/tạo mới an toàn hơn vì admin kiểm soát được

---

## 4. Cơ chế Cascade khi xóa Tag

```
Tag (id=X) bị xóa
    ↓ DB CASCADE
ProductTag records (tagId=X) bị xóa tự động
    ↓ Effect
Tất cả sản phẩm không còn thấy tag X trong danh sách tags của mình
```

Khác Category/Brand (kiểm tra app-level), xóa Tag dùng **DB-level cascade** — nhanh hơn và không cần thêm query đếm.

---

## 5. Cơ chế `_count`

`getTags()` trả kèm:
```json
"_count": { "productTags": 42 }
```

Cho phép admin biết tag nào đang được dùng nhiều trước khi quyết định xóa.

---

## 6. Yêu cầu phi chức năng

| | |
|---|---|
| **Đơn giản** | Ít field nhất trong tất cả các module (chỉ `id`, `name`, `slug`) |
| **Không có `isActive`** | Tag luôn hiển thị; không thể ẩn |
| **Name unique** | Case-sensitive sau trim — "Hot" và "hot" là 2 tag khác nhau |
| **Không có `createdAt`/`updatedAt`** | Schema không có trường này |

---

## 7. Schema dữ liệu

### Bảng `Tag`

| Trường | Kiểu | Nullable | Unique | Ghi chú |
|---|---|---|---|---|
| `id` | string (uuid) | No | PK | Auto-generated |
| `name` | string | No | Yes | Trim trước khi lưu |
| `slug` | string | No | Yes | URL-safe |

### Bảng `ProductTag` (junction table)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `productId` | string | FK → Product; `onDelete: Cascade` |
| `tagId` | string | FK → Tag; `onDelete: Cascade` |
| Composite PK | `(productId, tagId)` | Ngăn trùng lặp |
