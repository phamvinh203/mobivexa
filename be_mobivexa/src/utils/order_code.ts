// Định dạng mã đơn hàng: ORD-YYYYMMDD-XXXXXX (6 hex viết hoa).
// Nguồn phát sinh: generateOrderCode() trong order.service.ts.
// Giữ format ở một chỗ để regex tìm-trong-chuỗi và regex validate-đầu-vào không lệch nhau.
export const ORDER_CODE_RE = /ORD-\d{8}-[0-9A-F]{6}/i        // tìm mã trong nội dung chuyển khoản
export const ORDER_CODE_EXACT_RE = /^ORD-\d{8}-[0-9A-F]{6}$/i // khớp toàn chuỗi khi validate input
