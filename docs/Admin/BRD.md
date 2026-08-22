# BRD — Business Requirements Document
## Module: Admin (Quản lý người dùng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## 1. Mục tiêu kinh doanh

Module Admin cung cấp công cụ cho Super Admin (role ADMIN) để quản lý toàn bộ tài khoản người dùng trong hệ thống — bao gồm tìm kiếm, xem thông tin, thay đổi phân quyền, khóa/mở tài khoản và xóa người dùng vi phạm.

---

## 2. Bối cảnh & Vấn đề

| Vấn đề | Tác động |
|---|---|
| Không có giao diện quản lý người dùng | Admin phải query DB trực tiếp |
| Không thể hạn chế tài khoản vi phạm | Mất kiểm soát an toàn nền tảng |
| Không quản lý được phân quyền staff | Nhân viên có thể leo thang quyền hạn |

---

## 3. Yêu cầu kinh doanh

### BR-01: Tìm kiếm và xem người dùng
- Admin xem danh sách người dùng với tìm kiếm theo email hoặc fullName
- Lọc theo role (CUSTOMER / STAFF / ADMIN) và trạng thái (isActive)
- Xem chi tiết một người dùng kèm số địa chỉ và số refresh token đang hoạt động

### BR-02: Quản lý phân quyền
- Admin thay đổi role của người dùng (CUSTOMER ↔ STAFF ↔ ADMIN)
- **Admin không thể tự đổi role của chính mình** — tránh admin tự nâng cấp hay bị lock out

### BR-03: Khóa / Mở tài khoản
- Admin khóa tài khoản vi phạm (`isActive=false`)
- Tài khoản bị khóa không thể đăng nhập
- **Admin không thể tự khóa chính mình**

### BR-04: Xóa tài khoản
- Admin xóa người dùng khi cần thiết
- **Admin không thể tự xóa chính mình**
- Xóa cascade toàn bộ dữ liệu liên quan (địa chỉ, token, đơn hàng, v.v.)

---

## 4. Phân quyền

| Quyền | CUSTOMER | STAFF | ADMIN |
|---|---|---|---|
| Truy cập Admin module | ❌ | ❌ | ✅ |

> **Chỉ ADMIN** — STAFF không được quản lý người dùng. Đây là điểm khác biệt quan trọng so với các module khác cho phép STAFF_ROLES.

---

## 5. Ràng buộc nghiệp vụ

| Ràng buộc | Lý do |
|---|---|
| Không sửa/xóa/khóa chính mình | Tránh self-lockout, tránh leo thang quyền |
| Chỉ ADMIN được truy cập | Thông tin người dùng là nhạy cảm |

---

## 6. Ngoài phạm vi

- Admin xem lịch sử đơn hàng của user cụ thể (thuộc module Order)
- Admin reset mật khẩu người dùng
- Đăng ký tài khoản admin (thực hiện qua DB hoặc seed)
- Log hành động admin (audit trail)
