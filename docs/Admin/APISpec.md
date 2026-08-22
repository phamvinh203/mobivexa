# API Specification
## Module: Admin (Quản lý người dùng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22  
> **Base URL:** `/api/admin/users`  
> **Auth:** Tất cả endpoint yêu cầu Bearer token với role **ADMIN** (không phải STAFF)

---

### GET /admin/users
Danh sách người dùng.

**Query params:**
| Param | Type | Mô tả |
|---|---|---|
| `page` | number | Trang (default 1) |
| `limit` | number | Số bản ghi/trang (LIMITS.INVENTORY) |
| `search` | string | Tìm theo email hoặc fullName (case-insensitive) |
| `role` | string | `CUSTOMER` \| `STAFF` \| `ADMIN` |
| `isActive` | string | `"true"` \| `"false"` |

**Response 200:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "phone": "0901234567",
      "fullName": "Nguyễn Văn A",
      "avatarUrl": null,
      "role": "CUSTOMER",
      "isActive": true,
      "emailVerified": false,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 120,
    "totalPages": 3
  }
}
```

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 401 | Chưa đăng nhập |
| 403 | Không phải ADMIN |

---

### GET /admin/users/:id
Chi tiết một người dùng.

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "0901234567",
    "fullName": "Nguyễn Văn A",
    "avatarUrl": null,
    "role": "CUSTOMER",
    "isActive": true,
    "emailVerified": false,
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z",
    "_count": {
      "addresses": 2,
      "refreshTokens": 1
    }
  }
}
```

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 401 | Chưa đăng nhập |
| 403 | Không phải ADMIN |
| 404 | Người dùng không tồn tại |

---

### PATCH /admin/users/:id/role
Thay đổi role người dùng.

**Content-Type:** `application/json`

**Request body:**
```json
{ "role": "STAFF" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `role` | string | ✅ | `CUSTOMER` \| `STAFF` \| `ADMIN` |

**Response 200:** Object user đầy đủ kèm `_count` (ADMIN_USER_DETAIL_SELECT)

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | `role` không hợp lệ |
| 400 | Admin tự đổi role của mình (`Không thể đổi role của chính mình`) |
| 401 | Chưa đăng nhập |
| 403 | Không phải ADMIN |
| 404 | Người dùng không tồn tại |

---

### PATCH /admin/users/:id/status
Toggle `isActive` (khóa / mở tài khoản).

**Body:** Không cần.

**Response 200:** Object user đầy đủ với `isActive` đã toggle

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Admin tự khóa tài khoản của mình (`Không thể khóa tài khoản của chính mình`) |
| 401 | Chưa đăng nhập |
| 403 | Không phải ADMIN |
| 404 | Người dùng không tồn tại |

---

### DELETE /admin/users/:id
Xóa người dùng.

**Response 200:**
```json
{ "message": "Xóa người dùng thành công" }
```

**Lỗi:**
| HTTP | Điều kiện |
|---|---|
| 400 | Admin tự xóa tài khoản của mình (`Không thể xóa tài khoản của chính mình`) |
| 401 | Chưa đăng nhập |
| 403 | Không phải ADMIN |
| 404 | Người dùng không tồn tại |

> Xóa cascade toàn bộ dữ liệu liên quan — không thể hoàn tác.
