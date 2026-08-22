# BRD — Business Requirements Document
## Module: Inventory (Quản lý tồn kho)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## 1. Mục tiêu kinh doanh

Module Inventory cung cấp báo cáo tồn kho theo thời gian thực cho Staff và Admin. Giúp theo dõi số lượng hàng tồn, phát hiện sản phẩm sắp hết hàng và hàng đã hết, từ đó lên kế hoạch nhập hàng kịp thời.

---

## 2. Bối cảnh & Vấn đề

| Vấn đề | Tác động |
|---|---|
| Không có màn hình tổng quan tồn kho | Staff phải xem từng sản phẩm, mất thời gian |
| Không biết biến thể nào sắp hết | Hết hàng đột ngột, mất doanh thu |
| Không lọc được theo ngưỡng tồn thấp | Không ưu tiên được sản phẩm cần nhập gấp |

---

## 3. Yêu cầu kinh doanh

### BR-01: Dashboard tồn kho
- Hiển thị tổng số biến thể, tổng tồn kho, số hết hàng, số tồn thấp
- Summary được cache 60 giây để tránh tính lại liên tục khi nhiều staff xem

### BR-02: Danh sách biến thể theo tình trạng tồn
- Lọc theo trạng thái: hết hàng (`out_of_stock`), tồn thấp (`low_stock`), còn hàng (`in_stock`)
- Ngưỡng "tồn thấp" có thể tùy chỉnh qua `lowThreshold` (default 5)
- Sắp xếp từ tồn ít nhất để staff ưu tiên xử lý

### BR-03: Tìm kiếm sản phẩm
- Tìm theo tên sản phẩm dùng Full Text Search (PostgreSQL `to_tsvector`)
- Lọc theo brand

### BR-04: Phân quyền
- Chỉ STAFF_ROLES (STAFF + ADMIN) — không cho Customer xem

---

## 4. Người dùng

| Actor | Vai trò |
|---|---|
| **Staff / Admin** | Xem báo cáo tồn kho |
| **Guest / Customer** | Không có quyền |

---

## 5. Ngoài phạm vi

- Cập nhật số lượng tồn kho qua Inventory endpoint (thực hiện qua Product module)
- Lịch sử nhập/xuất kho
- Cảnh báo tự động khi tồn thấp (push notification)
- Xuất báo cáo Excel/CSV
