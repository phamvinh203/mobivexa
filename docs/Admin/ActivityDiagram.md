# Activity Diagram
## Module: Admin (Quản lý người dùng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## AD-01: Danh sách người dùng

```mermaid
flowchart TD
    Start([Admin gửi GET /admin/users]) --> Auth{role === ADMIN?}
    Auth -- Không --> E403[403 Forbidden]
    Auth -- Có --> Parse[parsePagination\nLIMITS.INVENTORY]
    Parse --> BuildWhere[Build WHERE từ query params]
    BuildWhere --> Search{Có search\nsau trim?}
    Search -- Có --> AddSearch[WHERE email ILIKE OR\nfullName ILIKE]
    Search -- Không --> SkipSearch[Bỏ qua điều kiện search]
    AddSearch & SkipSearch --> RoleFilter{Có role filter\nvà hợp lệ?}
    RoleFilter -- Có --> AddRole[WHERE role = ?]
    RoleFilter -- Không --> SkipRole[Bỏ qua]
    AddRole & SkipRole --> StatusFilter{Có isActive filter?}
    StatusFilter -- Có --> AddStatus[WHERE isActive = bool]
    StatusFilter -- Không --> SkipStatus[Bỏ qua]
    AddStatus & SkipStatus --> Query[findMany + count\nORDER BY createdAt DESC]
    Query --> R200[200 users + pagination]
```

---

## AD-02: Thay đổi role người dùng

```mermaid
flowchart TD
    Start([Admin gửi PATCH /admin/users/:id/role]) --> Auth{role === ADMIN?}
    Auth -- Không --> E403[403]
    Auth -- Có --> ValidRole{role ∈ CUSTOMER\nSTAFF, ADMIN?}
    ValidRole -- Không --> E400a[400 Role không hợp lệ]
    ValidRole -- Có --> SelfCheck{actorId === targetId?}
    SelfCheck -- Có --> E400b[400 Không thể đổi role\ncủa chính mình]
    SelfCheck -- Không --> FindUser[assertUserExists targetId]
    FindUser -- 404 --> E404[404 Người dùng không tồn tại]
    FindUser -- OK --> Update[user.update role\nADMIN_USER_DETAIL_SELECT]
    Update --> R200[200 user updated]
```

---

## AD-03: Khóa / Mở tài khoản

```mermaid
flowchart TD
    Start([Admin gửi PATCH /admin/users/:id/status]) --> Auth{role === ADMIN?}
    Auth -- Không --> E403[403]
    Auth -- Có --> SelfCheck{actorId === targetId?}
    SelfCheck -- Có --> E400[400 Không thể khóa tài khoản\ncủa chính mình]
    SelfCheck -- Không --> FindUser[user.findUnique id\nSELECT id, isActive]
    FindUser -- null --> E404[404]
    FindUser -- OK --> Toggle[isActive = !current.isActive]
    Toggle --> Update[user.update ADMIN_USER_DETAIL_SELECT]
    Update --> R200[200 user với isActive mới]
```

---

## AD-04: Xóa người dùng

```mermaid
flowchart TD
    Start([Admin gửi DELETE /admin/users/:id]) --> Auth{role === ADMIN?}
    Auth -- Không --> E403[403]
    Auth -- Có --> SelfCheck{actorId === targetId?}
    SelfCheck -- Có --> E400[400 Không thể xóa tài khoản\ncủa chính mình]
    SelfCheck -- Không --> FindUser[assertUserExists targetId]
    FindUser -- 404 --> E404[404]
    FindUser -- OK --> Delete[user.delete id]
    Delete --> Cascade[DB CASCADE:\naddresses, tokens, favorites,\nreviews, orders, v.v.]
    Cascade --> R200[200 Xóa thành công]
```

---

## AD-05: Xem chi tiết người dùng

```mermaid
flowchart TD
    Start([Admin gửi GET /admin/users/:id]) --> Auth{role === ADMIN?}
    Auth -- Không --> E403[403]
    Auth -- Có --> Find[findUserOrThrow id\nADMIN_USER_DETAIL_SELECT]
    Find -- 404 --> E404[404]
    Find -- OK --> R200[200 user + _count addresses + refreshTokens]
```
