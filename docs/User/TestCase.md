# Test Case Document
## Module: User
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-06-19  
> **Tham chiếu:** [SRS.md](./SRS.md) | [APISpec.md](./APISpec.md)  
> **Framework:** Vitest + Supertest

---

## Tổng quan

| Nhóm | Số TC |
|---|---|
| GET /users/me | 2 |
| PUT /users/me | 7 |
| PUT /users/me/password | 7 |
| POST /users/me/avatar | 5 |
| GET /users/me/addresses | 2 |
| POST /users/me/addresses | 6 |
| PUT /users/me/addresses/:id | 4 |
| DELETE /users/me/addresses/:id | 4 |
| PATCH /users/me/addresses/:id/default | 4 |
| **Tổng** | **41** |

---

## TC-PROFILE: Hồ sơ cá nhân

### TC-PROFILE-01: Xem hồ sơ thành công

**Input:** `GET /api/users/me` với valid token  
**Expected:**
- HTTP: `200`
- Body chứa `id, email, fullName, phone, avatarUrl, role, isActive`
- Body **không chứa** `passwordHash`, `resetPasswordToken`, `avatarPublicId`

---

### TC-PROFILE-02: Xem hồ sơ không có token

**Input:** `GET /api/users/me` — không có Authorization header  
**Expected:** `401`

---

### TC-UPDATE-01: Cập nhật fullName thành công

**Input:** `{ "fullName": "Tên Mới" }`  
**Expected:** `200` — `data.fullName === "Tên Mới"`, `phone` không đổi

---

### TC-UPDATE-02: Cập nhật phone thành công

**Input:** `{ "phone": "0912345678" }`  
**Expected:** `200` — `data.phone === "0912345678"`, `fullName` không đổi

---

### TC-UPDATE-03: Xóa số điện thoại

**Input:** `{ "phone": "" }`  
**Expected:** `200` — `data.phone === null`

---

### TC-UPDATE-04: Không gửi trường nào

**Input:** `{}`  
**Expected:** `400` — `Vui lòng cung cấp ít nhất một trường cần cập nhật`

---

### TC-UPDATE-05: fullName quá ngắn

**Input:** `{ "fullName": "A" }`  
**Expected:** `400` — `Họ tên phải có ít nhất 2 ký tự`

---

### TC-UPDATE-06: Phone sai định dạng

| Input | Expected |
|---|---|
| `"phone": "1234"` | `400` Số điện thoại không hợp lệ |
| `"phone": "090123456"` (9 chữ số) | `400` |
| `"phone": "0123456789a"` | `400` |

---

### TC-UPDATE-07: Phone đã tồn tại ở user khác

**Precondition:** User B đang dùng `0901111111`  
**Input:** `{ "phone": "0901111111" }`  
**Expected:** `409` — `Số điện thoại đã được sử dụng`

---

## TC-PASSWORD: Đổi mật khẩu

### TC-PWD-01: Đổi mật khẩu thành công

**Input:** `{ "currentPassword": "oldpass123", "newPassword": "newpass456" }`  
**Expected:**
- HTTP: `200`
- DB: `passwordHash` mới (khác hash cũ)
- Phiên đăng nhập hiện tại **không bị ảnh hưởng** (refreshToken không bị revoke)

---

### TC-PWD-02: Sai mật khẩu hiện tại

**Input:** `{ "currentPassword": "wrongpass", "newPassword": "newpass456" }`  
**Expected:** `400` — `Mật khẩu hiện tại không đúng`

---

### TC-PWD-03: Mật khẩu mới quá ngắn

**Input:** `{ "currentPassword": "oldpass123", "newPassword": "short" }`  
**Expected:** `400` — `Mật khẩu mới phải có ít nhất 8 ký tự`

---

### TC-PWD-04: Mật khẩu mới trùng mật khẩu cũ

**Input:** `{ "currentPassword": "oldpass123", "newPassword": "oldpass123" }`  
**Expected:** `400` — `Mật khẩu mới phải khác mật khẩu hiện tại`

---

### TC-PWD-05: Thiếu currentPassword

**Input:** `{ "newPassword": "newpass456" }`  
**Expected:** `400` — `Vui lòng nhập mật khẩu hiện tại`

---

### TC-PWD-06: Thiếu newPassword

**Input:** `{ "currentPassword": "oldpass123" }`  
**Expected:** `400` — `Mật khẩu mới phải có ít nhất 8 ký tự`

---

### TC-PWD-07: Đăng nhập lại được bằng mật khẩu mới

**Verify (integration):** Sau đổi mật khẩu thành công, gọi `POST /auth/login` với `newPassword` → `200`.  
Gọi với `oldPassword` → `401`.

---

## TC-AVATAR: Upload ảnh đại diện

### TC-AVT-01: Upload ảnh hợp lệ (JPEG)

**Input:** file JPEG ≤ 5MB field `avatar`  
**Expected:**
- HTTP: `200`
- `data.avatarUrl` bắt đầu bằng `https://res.cloudinary.com/`
- DB: `user.avatarUrl` khác null

---

### TC-AVT-02: Upload lần 2 — ghi đè (không tạo file mới)

**Precondition:** Đã upload avatar lần 1  
**Action:** Upload file mới  
**Verify:** `avatarPublicId` sau lần 2 **bằng** `avatarPublicId` lần 1 (cùng `user_{userId}`) — không có file mới trên Cloudinary

