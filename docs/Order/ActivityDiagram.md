# Activity Diagram — Luồng xử lý
## Module: Order (Đơn hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Ghi chú:** Sử dụng cú pháp Mermaid — render trên GitHub, GitLab, Obsidian, VSCode

---

## AD-01: Đặt hàng từ giỏ hàng

```mermaid
flowchart TD
    A([Start: Customer gửi POST /api/orders]) --> B[Middleware authenticate CUSTOMER+]
    B -->|Auth fail| E1[/Trả về 401/]
    B -->|Auth pass| C[Validate addressId bắt buộc]
    C -->|Thiếu| E2[/Trả về 400 - Vui lòng chọn địa chỉ/]
    C -->|Có| D{Có gửi items?}
    D -->|Không| E[Get CartItems của user]
    D -->|Có| F[Resolve items từ body]
    E --> E1{Giỏ trống?}
    E1 -->|Trống| E3[/Trả về 400 - Giỏ hàng trống/]
    E1 -->|Không trống| G[Get variants từ CartItems]
    F --> G
    G --> H[Validate variants tồn tại + active]
    H -->|Không tồn tại/inactive| E4[/Trả về 400 - Sản phẩm không tồn tại/]
    H -->|Tồn tại| I[Tính toán unitPrice, subtotal, total]
    I --> J[Sinh orderCode: ORD-YYYYMMDD-XXXXXX]
    J --> K[Begin DB Transaction]
    K --> L[Tạo Order + OrderItems - snapshot]
    L --> M[Atomic decrement stock WHERE stock >= quantity]
    M -->|count = 0| N[Rollback transaction]
    N --> E5[/Trả về 400 - Sản phẩm không đủ hàng/]
    M -->|count > 0| O{Đặt từ giỏ?}
    O -->|Có| P[Xóa CartItems]
    O -->|Không| Q[Commit transaction]
    P --> Q
    Q --> R[/Trả về 201 + order object/]
    E1 --> Z([End])
    E2 --> Z
    E3 --> Z
    E4 --> Z
    E5 --> Z
    R --> Z
```

---

## AD-02: Hủy đơn hàng (Customer)

```mermaid
flowchart TD
    A([Start: Customer gửi PATCH /api/orders/:id/cancel]) --> B[Middleware authenticate CUSTOMER+]
    B -->|Auth fail| E1[/Trả về 401/]
    B -->|Auth pass| C[Query WHERE id AND userId]
    C -->|Không tìm thấy| E2[/Trả về 404 - Đơn hàng không tồn tại/]
    C -->|Tìm thấy| D[Validate trạng thái cho phép CANCELLED]
    D -->|Không cho phép| E3[/Trả về 400 - Không thể hủy đơn ở trạng thái hiện tại/]
    D -->|Cho phép| E[Begin DB Transaction]
    E --> F[Update status = CANCELLED, cancelReason]
    F --> G[Hoàn trả stock cho từng item increment]
    G --> H[Commit transaction]
    H --> I[/Trả về 200 + order object/]
    E1 --> Z([End])
    E2 --> Z
    E3 --> Z
    I --> Z
```

---

## AD-03: Admin cập nhật trạng thái đơn hàng

```mermaid
flowchart TD
    A([Start: Admin gửi PATCH /api/admin/orders/:id/status]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Validate status là OrderStatus hợp lệ]
    C -->|Sai| E2[/Trả về 400 - Trạng thái không hợp lệ/]
    C -->|Đúng| D{status = CANCELLED?}
    D -->|Có| E[Validate cancelReason bắt buộc]
    D -->|Không| F[Find order by ID]
    E -->|Thiếu| E3[/Trả về 400 - Vui lòng nhập lý do hủy/]
    E -->|Có| F
    F -->|Không tìm thấy| E4[/Trả về 404/]
    F -->|Tìm thấy| G[Validate transition theo VALID_TRANSITIONS]
    G -->|Không hợp lệ| E5[/Trả về 400 - Không thể chuyển từ.../]
    G -->|Hợp lệ| H{status = CANCELLED?}
    H -->|Có| I[Begin DB Transaction]
    H -->|Không| J[Update status thẳng]
    I --> K[Update status + cancelReason]
    K --> L[Hoàn trả stock cho từng item]
    L --> M[Commit transaction]
    M --> N[/Trả về 200 + order/]
    J --> N
    E1 --> Z([End])
    E2 --> Z
    E3 --> Z
    E4 --> Z
    E5 --> Z
    N --> Z
```

