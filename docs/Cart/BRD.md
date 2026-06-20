# BRD — Business Requirement Document
## Module: Cart (Giỏ hàng)
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0  
> **Ngày:** 2026-06-19  
> **Người soạn:** Tự động sinh từ source code  

---

## 1. Bối cảnh kinh doanh

Mobivexa là nền tảng thương mại điện tử bán thiết bị di động và phụ kiện. Module Cart là **bước đệm trước khi mua hàng** — cho phép khách hàng lưu trữ sản phẩm muốn mua, điều chỉnh số lượng, và xem lại trước khi chốt đơn.

Hệ thống phục vụ 1 nhóm người dùng chính:

| Nhóm | Mô tả |
|---|---|
| **Khách hàng (Customer)** | Người đã đăng nhập, thao tác với giỏ hàng của chính mình |

Mỗi customer có đúng **1 giỏ hàng** (1:1) — chứa nhiều CartItem, mỗi item đại diện cho 1 variant sản phẩm với số lượng.

---

## 2. Mục tiêu kinh doanh

| ID | Mục tiêu | Đo lường thành công |
|---|---|---|
| BG-01 | Khách hàng lưu sản phẩm dễ dàng, ít ma sát | Thêm sản phẩm vào giỏ < 3 giây; UI phản hồi nhanh |
| BG-02 | Hỗ trợ thêm nhiều lần cùng sản phẩm (cộng dồn) | Tự động cộng quantity nếu item đã có trong giỏ; tối đa 100/item |
| BG-03 | Kiểm tra tồn kho chính xác | Kiểm tra stock tại thời điểm thêm/sửa; chặn khi vượt quá |
| BG-04 | Badge số lượng hiển thị chính xác | Lean summary trả về nhanh để cập nhật badge |
| BG-05 | TránhCases xem chi tiết giỏ hàng đầy đủ | Full response trả về variant + product + ảnh bìa |
| BG-06 | Xóa item/giỏ dễ dàng | Xóa từng item hoặc xóa toàn bộ giỏ hàng |
| BG-07 | Không xóa giỏ hàng khi clear | Bản ghi Cart tồn tại, chỉ xóa items (dễ khôi phục) |
| BG-08 | Tự động tạo giỏ hàng | User không cần bước tạo giỏ — trải nghiệm liền mạch |

---

## 3. Các bên liên quan (Stakeholders)

| Stakeholder | Vai trò | Kỳ vọng |
|---|---|---|
| **Khách hàng** | Người dùng cuối | Thêm/sửa/xóa sản phẩm dễ dàng, xem giỏ nhanh, badge chính xác |
| **Product team** | Quản lý sản phẩm | Sản phẩm trong giỏ là snapshot (variant) + product full info |
| **Order team** | Quản lý đơn hàng | Dùng giỏ để tạo đơn hàng; clear cart khi đặt thành công |

---

## 4. Yêu cầu kinh doanh

### 4.1 Quản lý giỏ hàng (Cart Management)

**Mô tả:** Mỗi user có 1 giỏ hàng tự động, chứa nhiều sản phẩm.

| Yêu cầu | Chi tiết |
|---|---|
| **1 user = 1 cart** | Mỗi user có đúng 1 giỏ hàng (unique theo userId) |
| **Tự động tạo** | Giỏ hàng được upsert tự động khi user GET hoặc thêm item lần đầu |
| **Không xóa Cart** | Chỉ xóa CartItems, bản ghi Cart tồn tại vĩnh viễn |
| **Full response** | GET /cart trả về đầy đủ info (variant + product + ảnh) |
| **Lean summary** | Mutation trả về `{ cartId, itemCount }` — cập nhật badge nhanh |

---

### 4.2 Thêm sản phẩm vào giỏ (Add to Cart)

**Mô tả:** Customer thêm sản phẩm vào giỏ hàng.

| Yêu cầu | Chi tiết |
|---|---|
| **Variant phải hợp lệ** | Variant phải tồn tại và `isActive = true` |
| **Quantity range** | Số nguyên từ 1 đến 100 |
| **Cộng dồn** | Nếu item đã có → cộng dồn quantity (không thay thế) |
| **Kiểm tra stock** | Tổng quantity (sau cộng) ≤ `stock` hiện tại |
| **Tự động upsert cart** | Giỏ hàng tự động tạo nếu chưa có |
| **Lean response** | Trả về `{ cartId, itemCount }` — không reload toàn bộ giỏ |

