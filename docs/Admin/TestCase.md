# Test Case Document
## Module: Admin (Quản lý người dùng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| GET /admin/users (list) | 7 |
| GET /admin/users/:id (detail) | 3 |
| PATCH /admin/users/:id/role | 6 |
| PATCH /admin/users/:id/status | 5 |
| DELETE /admin/users/:id | 5 |
| **Tổng** | **26** |

---

## TC-LIST: Danh sách người dùng

### TC-LIST-01: Trả danh sách phân trang

**Precondition:** DB có 3 user  
**Input:** `GET /api/admin/users` với ADMIN token  
**Expected:**
- HTTP: `200`
- `data.users` là mảng
- `data.pagination` có `total`, `page`, `totalPages`

---

### TC-LIST-02: Tìm kiếm theo email (case-insensitive)

**Precondition:** User `test@gmail.com` tồn tại  
**Input:** `GET /api/admin/users?search=TEST`  
**Expected:** Response có user với email `test@gmail.com`

---

### TC-LIST-03: Tìm kiếm theo fullName

**Precondition:** User `fullName="Nguyễn Văn A"` tồn tại  
**Input:** `?search=nguyen`  
**Expected:** Response có user đó

---

### TC-LIST-04: Lọc theo role=STAFF

**Input:** `?role=STAFF`  
**Expected:** Chỉ trả user có `role="STAFF"`

---

### TC-LIST-05: Lọc theo isActive=false

**Input:** `?isActive=false`  
**Expected:** Chỉ trả user có `isActive=false`

---

### TC-LIST-06: Kết hợp search + role + isActive

**Input:** `?search=admin&role=ADMIN&isActive=true`  
**Expected:** Chỉ trả user khớp tất cả điều kiện

---

### TC-LIST-07: STAFF token → 403

**Input:** `GET /api/admin/users` với STAFF token  
**Expected:** `403`

---

## TC-DETAIL: Chi tiết người dùng

### TC-DETAIL-01: Lấy user hợp lệ

**Expected:**
- HTTP: `200`
- Response có `_count.addresses` và `_count.refreshTokens`

---

### TC-DETAIL-02: ID không tồn tại → 404

**Input:** `GET /api/admin/users/non-exist-id`  
**Expected:** `404` `Người dùng không tồn tại`

---

### TC-DETAIL-03: Không có token → 401

**Expected:** `401`

---

## TC-ROLE: Thay đổi role

### TC-ROLE-01: Đổi role thành công

**Precondition:** User target có role CUSTOMER  
**Input:** `PATCH /api/admin/users/:id/role { "role": "STAFF" }`  
**Expected:**
- HTTP: `200`
- `data.user.role === "STAFF"`

---

### TC-ROLE-02: Admin tự đổi role của mình → 400

**Input:** `PATCH /api/admin/users/{actorId}/role { "role": "CUSTOMER" }`  
**Expected:** `400` `Không thể đổi role của chính mình`

---

### TC-ROLE-03: Role không hợp lệ → 400

**Input:** `{ "role": "SUPERADMIN" }`  
**Expected:** `400`

---

### TC-ROLE-04: ID không tồn tại → 404

**Expected:** `404`

---

### TC-ROLE-05: STAFF token → 403

**Expected:** `403`

---

### TC-ROLE-06: Đổi về CUSTOMER xóa quyền admin

**Precondition:** User đang là STAFF  
**Input:** `{ "role": "CUSTOMER" }`  
**Expected:** `200` + `data.user.role === "CUSTOMER"`

---

## TC-STATUS: Khóa / Mở tài khoản

### TC-STATUS-01: Khóa tài khoản (true → false)

**Precondition:** User `isActive=true`  
**Input:** `PATCH /api/admin/users/:id/status`  
**Expected:**
- HTTP: `200`
- `data.user.isActive === false`

---

### TC-STATUS-02: Mở tài khoản (false → true)

**Precondition:** User `isActive=false`  
**Expected:** `200` + `data.user.isActive === true`

---

### TC-STATUS-03: Admin tự khóa mình → 400

**Input:** `PATCH /api/admin/users/{actorId}/status`  
**Expected:** `400` `Không thể khóa tài khoản của chính mình`

---

### TC-STATUS-04: ID không tồn tại → 404

**Expected:** `404`

---

### TC-STATUS-05: Tài khoản bị khóa không đăng nhập được

**Precondition:** User bị khóa (isActive=false)  
**Action:** User cố đăng nhập  
**Expected:** `401` hoặc `403` (auth middleware chặn)

---

## TC-DELETE: Xóa người dùng

### TC-DELETE-01: Xóa thành công

**Precondition:** User target tồn tại  
**Input:** `DELETE /api/admin/users/:id`  
**Expected:**
- HTTP: `200`
- `GET /api/admin/users/:id` sau đó → `404`

---

### TC-DELETE-02: Admin tự xóa mình → 400

**Input:** `DELETE /api/admin/users/{actorId}`  
**Expected:** `400` `Không thể xóa tài khoản của chính mình`

---

### TC-DELETE-03: ID không tồn tại → 404

**Expected:** `404`

---

### TC-DELETE-04: Cascade xóa địa chỉ

**Precondition:** User có 2 Address  
**Action:** DELETE user  
**Verify:** `Address.count({ where: { userId } }) === 0`

---

### TC-DELETE-05: STAFF token → 403

**Expected:** `403`

---

## Checklist Coverage

| Tiêu chí | TC |
|---|---|
| Chỉ ADMIN truy cập (không phải STAFF) | TC-LIST-07, TC-ROLE-05, TC-DELETE-05 |
| Search email case-insensitive | TC-LIST-02 |
| Search fullName | TC-LIST-03 |
| assertNotSelf — đổi role | TC-ROLE-02 |
| assertNotSelf — khóa | TC-STATUS-03 |
| assertNotSelf — xóa | TC-DELETE-02 |
| Toggle isActive đúng chiều | TC-STATUS-01, TC-STATUS-02 |
| Detail có _count | TC-DETAIL-01 |
| Cascade xóa dữ liệu liên quan | TC-DELETE-04 |
| Tài khoản bị khóa không đăng nhập được | TC-STATUS-05 |
