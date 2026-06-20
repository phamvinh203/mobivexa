# Nghiệp vụ Banner (Quảng cáo) — Mobivexa

> **Phạm vi:** `src/services/banner.service.ts`, `src/controllers/banner.controller.ts`, `src/routes/banner.route.ts`, `src/validators/banner.validator.ts`, `src/types/banner.type.ts`
>
> **Cập nhật:** 2026-06-19

---

## 1. Tổng quan

Module Banner quản lý **ảnh quảng cáo hiển thị trên giao diện** theo từng vị trí cố định (position). Đây là module đơn giản, không có quan hệ với sản phẩm hay đơn hàng.

Có 2 nhóm route:
- **Public** (`/api/banners`): Không cần đăng nhập — frontend lấy banner để hiển thị
- **Admin** (`/api/admin/banners`): Yêu cầu `ADMIN` hoặc `STAFF` — quản trị banner

---

## 2. Vị trí Banner (`BannerPosition`)

| Giá trị | Nhãn hiển thị | Mô tả |
|---|---|---|
| `HERO` | Banner chính (full-width đầu trang) | Slider/carousel lớn ở đầu trang chủ |
| `LEFT` | Banner bên trái | Quảng cáo cột bên trái |
| `RIGHT` | Banner bên phải | Quảng cáo cột bên phải |
| `HORIZONTAL` | Banner ngang dài | Banner ngang dạng strip |

> Enum `BannerPosition` derive trực tiếp từ Prisma — tự đồng bộ nếu schema thay đổi.

---

## 3. Danh sách endpoint

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/api/banners` | Lấy banner active (`?position=`) | ❌ Public |
| `GET` | `/api/banners/positions` | Danh sách vị trí hợp lệ | ❌ Public |
| `GET` | `/api/admin/banners` | Lấy tất cả banner gồm inactive (`?position=`) | ✅ STAFF+ |
| `GET` | `/api/admin/banners/positions` | Danh sách vị trí (dùng cho form admin) | ✅ STAFF+ |
| `POST` | `/api/admin/banners` | Tạo banner mới | ✅ STAFF+ |
| `PUT` | `/api/admin/banners/:id` | Cập nhật banner | ✅ STAFF+ |
| `DELETE` | `/api/admin/banners/:id` | Xóa banner | ✅ STAFF+ |
| `PATCH` | `/api/admin/banners/:id/status` | Bật / tắt trạng thái | ✅ STAFF+ |

---

## 4. Chính sách & Ràng buộc nghiệp vụ

### 4.1 Dữ liệu đầu vào

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| `image` | ✅ Tạo mới | File ảnh (multipart); JPG/PNG/WebP, tối đa 5MB |
| `alt` | ✅ Tạo mới | Alt text ≥ 2 ký tự (sau trim); optional khi cập nhật |
| `position` | ✅ Tạo mới | Phải là `HERO`/`LEFT`/`RIGHT`/`HORIZONTAL`; optional khi cập nhật |
| `href` | ❌ | URL khi click banner; mặc định `/products` nếu không gửi hoặc gửi rỗng |
| `description` | ❌ | Mô tả nội bộ |
| `isActive` | ❌ | Mặc định `true` khi tạo |
| `sortOrder` | ❌ | Số nguyên, mặc định `0`; dùng để sắp xếp trong cùng vị trí |

### 4.2 Ảnh Banner

| Quy tắc | Giá trị |
|---|---|
| Định dạng | JPG, JPEG, PNG, WebP |
| Kích thước tối đa | 5 MB |
| Bắt buộc khi tạo | ✅ — không có ảnh → `400` |
| Tùy chọn khi cập nhật | ❌ — nếu không gửi ảnh mới thì giữ ảnh cũ |
| Lưu trữ | Cloudinary, folder `banners` |
| `public_id` | Do Cloudinary tự sinh |
| Khi cập nhật ảnh | Upload mới → lưu DB → xóa ảnh cũ ở nền |
| Khi tạo thất bại | Ảnh đã upload được xóa khỏi Cloudinary ngay lập tức (rollback) |

### 4.3 Sắp xếp hiển thị

- Sắp xếp: `sortOrder ASC` → `createdAt DESC`
- Trong cùng 1 `position`, banner có `sortOrder` nhỏ hơn hiển thị trước
- Khi `sortOrder` bằng nhau: banner tạo gần đây hơn hiển thị trước

### 4.4 `href` mặc định

- Nếu không gửi `href` → lưu `/products`
- Nếu gửi `href` rỗng (`""`) → cũng lưu `/products`
- Áp dụng cả khi tạo mới và cập nhật

---

## 5. Luồng nghiệp vụ chi tiết

### 5.1 Lấy danh sách banner (Public)

```
GET /api/banners?position=[HERO|LEFT|RIGHT|HORIZONTAL]
  → getBanners(position, includeInactive=false) → DB → Response
```

- Chỉ trả về banner có `isActive = true`
- `position` là query param tùy chọn — không gửi thì trả tất cả vị trí
- Sắp theo `sortOrder ASC`, `createdAt DESC`

---

### 5.2 Lấy danh sách vị trí

```
GET /api/banners/positions → listBannerPositions → Response
```

Trả về mảng `{ value, label }` derive từ enum `BannerPosition`:
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

Dùng để populate dropdown chọn vị trí trong form tạo/sửa banner phía admin.

---

### 5.3 Tạo banner (Admin)

```
POST /api/admin/banners
  → [authenticate] → [authorize STAFF+]
  → [uploadImage.single('image')] → [validate]
  → createBanner → Cloudinary → DB → Response 201