---

## AD-04: Admin cập nhật thanh toán

```mermaid
flowchart TD
    A([Start: Admin gửi PATCH /api/admin/orders/:id/payment]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Validate paymentStatus hợp lệ]
    C -->|Sai| E2[/Trả về 400 - Trạng thái thanh toán không hợp lệ/]
    C -->|Đúng| D[Find order lean check]
    D -->|Không tìm thấy| E3[/Trả về 404/]
    D -->|Tìm thấy| E[Update paymentStatus]
    E --> F{paymentStatus = PAID?}
    F -->|Có| G[Set paidAt = NOW]
    F -->|Không| H[/Trả về 200 + order/]
    G --> H
    E1 --> Z([End])
    E2 --> Z
    E3 --> Z
    H --> Z
```

---

## AD-05: Xem danh sách đơn của tôi

```mermaid
flowchart TD
    A([Start: Customer gửi GET /api/orders]) --> B[Middleware authenticate CUSTOMER+]
    B -->|Auth fail| E1[/Trả về 401/]
    B -->|Auth pass| C[Get userId từ JWT]
    C --> D[Query WHERE userId = req.user.userId]
    D --> E{Có filter status?}
    E -->|Có| F[Apply filter status]
    E -->|Không| G[Skip filter]
    F --> H[Sort by createdAt DESC]
    G --> H
    H --> I[Paginate results]
    I --> J[/Trả về 200 + orders + pagination/]
    E1 --> Z([End])
    J --> Z
```

---

## AD-06: Xem chi tiết đơn hàng của tôi

```mermaid
flowchart TD
    A([Start: Customer gửi GET /api/orders/:id]) --> B[Middleware authenticate CUSTOMER+]
    B -->|Auth fail| E1[/Trả về 401/]
    B -->|Auth pass| C[Query WHERE id AND userId]
    C -->|Không tìm thấy| E2[/Trả về 404 - Đơn hàng không tồn tại/]
    C -->|Tìm thấy| D[Include OrderItems, User, Address]
    D --> E[/Trả về 200 + order full detail/]
    E1 --> Z([End])
    E2 --> Z
    E --> Z
```

---

## AD-07: Admin xem danh sách tất cả đơn

```mermaid
flowchart TD
    A([Start: Admin gửi GET /api/admin/orders]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Build where clause từ filters]
    C --> D[Include User + _count.items]
    D --> E[Sort by createdAt DESC]
    E --> F[Paginate results]
    F --> G[/Trả về 200 + orders + pagination/]
    E1 --> Z([End])
    G --> Z
```

---

## AD-08: Admin xem chi tiết đơn hàng bất kỳ

```mermaid
flowchart TD
    A([Start: Admin gửi GET /api/admin/orders/:id]) --> B[Middleware authenticate + authorize STAFF+]
    B -->|Auth fail| E1[/Trả về 401/403/]
    B -->|Auth pass| C[Find order by ID]
    C -->|Không tìm thấy| E2[/Trả về 404/]
    C -->|Tìm thấy| D[Include đầy đủ OrderItems, User, Address]
    D --> E[/Trả về 200 + order full detail/]
    E1 --> Z([End])
    E2 --> Z
    E --> Z
```

---

## AD-09: State Machine - Trạng thái đơn hàng

```mermaid
flowchart TD
    A([PENDING]) --> B{VALID_TRANSITIONS}
    B -->|CONFIRMED| C([CONFIRMED])
    B -->|CANCELLED| D([CANCELLED])
    
    C --> E{VALID_TRANSITIONS}
    E -->|SHIPPING| F([SHIPPING])
    E -->|CANCELLED| D
    
    F --> G{VALID_TRANSITIONS}
    G -->|DELIVERED| H([DELIVERED])
    G -->|CANCELLED| D
    
    H --> I([Kết thúc])
    D --> I
    
    style A fill:#e1f5ff
    style C fill:#fff4e1
    style F fill:#ffe1f5
    style H fill:#e1ffe1
    style D fill:#ffe1e1
    style I fill:#f0f0f0
```

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Total Diagrams:** 9  
> **Next Review:** After implementation complete