**Ràng buộc:**
- Quantity < 1 hoặc > 100 → `400` `Số lượng phải là số nguyên từ 1 đến 100`
- Variant không tồn tại/inactive → `404` `Sản phẩm không tồn tại hoặc đã ngừng bán`
- Quantity > stock → `400` `Sản phẩm không đủ hàng (còn {stock})`

---

### 4.3 Cập nhật số lượng (Update Quantity)

**Mô tả:** Customer cập nhật số lượng của item trong giỏ.

| Yêu cầu | Chi tiết |
|---|---|
| **Replace quantity** | Quantity mới thay thế trực tiếp (không cộng dồn) |
| **Range** | 1–100 |
| **Kiểm tra stock** | Quantity mới ≤ `stock` hiện tại |
| **Ownership check** | Item phải thuộc giỏ của user hiện tại |
| **Lean response** | Trả về `{ cartId, itemCount }` |

**Ràng buộc:**
- Quantity không hợp lệ → `400` `Số lượng phải là số nguyên từ 1 đến 100`
- Item không tồn tại hoặc không thuộc giỏ → `404`
- Quantity > stock → `400` `Số lượng vượt quá tồn kho (còn {stock})`

---

### 4.4 Xóa sản phẩm (Remove Items)

**Mô tả:** Customer xóa 1 item hoặc toàn bộ giỏ hàng.

| Yêu cầu | Chi tiết |
|---|---|
| **Xóa 1 item** | DELETE /cart/items/:itemId — xóa item cụ thể |
| **Xóa toàn bộ** | DELETE /cart — xóa tất cả CartItems |
| **Ownership check** | Mọi operation đều check item thuộc giỏ của user |
| **Giỏ không bị xóa** | Clear cart chỉ xóa CartItems, bản ghi Cart vẫn tồn tại |
| **Lean response** | Trả về `{ cartId, itemCount: 0 }` (cho clear) |

**Ràng buộc:**
- Item không tồn tại hoặc không thuộc giỏ → `404` `Không tìm thấy sản phẩm trong giỏ hàng`
- Giỏ không tồn tại → `404` `Giỏ hàng không tồn tại`

---

### 4.5 Tồn kho (Stock Management)

**Mô tả:** Kiểm tra tồn kho tại thời điểm thêm/sửa sản phẩm.

| Yêu cầu | Chi tiết |
|---|---|
| **Kiểm tra ở thêm** | Quantity (hoặc total sau cộng) ≤ `stock` |
| **Kiểm tra ở sửa** | Quantity mới ≤ `stock` |
| **Không lock stock** | Không trừ stock cho đến khi đặt hàng |
| **Hết hàng sau đã thêm** | Item vẫn tồn tại trong giỏ, bị chặn khi đặt hàng |
| **Không auto remove** | Hệ thống không tự xóa item khi hết hàng |

**Ràng buộc:**
- Nếu quantity > stock → `400` `Sản phẩm không đủ hàng (còn {stock})`
- Error message hiển thị số lượng còn lại

---

### 4.6 Trải nghiệm người dùng (UX)

**Yêu cầu | Chi tiết |
|---|---|
| **Badge số lượng** | Hiển thị tổng số items trong giỏ trên icon giỏ |
| **Full response** | Vào trang giỏ → load toàn bộ items + variant + product + ảnh |
| **Lean summary** | Sau mutation → chỉ update badge (không reload toàn bộ giỏ) |
| **Sắp xếp item** | Items được sắp theo `createdAt ASC` (thêm trước hiển thị trước) |
| **Product info** | Mỗi item kèm tên sản phẩm, slug, ảnh bìa |
| **Variant info** | Mỗi item kèm SKU, màu, bộ nhớ, RAM, giá, stock |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Chỉ tiêu | Giá trị |
|---|---|
| Thêm sản phẩm vào giỏ | < 200ms (p95) |
| Cập nhật số lượng | < 150ms (p95) |
| Xóa item/giỏ | < 100ms (p95) |
| Lấy toàn bộ giỏ hàng | < 300ms (p95) |
| Lean summary | < 50ms (p95) |

---

### 5.2 Scalability

| Yêu cầu | Chi tiết |
|---|---|
| Số item tối đa/giỏ | 100 items |
| Số lượng/item | 1–100 |
| Concurrent user | 100+ users thao tác giỏ hàng cùng lúc |

---

### 5.3 Security

| Yêu cầu | Mô tả |
|---|---|
| Customer endpoints | Yêu cầu JWT token (CUSTOMER+) |
| Ownership check | Check `cartId === user.cartId` cho mọi operation |
| SQL Injection prevention | Prisma ORM escape input |

---

### 5.4 Availability