```

**Happy Path:**
1. Validate: phải có file ảnh; `alt` ≥ 2 ký tự; `position` hợp lệ
2. Upload ảnh lên Cloudinary (`folder: banners`)
3. Tạo bản ghi Banner trong DB
   - Nếu DB lỗi (bất kỳ lý do) → **xóa ảnh vừa upload** khỏi Cloudinary (rollback)
4. Trả về `201` + banner mới

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| Không gửi file ảnh | 400 | `Ảnh banner là bắt buộc` |
| `alt` < 2 ký tự | 400 | `Alt text phải có ít nhất 2 ký tự` |
| Thiếu `position` | 400 | `Vị trí banner là bắt buộc. Các giá trị hợp lệ: HERO, LEFT, RIGHT, HORIZONTAL` |
| `position` không hợp lệ | 400 | `Vị trí banner không hợp lệ. Các giá trị hợp lệ: HERO, LEFT, RIGHT, HORIZONTAL` |
| Sai role | 403 | `Bạn không có quyền thực hiện thao tác này` |

> **Rollback ảnh:** Nếu `prisma.banner.create` ném exception → `destroyImage` được gọi ngay để tránh ảnh mồ côi trên Cloudinary.

---

### 5.4 Cập nhật banner (Admin)

```
PUT /api/admin/banners/:id
  → [authenticate] → [authorize STAFF+]
  → [uploadImage.single('image')] → [validate]
  → updateBanner → DB + Cloudinary → Response
```

**Happy Path:**
1. Tìm banner theo `id` — `404` nếu không tồn tại
2. Validate `alt` nếu gửi (optional, ≥ 2 ký tự); validate `position` nếu gửi
3. Partial update: chỉ cập nhật trường được gửi
4. Nếu có file ảnh mới:
   - Upload ảnh mới lên Cloudinary
   - Lưu URL + publicId mới vào DB
   - Xóa ảnh cũ ở nền (async, bỏ qua lỗi)
5. Trả về `200` + banner đã cập nhật

**Failure Modes:**

| Điều kiện | HTTP | Thông báo |
|---|---|---|
| `id` không tồn tại | 404 | `Banner không tồn tại` |
| `alt` < 2 ký tự (nếu gửi) | 400 | `Alt text phải có ít nhất 2 ký tự` |
| `position` không hợp lệ (nếu gửi) | 400 | `Vị trí banner không hợp lệ. Các giá trị hợp lệ: ...` |

---

### 5.5 Xóa banner (Admin)

```
DELETE /api/admin/banners/:id
  → [authenticate] → [authorize STAFF+]
  → deleteBanner → DB → Cloudinary → Response
```

1. Tìm banner — `404` nếu không tồn tại
2. Xóa bản ghi DB
3. Xóa ảnh trên Cloudinary ở nền (không chặn response)
4. Trả về `200` + `{ message: 'Xóa banner thành công' }`

> Không có ràng buộc chặn xóa banner.

---

### 5.6 Bật / Tắt trạng thái (Admin)

```
PATCH /api/admin/banners/:id/status
  → [authenticate] → [authorize STAFF+]
  → toggleBannerStatus → DB → Response
```

1. Tìm banner — `404` nếu không tồn tại
2. Đảo ngược `isActive` (`true ↔ false`)
3. Trả về `200` + banner với trạng thái mới

---

## 6. Bảng dữ liệu

### Bảng `Banner`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Primary key |
| `imageUrl` | string | URL ảnh trên Cloudinary |
| `imagePublicId` | string | Public ID Cloudinary (dùng để xóa ảnh cũ) |
| `alt` | string | Alt text cho accessibility và SEO |
| `href` | string | URL đích khi click; mặc định `/products` |
| `description` | string? | Mô tả nội bộ (không hiển thị frontend) |
| `position` | BannerPosition | Vị trí hiển thị: `HERO`/`LEFT`/`RIGHT`/`HORIZONTAL` |
| `isActive` | boolean | Hiển thị cho khách; mặc định `true` |
| `sortOrder` | int | Thứ tự trong cùng vị trí; mặc định `0` |
| `createdAt` | DateTime | Dùng làm tiebreaker khi `sortOrder` bằng nhau |

---

## 7. So sánh với Category / Brand

| Tiêu chí | Banner | Category | Brand |
|---|---|---|---|
| Có `position` | ✅ (4 vị trí) | ❌ | ❌ |
| Có `sortOrder` | ✅ | ✅ | ❌ |
| Ảnh bắt buộc khi tạo | ✅ | ❌ | ❌ |
| Rollback ảnh khi DB lỗi | ✅ | ❌ | ❌ |
| Có `slug` | ❌ | ✅ | ✅ |
| Xóa bị chặn | ❌ | ✅ (còn con/sản phẩm) | ✅ (còn sản phẩm) |
| Lọc theo query param | `?position=` | ❌ | ❌ |
| Endpoint xem chi tiết | ❌ | ✅ (theo slug) | ✅ (theo slug) |
