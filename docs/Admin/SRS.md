# SRS — Software Requirement Specification
## Module: Admin (Quản lý người dùng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22 | **Tham chiếu:** [BRD.md](./BRD.md)

---

## 1. Endpoints tổng quan

Base path: `/api/admin/users`  
**Auth: tất cả endpoint yêu cầu role ADMIN (không phải STAFF)**

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/admin/users` | Danh sách người dùng (pagination + filter) |
| GET | `/api/admin/users/:id` | Chi tiết người dùng |
| PATCH | `/api/admin/users/:id/role` | Thay đổi role |
| PATCH | `/api/admin/users/:id/status` | Khóa / Mở tài khoản |
| DELETE | `/api/admin/users/:id` | Xóa người dùng |

---

## 2. Data Selectors

### USER_PUBLIC_SELECT (dùng cho list)
```
id, email, phone, fullName, avatarUrl,
role, isActive, emailVerified,
createdAt, updatedAt
```

### ADMIN_USER_DETAIL_SELECT (dùng cho detail, role update, toggle)
```
...USER_PUBLIC_SELECT,
_count: { addresses, refreshTokens }
```

> List không kèm `_count` để tránh COUNT subquery trên từng row khi danh sách lớn.

---

## 3. Yêu cầu chức năng

### FR-01: Danh sách người dùng

| | |
|---|---|
| **Endpoint** | `GET /api/admin/users` |
| **Auth** | ✅ ADMIN only |

**Query params:**

| Param | Mô tả |
|---|---|
| `page`, `limit` | Phân trang (LIMITS.INVENTORY / LIMITS.MAX_INVENTORY) |
| `search` | Tìm theo `email` hoặc `fullName` (case-insensitive, OR) |
| `role` | `CUSTOMER` \| `STAFF` \| `ADMIN` |
| `isActive` | `"true"` \| `"false"` |

**Xử lý:**
```
WHERE:
  (email ILIKE %search% OR fullName ILIKE %search%)  -- nếu có search
  AND role = ?        -- nếu có role
  AND isActive = ?    -- nếu có isActive

ORDER BY: createdAt DESC
SELECT: USER_PUBLIC_SELECT
```

**Search:** trim trước khi dùng — chỉ khoảng trắng coi như không có search.  
**Role validation:** dùng `Set(Object.values(UserRole))` — giá trị không hợp lệ bị bỏ qua (không lọc theo role), không ném lỗi.

---

### FR-02: Chi tiết người dùng

| | |
|---|---|
| **Endpoint** | `GET /api/admin/users/:id` |
| **Auth** | ✅ ADMIN only |

**Xử lý:** `findUserOrThrow(id)` với `ADMIN_USER_DETAIL_SELECT`  
**Lỗi:** 404 nếu không tìm thấy.

---

### FR-03: Thay đổi role

| | |
|---|---|
| **Endpoint** | `PATCH /api/admin/users/:id/role` |
| **Auth** | ✅ ADMIN only |

**Body:**
| Field | Type | Required | Validation |
|---|---|---|---|
| `role` | string | ✅ | CUSTOMER \| STAFF \| ADMIN |

**Xử lý:**
1. Validate role hợp lệ
2. `assertNotSelf(actorId, targetId, 'đổi role')` → 400 nếu tự sửa
3. `assertUserExists(targetId)` → 404 nếu không tồn tại
4. `user.update({ role })` với `ADMIN_USER_DETAIL_SELECT`

**Lỗi:**

| HTTP | Điều kiện |
|---|---|
| 400 | `role` không hợp lệ |
| 400 | Admin tự đổi role của mình |
| 404 | User không tồn tại |

---

### FR-04: Khóa / Mở tài khoản

| | |
|---|---|
| **Endpoint** | `PATCH /api/admin/users/:id/status` |
| **Auth** | ✅ ADMIN only |

**Không cần body.**

**Xử lý:**
1. `assertNotSelf(actorId, targetId, 'khóa tài khoản')` → 400
2. `user.findUnique` → 404 nếu không tồn tại
3. `user.update({ isActive: !user.isActive })` với `ADMIN_USER_DETAIL_SELECT`

---

### FR-05: Xóa người dùng

| | |
|---|---|
| **Endpoint** | `DELETE /api/admin/users/:id` |
| **Auth** | ✅ ADMIN only |

**Xử lý:**
1. `assertNotSelf(actorId, targetId, 'xóa tài khoản')` → 400
2. `assertUserExists(targetId)` → 404
3. `user.delete({ id })`

**Không có guard:** xóa cascade toàn bộ dữ liệu liên quan (địa chỉ, token, favorite, review, v.v.) qua DB-level cascade.

---

## 4. assertNotSelf — Guard chung

```typescript
function assertNotSelf(actorId: string, targetId: string, action: string) {
  if (actorId === targetId)
    throw new AppError(400, `Không thể ${action} của chính mình`)
}
```

Áp dụng cho: đổi role (`đổi role`), khóa (`khóa tài khoản`), xóa (`xóa tài khoản`).

---

## 5. Yêu cầu phi chức năng

| | |
|---|---|
| **Bảo mật** | Chỉ ADMIN — không phải STAFF_ROLES |
| **Tự bảo vệ** | Admin không thể tự modify/xóa chính mình |
| **Performance** | List không có `_count` để tránh N+1 COUNT subquery |
| **Search** | ILIKE (insensitive) cho email + fullName |
