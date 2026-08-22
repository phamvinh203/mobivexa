# Business Requirements Document
## Module: Cart
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Mục tiêu nghiệp vụ

Quản lý giỏ hàng của khách hàng: thêm sản phẩm, cập nhật số lượng, xóa từng item hoặc xóa toàn bộ, xem giỏ đầy đủ.

---

## 2. Actors

| Actor | Mô tả |
|---|---|
| **Customer** | Toàn bộ các thao tác giỏ hàng; cần đăng nhập |

---

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-01 | Mỗi user có đúng **1** giỏ hàng (`Cart.userId UNIQUE`) |
| BR-02 | `getCart` và `addItem` tự tạo giỏ nếu chưa có (`upsert`) — không cần tạo trước |
| BR-03 | Chỉ thêm được variant `isActive = true`; inactive → 404 |
| BR-04 | Khi thêm: kiểm tra `stock >= quantity`; 400 nếu không đủ hàng |
| BR-05 | Nếu variant đã có trong giỏ → cộng dồn số lượng; kiểm tra tổng mới <= stock |
| BR-06 | Khi cập nhật số lượng: kiểm tra `quantity <= stock`; 400 nếu vượt tồn kho |
| BR-07 | Mutations (add/update/remove) trả **lean summary** (`cartId`, `itemCount`) — không trả full cart |
| BR-08 | `getCart` trả **full data** với 4 cấp join (cart → items → variant → product + images) |
| BR-09 | Items sắp xếp theo `createdAt ASC` trong response |
| BR-10 | `clearCart` xóa tất cả items, giữ nguyên Cart record; được gọi từ Order module khi đặt từ giỏ |
| BR-11 | `quantity` max là 100 (validator) |

---

## 4. Phạm vi module

**Trong phạm vi:**
- Xem giỏ hàng đầy đủ
- Thêm / cập nhật số lượng / xóa từng item
- Xóa toàn bộ giỏ

**Ngoài phạm vi:**
- Giỏ hàng cho guest (không đăng nhập)
- Lưu giỏ hàng vào localStorage / merge
- Đặt hàng trực tiếp từ giỏ (xem module Order)
