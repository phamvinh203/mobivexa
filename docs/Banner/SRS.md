# SRS — Software Requirement Specification
## Module: Banner
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19 | **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Phạm vi

Module Banner cung cấp 8 endpoints chia 2 nhóm:
- **Public** (`/api/banners`): Xem banner và vị trí, không cần đăng nhập
- **Admin** (`/api/admin/banners`): CRUD đầy đủ, STAFF+

---

## 2. Yêu cầu chức năng

### FR-01: Danh sách banner (Public)

| | |
|---|---|
| **Endpoint** | `GET /api/banners` |
| **Auth** | ❌ Public |
| **Query Params** | `position?: HERO \| LEFT \| RIGHT \| HORIZONTAL` |

**Xử lý:** `getBanners(position?, includeInactive=false)`
```
WHERE isActive = true
  AND (position = ? -- nếu gửi)
ORDER BY sortOrder ASC, createdAt DESC
```

**Response:** `200` + `{ banners: Banner[] }`

---

### FR-02: Danh sách vị trí (Public & Admin)

| | |
|---|---|
| **Endpoint** | `GET /api/banners/positions` và `GET /api/admin/banners/positions` |
| **Auth** | Public: ❌ &nbsp; Admin: ✅ STAFF+ |

**Xử lý:** Trả `BANNER_POSITIONS` map với `BANNER_POSITION_LABEL` — không query DB.

**Response:**
```json
{
  "positions": [
    { "value": "HERO",       "label": "Banner chính (full-width đầu trang)" },
    { "value": "LEFT",       "label": "Banner bên trái" },
    { "value": "RIGHT",      "label": "Banner bên phải" },
    { "value": "HORIZONTAL", "label": "Banner ngang dài" }
  ]
}
```

---

### FR-03: Danh sách banner (Admin)

| | |
|---|---|
| **Endpoint** | `GET /api/admin/banners` |
| **Auth** | ✅ STAFF+ |

**Xử lý:** `getBanners(position?, includeInactive=true)` — trả cả `isActive=false`

---

### FR-04: Tạo banner

| | |
|---|---|
| **Endpoint** | `POST /api/admin/banners` |
| **Auth** | ✅ STAFF+ |
| **Content-Type** | `multipart/form-data` |

**Body:**

| Field | Type | Required | Validation |
|---|---|---|---|
| `image` | file | ✅ | JPEG/PNG/WebP ≤ 5MB — `400` nếu thiếu |
| `alt` | string | ✅ | ≥ 2 ký tự |
| `position` | enum | ✅ | `HERO \| LEFT \| RIGHT \| HORIZONTAL` |
| `href` | string | ❌ | Default `/products` nếu không gửi hoặc gửi rỗng |
| `description` | string | ❌ | |
| `isActive` | boolean/string | ❌ | Default `true` |
| `sortOrder` | number/string | ❌ | Default `0` |

**Xử lý:**
1. Validate: `req.file` tồn tại → `400 'Ảnh banner là bắt buộc'`
2. Validate: `alt` ≥ 2 ký tự
3. Validate: `position` hợp lệ
4. `uploadEntityImage(file.buffer, 'banners')` → `{ url, publicId }`
5. `prisma.banner.create(data)`
6. Nếu DB fail (bước 5) → `catch` → `destroyImage(image.publicId)` + rethrow

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| Thiếu file ảnh | 400 | `Ảnh banner là bắt buộc` |
| `alt` < 2 ký tự / thiếu | 400 | `Alt text phải có ít nhất 2 ký tự` |
| `position` thiếu | 400 | `Vị trí banner là bắt buộc. Các giá trị hợp lệ: HERO, LEFT, RIGHT, HORIZONTAL` |
| `position` sai enum | 400 | `Vị trí banner không hợp lệ. Các giá trị hợp lệ: HERO, LEFT, RIGHT, HORIZONTAL` |

---

### FR-05: Cập nhật banner

| | |
|---|---|
| **Endpoint** | `PUT /api/admin/banners/:id` |
| **Auth** | ✅ STAFF+ |
| **Content-Type** | `multipart/form-data` |

**Body:** Giống FR-04 nhưng tất cả optional (partial update)

**Xử lý:**
1. `findBannerOrThrow(id)` — `404` nếu không tồn tại
2. Validate `alt` (optional) và `position` (optional)
3. Build `data` từ các trường được gửi
4. Nếu `href` gửi rỗng → set `/products`
5. Nếu có file ảnh mới → upload → ghi URL mới → `destroyImage(banner.imagePublicId)` nền

**Lỗi:**

| Điều kiện | HTTP | Message |
|---|---|---|
| `id` không tồn tại | 404 | `Banner không tồn tại` |
| `alt` gửi < 2 ký tự | 400 | `Alt text phải có ít nhất 2 ký tự` |
| `position` gửi sai enum | 400 | `Vị trí banner không hợp lệ...` |

---

### FR-06: Xóa banner

| | |
|---|---|
| **Endpoint** | `DELETE /api/admin/banners/:id` |
| **Auth** | ✅ STAFF+ |

**Xử lý:**
1. `findBannerOrThrow(id)` — `404` nếu không tồn tại
2. `prisma.banner.delete(id)`
3. `destroyImage(banner.imagePublicId)` nền

> Không có guard — banner không có FK đến bảng khác.

---

### FR-07: Toggle trạng thái

| | |
|---|---|
| **Endpoint** | `PATCH /api/admin/banners/:id/status` |
| **Auth** | ✅ STAFF+ |

**Xử lý:** Đảo `isActive`

---

## 3. Cơ chế Rollback Cloudinary

```
Upload ảnh → OK → prisma.banner.create() → LỖI
                                              ↓
                             catch: destroyImage(image.publicId)
                                              ↓
                                    rethrow lỗi → 500
```

**Lý do:** Tránh ảnh mồ côi trên Cloudinary khi DB tạo thất bại. Chỉ Banner implement rollback này — Brand/Category không có vì ảnh là optional.

---

## 4. `href` Default Logic

| Input | Lưu vào DB |
|---|---|
| Không gửi `href` | `/products` |
| Gửi `href = ""` | `/products` |
| Gửi `href = "/sale"` | `/sale` |

---

## 5. Composite Index

```sql
@@index([isActive, position, sortOrder])
```

Tối ưu query `WHERE isActive=true AND position=? ORDER BY sortOrder ASC`.

---

## 6. Schema dữ liệu

### Bảng `Banner`

| Trường | Kiểu | Nullable | Ghi chú |
|---|---|---|---|
| `id` | string (uuid) | No | PK |
| `imageUrl` | string | **No** | Cloudinary URL — **bắt buộc** |
| `imagePublicId` | string | **No** | Dùng để xóa ảnh — **bắt buộc** |
| `alt` | string | No | Alt text ≥ 2 ký tự |
| `href` | string | No | URL đích; default `/products` |
| `description` | string | Yes | Mô tả nội bộ |
| `position` | BannerPosition | No | Enum; default `HERO` |
| `isActive` | boolean | No | Default `true` |
| `sortOrder` | int | No | Default `0` |
| `createdAt` | DateTime | No | Auto |
| `updatedAt` | DateTime | No | Auto |
