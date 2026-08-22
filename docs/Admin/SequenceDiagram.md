# Sequence Diagram — Luồng API
## Module: Admin (Quản lý người dùng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## SD-01: Danh sách người dùng

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant Auth as Middleware Auth+Authorize
    participant S as AdminService
    participant DB as PostgreSQL

    A->>Auth: GET /api/admin/users?search=...&role=...
    Auth-->>A: 401 nếu chưa đăng nhập
    Auth-->>A: 403 nếu role ≠ ADMIN
    Auth->>S: listUsers(query)

    S->>S: parsePagination(query, LIMITS.INVENTORY)
    S->>S: parseSearch(query.search) → trim, null nếu rỗng
    S->>S: Build WHERE (search OR, role, isActive)

    par Song song
        S->>DB: user.findMany(where, select USER_PUBLIC_SELECT, orderBy createdAt DESC, skip, take)
        DB-->>S: users[]
    and
        S->>DB: user.count(where)
        DB-->>S: total
    end

    S->>S: paginationMeta(page, limit, total)
    S-->>A: 200 { users, pagination }
```

---

## SD-02: Thay đổi role

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant Auth as Middleware
    participant V as Validator
    participant S as AdminService
    participant DB as PostgreSQL

    A->>Auth: PATCH /api/admin/users/:id/role { role: "STAFF" }
    Auth-->>A: 401/403 nếu không có quyền ADMIN
    Auth->>V: validateUpdateUserRole
    V-->>A: 400 nếu role không hợp lệ
    V->>S: updateUserRole(actorId, targetId, role)

    S->>S: assertNotSelf(actorId, targetId, 'đổi role')
    Note over S: Ném 400 nếu actorId === targetId
    S->>DB: user.findUnique(targetId) SELECT id
    DB-->>S: user | null

    alt Không tìm thấy
        S-->>A: 404 Người dùng không tồn tại
    else OK
        S->>DB: user.update({ role }, ADMIN_USER_DETAIL_SELECT)
        DB-->>S: updated user
        S-->>A: 200 { user }
    end
```

---

## SD-03: Khóa / Mở tài khoản

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant Auth as Middleware
    participant S as AdminService
    participant DB as PostgreSQL

    A->>Auth: PATCH /api/admin/users/:id/status
    Auth-->>A: 401/403 nếu không có quyền ADMIN
    Auth->>S: toggleUserStatus(actorId, targetId)

    S->>S: assertNotSelf(actorId, targetId, 'khóa tài khoản')
    S->>DB: user.findUnique(targetId) SELECT id, isActive
    DB-->>S: user | null

    alt Không tìm thấy
        S-->>A: 404 Người dùng không tồn tại
    else OK
        S->>DB: user.update({ isActive: !user.isActive }, ADMIN_USER_DETAIL_SELECT)
        DB-->>S: updated user
        S-->>A: 200 { user với isActive mới }
    end
```

---

## SD-04: Xóa người dùng

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant Auth as Middleware
    participant S as AdminService
    participant DB as PostgreSQL

    A->>Auth: DELETE /api/admin/users/:id
    Auth-->>A: 401/403 nếu không có quyền ADMIN
    Auth->>S: deleteUser(actorId, targetId)

    S->>S: assertNotSelf(actorId, targetId, 'xóa tài khoản')
    S->>DB: user.findUnique(targetId) SELECT id
    DB-->>S: user | null

    alt Không tìm thấy
        S-->>A: 404 Người dùng không tồn tại
    else OK
        S->>DB: user.delete({ id: targetId })
        Note over DB: onDelete: Cascade kích hoạt
        DB->>DB: Xóa: addresses, refreshTokens, favorites,\nreviews, couponUsages, carts, orders, ...
        DB-->>S: OK
        S-->>A: 200 Xóa người dùng thành công
    end
```

---

## SD-05: Xem chi tiết người dùng

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant Auth as Middleware
    participant S as AdminService
    participant DB as PostgreSQL

    A->>Auth: GET /api/admin/users/:id
    Auth-->>A: 401/403 nếu không có quyền
    Auth->>S: findUserOrThrow(id)

    S->>DB: user.findUnique(id) SELECT ADMIN_USER_DETAIL_SELECT
    Note over DB: Bao gồm _count: { addresses, refreshTokens }
    DB-->>S: user | null

    alt null
        S-->>A: 404 Người dùng không tồn tại
    else OK
        S-->>A: 200 { user (+ _count) }
    end
```
