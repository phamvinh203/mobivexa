# Activity Diagram
## Module: Review
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## AD-01: Tạo đánh giá

```mermaid
flowchart TD
    Start([POST /order-items/:orderItemId/review]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> FindItem[Tìm OrderItem\nwhere id=orderItemId\nAND order.userId=userId\nAND order.status=DELIVERED]
    FindItem --> ItemExist{Tìm thấy?}
    ItemExist -- Không --> E404[404]
    ItemExist -- Có --> HasReview{Đã có review?}
    HasReview -- Có --> E409[409 Đã đánh giá rồi]
    HasReview -- Không --> Validate[Validate:\nrating 1-5\ncontent ≥ 10 ký tự]
    Validate --> ValidOK{Hợp lệ?}
    ValidOK -- Không --> E400[400]
    ValidOK -- Có --> Parallel[Song song:\nResolve productId\nUpload ≤5 ảnh Cloudinary]
    Parallel --> Create[prisma.review.create\nstatus = APPROVED]
    Create --> R201[201 Review mới]
```

---

## AD-02: Sửa đánh giá

```mermaid
flowchart TD
    Start([PUT /reviews/:id]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> FindReview[findOwnedReview\nwhere id=reviewId AND userId=userId\ninclude photos]
    FindReview --> Exist{Tìm thấy?}
    Exist -- Không --> E404[404]
    Exist -- Có --> CheckWindow{now - createdAt\n≤ 30 ngày?}
    CheckWindow -- Quá hạn --> E400[400 Đã quá 30 ngày]
    CheckWindow -- Trong hạn --> Validate[Validate ít nhất 1 field\nrating 1-5 nếu có\ncontent 10-2000 nếu có]
    Validate --> HasFiles{Có ảnh mới?}
    HasFiles -- Có --> DelOld[destroyImage ảnh cũ async\nUpload ảnh mới Cloudinary]
    HasFiles -- Không --> SkipUpload[Không upload]
    DelOld & SkipUpload --> Update[prisma.review.update\nstatus = APPROVED]
    Update --> R200[200 Review đã cập nhật]
```

---

## AD-03: Toggle Helpful

```mermaid
flowchart TD
    Start([POST /reviews/:id/helpful]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> Parallel2[Song song:\ntìm review\ntìm ReviewHelpful của user]
    Parallel2 --> ReviewOK{review tồn tại\nvà APPROVED?}
    ReviewOK -- Không --> E404[404]
    ReviewOK -- Có --> Existing{Đã helpful?}
    Existing -- Có --> Delete[Xóa ReviewHelpful]
    Existing -- Không --> Create[Tạo ReviewHelpful]
    Delete & Create --> Count[Đếm lại _count.helpful]
    Count --> R200[200 helpful + count]
```

---

## AD-04: Admin Reply

```mermaid
flowchart TD
    Start([POST /admin/reviews/:id/reply]) --> Auth{STAFF+?}
    Auth -- Không --> E401_403[401/403]
    Auth -- Có --> Validate[Validate content 1-1000 ký tự]
    Validate --> OK{Hợp lệ?}
    OK -- Không --> E400[400]
    OK -- Có --> Update[prisma.review.update\nreplyContent = content.trim\nrepliedAt = now\ninclude REVIEW_ADMIN_INCLUDE]
    Update --> Exist{P2025?}
    Exist -- Có --> E404[404]
    Exist -- Không --> R200[200 Full review]
```