---

### TC-AVT-03: Không gửi file

**Expected:** `400`

---

### TC-AVT-04: File quá 5MB

**Input:** file PNG 6MB  
**Expected:** `400` — `Kích thước file tối đa là 5MB`

---

### TC-AVT-05: Sai định dạng file

**Input:** file `.gif` hoặc `.pdf`  
**Expected:** `400`

---

## TC-ADDR: Địa chỉ giao hàng

### TC-ADDR-01: Xem danh sách địa chỉ — có địa chỉ

**Precondition:** User có 2 địa chỉ (1 default, 1 không)  
**Expected:** `200` — mảng 2 phần tử; phần tử đầu có `isDefault: true`

---

### TC-ADDR-02: Xem danh sách địa chỉ — chưa có

**Expected:** `200` — mảng rỗng `[]`

---

### TC-ADDR-03: Thêm địa chỉ đầu tiên — tự thành mặc định

**Precondition:** User chưa có địa chỉ  
**Input:** `{ ..., isDefault: false }` *(gửi false nhưng vẫn thành true)*  
**Expected:**
- HTTP: `201`
- `data.isDefault === true` (tự override)

---

### TC-ADDR-04: Thêm địa chỉ thứ 2 với isDefault=true

**Precondition:** Đã có 1 địa chỉ mặc định (addr_001)  
**Input:** `{ ..., isDefault: true }`  
**Expected:**
- HTTP: `201`, `data.isDefault === true`
- DB: addr_001 có `isDefault === false`
- Verify: Chỉ 1 địa chỉ có `isDefault = true` tại mọi thời điểm

---

### TC-ADDR-05: Thêm địa chỉ thiếu trường bắt buộc

| Input thiếu | Expected |
|---|---|
| Thiếu `province` | `400` Vui lòng điền đầy đủ thông tin địa chỉ |
| Thiếu `streetDetail` | `400` |
| `fullName = "A"` | `400` Họ tên người nhận phải có ít nhất 2 ký tự |
| `phone = "123"` | `400` Số điện thoại không hợp lệ |

---

### TC-ADDR-06: Truy cập địa chỉ không thuộc mình

**Action:** `PUT /api/users/me/addresses/<id_của_user_khác>`  
**Expected:** `404` — `Địa chỉ không tồn tại`

---

### TC-ADDR-07: Cập nhật địa chỉ thành công

**Input:** `PUT /api/users/me/addresses/:id` với `{ streetDetail: "Số 99 Đường XYZ" }`  
**Expected:** `200` — `data.streetDetail === "Số 99 Đường XYZ"`

---

### TC-ADDR-08: Đặt địa chỉ không phải mặc định thành mặc định

**Precondition:** addr_A là default; addr_B không phải  
**Action:** `PATCH /users/me/addresses/addr_B/default`  
**Expected:**
- `200`
- DB: addr_B `isDefault=true`; addr_A `isDefault=false`

---

### TC-ADDR-09: Set default — idempotent (đã là mặc định)

**Precondition:** addr_A đang là mặc định  
**Action:** `PATCH /users/me/addresses/addr_A/default`  
**Expected:** `200` — không có DB transaction thực sự

---

### TC-ADDR-10: Xóa địa chỉ không phải mặc định

**Precondition:** addr_A là default; addr_B không phải  
**Action:** `DELETE /users/me/addresses/addr_B`  
**Expected:**
- `200`
- DB: addr_B không còn; addr_A vẫn là default

---

### TC-ADDR-11: Xóa địa chỉ mặc định — kế thừa tự động

**Precondition:** addr_A là default (createdAt cũ hơn); addr_B không phải (createdAt mới hơn)  
**Action:** `DELETE /users/me/addresses/addr_A`  
**Expected:**
- `200`
- DB: addr_B tự trở thành `isDefault = true`

---

### TC-ADDR-12: Xóa địa chỉ duy nhất — không có kế thừa

**Precondition:** User chỉ có 1 địa chỉ (đang là default)  
**Action:** `DELETE /users/me/addresses/<id>`  
**Expected:**
- `200`
- DB: Không còn địa chỉ nào; không có lỗi

---

## Checklist Coverage

| Tiêu chí | Trạng thái |
|---|---|
| Response không chứa password/token nhạy cảm | ✅ TC-PROFILE-01 |
| Ownership check cho địa chỉ | ✅ TC-ADDR-06 |
| Partial update (chỉ cập nhật trường được gửi) | ✅ TC-UPDATE-01, TC-UPDATE-02 |
| Phone unique toàn hệ thống | ✅ TC-UPDATE-07 |
| Avatar overwrite (không tạo duplicate) | ✅ TC-AVT-02 |
| Địa chỉ đầu tiên tự thành default | ✅ TC-ADDR-03 |
| Chỉ 1 default tại mọi thời điểm | ✅ TC-ADDR-04, TC-ADDR-08 |
| Set default idempotent | ✅ TC-ADDR-09 |
| Xóa default → kế thừa tự động | ✅ TC-ADDR-11 |
| Xóa địa chỉ cuối cùng — không lỗi | ✅ TC-ADDR-12 |
| Đổi mật khẩu không revoke session | ✅ TC-PWD-01 |
| Đăng nhập lại với mật khẩu mới | ✅ TC-PWD-07 |
