# BRD — Business Requirements Document
## Module: Coupon (Mã giảm giá)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## 1. Mục tiêu kinh doanh

Module Coupon cho phép cửa hàng tạo và quản lý mã giảm giá để kích cầu mua sắm. Khách hàng nhập mã khi thanh toán và nhận chiết khấu tức thì trên tổng đơn hàng.

---

## 2. Bối cảnh & Vấn đề

| Vấn đề | Tác động |
|---|---|
| Không có công cụ chạy khuyến mãi | Khó cạnh tranh, mất khách về sàn TMĐT |
| Thiếu kiểm soát ngân sách giảm giá | Nguy cơ tặng quá mức, lỗ lãi không kiểm soát |
| Không giới hạn được ai dùng mã | Mã bị chia sẻ tràn lan, mất hiệu quả marketing |

---

## 3. Yêu cầu kinh doanh

### BR-01: Quản lý mã giảm giá (Admin)
- Admin tạo, sửa, bật/tắt, xóa mã giảm giá
- Mỗi mã có mã code duy nhất (không phân biệt hoa/thường)
- Hai loại giảm: theo phần trăm (PERCENT) và số tiền cố định (FIXED)
- Có thể đặt giới hạn tổng lượt dùng toàn hệ thống (`usageLimit`)
- Có thể đặt giá trị đơn tối thiểu (`minOrderValue`)
- Đối với mã PERCENT: có thể đặt trần giảm tối đa (`maxDiscount`)
- Mã có thời hạn (ngày bắt đầu, ngày kết thúc)
- Không thể xóa mã đã có người dùng — phải tắt thay vì xóa

### BR-02: Xem & áp dụng mã (Customer)
- Khách đăng nhập xem danh sách mã đang chạy
- Khách nhập mã để xem trước mức giảm trước khi đặt hàng
- Mỗi khách chỉ dùng được mỗi mã một lần (`CouponUsage`)
- Mã đã dùng vẫn hiển thị trong danh sách nhưng bị đánh dấu `used: true`

### BR-03: Toàn vẹn dữ liệu
- Code luôn được lưu UPPERCASE, so sánh case-insensitive
- Hủy đơn trả lại lượt dùng mã (xóa bản ghi `CouponUsage`)
- Lịch sử đơn hàng snapshot `couponCode` và `discount` — mã xóa không ảnh hưởng đơn cũ

---

## 4. Người dùng

| Actor | Vai trò |
|---|---|
| **Admin / Staff** | Quản lý toàn bộ mã giảm giá |
| **Customer** (đăng nhập) | Xem và áp dụng mã giảm |
| **Guest** | Không truy cập được |

---

## 5. Ngoài phạm vi

- Mã chỉ áp dụng cho sản phẩm/danh mục cụ thể
- Voucher tặng kèm sản phẩm
- Mã theo nhóm khách hàng
- Referral code

---

## 6. Định nghĩa thành công

| KPI | Mục tiêu |
|---|---|
| Tỷ lệ đơn dùng mã | ≥ 15% trong đợt khuyến mãi |
| Sai sót tính giảm | 0 |
| Thời gian tạo mã | < 1 phút |
