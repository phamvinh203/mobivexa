# Nghiệp vụ Tag (Nhãn sản phẩm) — Mobivexa

> **Phạm vi:** `src/services/tag.service.ts`, `src/controllers/tag.controller.ts`, `src/routes/tag.route.ts`, `src/validators/tag.validator.ts`
>
> **Cập nhật:** 2026-06-19

---

## 1. Tổng quan

Module Tag quản lý **nhãn gắn vào sản phẩm** (ví dụ: "Mới", "Hot", "Sale", "Bán chạy"). Tag là thực thể đơn giản nhất trong hệ thống — không có trạng thái, không có ảnh, không có quan hệ cha–con.

Mối quan hệ giữa Tag và Product là **nhiều–nhiều** thông qua bảng trung gian `ProductTag`. Khi xóa một tag, tất cả liên kết với sản phẩm được tự động xóa theo (`onDelete: Cascade`).

---

## 2. Danh sách endpoint

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/api/tags` | Lấy danh sách tag (kèm số sản phẩm) | ❌ Public |
| `GET` | `/api/admin/tags` | Lấy danh sách tag (dùng cùng handler public) | ✅ STAFF+ |
| `POST` | `/api/admin/tags` | Tạo tag mới | ✅ STAFF+ |
| `DELETE` | `/api/admin/tags/:id` | Xóa tag | ✅ STAFF+ |

> **Lưu ý:** Không có endpoint cập nhật tag — nếu cần đổi tên phải xóa và tạo lại.

---

## 3. Chính sách & Ràng buộc nghiệp vụ

### 3.1 Dữ liệu đầu vào

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| `name` | ✅ | Tối thiểu **1 ký tự** (sau trim); unique trong toàn hệ thống |
| `slug` | ❌ | Tự sinh từ `name` nếu không gửi; phải duy nhất |

> Tag có yêu cầu `name` tối thiểu **1 ký tự** (khác với Category và Brand yêu cầu 2 ký tự).

### 3.2 Quy tắc Tên (Name)

- `name` phải **unique** — không cho phép 2 tag cùng tên (sau trim)
- So sánh exact match: `"Hot"` và `"hot"` được coi là **khác nhau** (DB level)

### 3.3 Quy tắc Slug

- Tự động sinh từ `name` nếu không truyền
- Hỗ trợ tiếng Việt: `"Mới về"` → `"moi-ve"`
- Nếu slug trùng → tự thêm hậu tố: `moi-ve-1`, `moi-ve-2`, ...

### 3.4 Quy tắc Xóa

- Xóa tag **không bị chặn** dù tag đang gắn với sản phẩm
- Bảng trung gian `ProductTag` có `onDelete: Cascade` → tự động gỡ tag khỏi tất cả sản phẩm

### 3.5 Không có trạng thái (isActive)

- Tag **không có** `isActive` — một khi đã tạo, tag hiển thị với tất cả mọi người
- Muốn "ẩn" tag khỏi sản phẩm: phải xóa tag hoặc gỡ thủ công khỏi từng sản phẩm

---

## 4. Luồng nghiệp vụ chi tiết

### 4.1 Lấy danh sách Tag

```
GET /api/tags → getTags() → DB → Response
```

**Happy Path:**
1. Query toàn bộ tag, sắp theo `name ASC`
2. Kèm theo `_count.productTags` — số sản phẩm đang dùng tag đó
3. Trả về `200` + `{ tags: [...] }`

**Response mẫu:**
```json
{
  "tags": [
    { "id": "...", "name": "Hot", "slug": "hot", "_count": { "productTags": 12 } },
    { "id": "...", "name": "Mới", "slug": "moi", "_count": { "productTags": 5 } }
  ]
}
```

---

### 4.2 Tạo Tag (Admin)

```
POST /api/admin/tags
  → [authenticate] → [authorize STAFF+]
  → [validate] → createTag → DB → Response
```

**Happy Path:**
1. Validate `name` ≥ 1 ký tự
2. Trim `name`, kiểm tra unique trong DB
3. Sinh slug duy nhất từ `slug || name`
4. Tạo bản ghi Tag
5. Trả về `201` + tag mới

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `name` rỗng hoặc thiếu | 400 | `Tên tag phải có ít nhất 1 ký tự` |
| `name` đã tồn tại | 409 | `Tag đã tồn tại` |
| Sai role | 403 | `Bạn không có quyền thực hiện thao tác này` |

---

### 4.3 Xóa Tag (Admin)

```
DELETE /api/admin/tags/:id
  → [authenticate] → [authorize STAFF+]
  → deleteTag → DB → Response
```

**Happy Path:**
1. Kiểm tra tag tồn tại theo `id` — `404` nếu không có
2. Xóa tag → DB tự động cascade xóa các `ProductTag` liên quan
3. Trả về `200` + `{ message: 'Xóa tag thành công' }`

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `id` không tồn tại | 404 | `Tag không tồn tại` |
| Sai role | 403 | `Bạn không có quyền thực hiện thao tác này` |

> **Lưu ý:** Xóa tag sẽ gỡ tag đó khỏi **tất cả sản phẩm** đang sử dụng (cascade). Không có cảnh báo hay confirmation trước khi xóa ở tầng backend.

---

## 5. Bảng dữ liệu

### Bảng `Tag`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `name` | string | Unique — tên tag |
| `slug` | string | Unique — dùng cho URL/lọc |
| `productTags` | ProductTag[] | Relation nhiều–nhiều với Product |

### Bảng trung gian `ProductTag`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `productId` | string | FK → Product |
| `tagId` | string | FK → Tag (`onDelete: Cascade`) |

---

## 6. So sánh Tag vs Category vs Brand

| Tiêu chí | Tag | Category | Brand |
|---|---|---|---|
| Cấu trúc | Phẳng | Cây (parent–child) | Phẳng |
| Có `isActive` | ❌ | ✅ | ✅ |
| Có ảnh / logo | ❌ | ✅ | ✅ |
| Có `sortOrder` | ❌ | ✅ | ❌ |
| Unique constraint | `name` unique | `slug` unique | `name` unique + `slug` unique |
| Khi xóa có sản phẩm | ✅ Cho phép (cascade) | ❌ Chặn | ❌ Chặn |
| Có endpoint Update | ❌ | ✅ | ✅ |
| `name` tối thiểu | 1 ký tự | 2 ký tự | 2 ký tự |
| Quan hệ với Product | Nhiều–nhiều (`ProductTag`) | Một–nhiều (`categoryId`) | Một–nhiều (`brandId`) |