| Yêu cầu | Giá trị |
|---|---|
| Uptime target | 99.9% |
| Cart auto-creation | Always succeed (fallback to existing cart) |

---

## 6. Dependencies

| Module | Dependency | Chi tiết |
|---|---|---|
| **Cart ↔ User** | FK | `userId` → User.id (unique 1:1) |
| **CartItem ↔ Cart** | FK | `cartId` → Cart.id (cascade delete) |
| **CartItem ↔ ProductVariant** | FK | `variantId` → ProductVariant.id |
| **Cart ↔ Order** | Conditional | Khi đặt hàng thành công → clearCart được gọi |

---

## 7. Risks & Assumptions

### 7.1 Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Race condition thêm item cùng lúc | Cao | Unique constraint (cartId, variantId) → DB reject 1 request |
| R-02 | Stock thay đổi sau khi đã thêm | Trung bình | Không lock stock; chặn khi đặt hàng |
| R-03 | Giỏ hàng quá lớn (100 items) | Thấp | Giới hạn quantity/item max 100 |
| R-04 | Badges không cập nhật real-time | Thấp | Lean summary trả về nhanh sau mutation |
| R-05 | Full response chậm | Thấp | Optimize query với Eager loading |

---

### 7.2 Assumptions

| ID | Assumption |
|---|---|
| A-01 | User đã có địa chỉ saved trước khi dùng giỏ hàng |
| A-02 | ProductVariant stock được cập nhật chính xác bởi module Product |
| A-03 | Số lượng 100/item là đủ cho nhu cầu (không cần wholesale) |
| A-04 | Khách hàng không cần export/import giỏ hàng (chỉ mua, không lưu draft) |
| A-05 | Clear cart không phải vĩnh viễn — user có thể thêm lại sau |

---

## 8. Success Metrics

| Metric | Target | How to measure |
|---|---|---|
| **Add to cart time** | < 3 giây (p95) | Track thời gian từ click đến success |
| **Cart abandonment rate** | < 60% | Total carts created / Total carts with ≥1 item |
| **Clear cart rate** | < 10% | Total clears / Total carts with ≥1 item |
| **Badge accuracy** | 100% | Badge count === actual itemCount |
| **Stock check accuracy** | 100% | 0 trường hợp vượt stock khi thêm (có error message) |

---

## 9. Timeline & Phases

### Phase 1: MVP (Week 1)
- ✅ Thêm/sửa/xóa item trong giỏ
- ✅ Xóa toàn bộ giỏ hàng
- ✅ Lean summary response
- ✅ Full response với product + variant + ảnh

### Phase 2: Enhanced (Week 2)
- ✅ Auto-upsert cart khi GET hoặc thêm lần đầu
- ✅ Cộng dồn quantity khi thêm item đã có
- ✅ Kiểm tra stock khi thêm/sửa
- ✅ Ownership check cho mọi operation

### Phase 3: Advanced (Future)
- ⏳ Save cart để lưu giỏ tạm (draft order)
- ⏳ Share cart (gửi giỏ hàng cho người khác)
- ⏳ Wishlist (sản phẩm quan tâm)
- ⏳ Cart analytics (thống kê items được thêm nhiều nhất)

---

## 10. Appendix

### 10.1 Terminology

| Term | Definition |
|---|---|
| **Cart** | Giỏ hàng — bản ghi 1-1 với user, chứa nhiều CartItems |
| **CartItem** | Mỗi sản phẩm trong giỏ — tham chiếu 1 variant + quantity |
| **Upsert** | Tạo mới nếu chưa có, không làm gì nếu đã tồn tại |
| **Lean summary** | Response gọn nhẹ `{ cartId, itemCount }` — dùng để update badge |
| **Full response** | Response đầy đủ items + variant + product + ảnh bìa |
| **Cộng dồn** | Nếu item đã có trong giỏ → cộng quantity vào (không thay thế) |
| **Badge** | Số lượng items hiển thị trên icon giỏ hàng (UI) |

---

### 10.2 Related Documents

| Document | Link |
|---|---|
| SRS - Software Requirements | [SRS.md](./SRS.md) |
| Use Case Document | [UseCase.md](./UseCase.md) |
| API Specification | [APISpec.md](./APISpec.md) |
| Activity Diagram | [ActivityDiagram.md](./ActivityDiagram.md) |
| Sequence Diagram | [SequenceDiagram.md](./SequenceDiagram.md) |
| ERD | [ERD.md](./ERD.md) |
| Test Cases | [TestCase.md](./TestCase.md) |

---

> **Document Status:** Draft  
> **Last Updated:** 2026-06-19  
> **Next Review:** After MVP completion
